import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { FreewayTdcsSimScene } from "../three/FreewayTdcsSimScene";
import { timeStore } from "../state/timeStore";
import { subscribeTimeRepaint } from "./customLayer";
import {
  FREEWAY_TDCS_CHUNK_S, MERC_PER_M, SEGPOS_LEN, buildChunk, buildChunkSteps, chunkKeyOf, mercX, mercY, segPos, speedIdx,
  type ChunkOpts, type FreewayTdcsChunk, type FreewayTdcsData,
} from "../data/freewayTdcsSimModel";
import {
  freewayTdcsColors, freewayTdcsColorsVersion, setFreewayTdcsHeads, setFreewayTdcsStatus,
} from "../data/freewayTdcsSimStore";
import {
  FREEWAY_TDCS_NEAR_ZOOM, FREEWAY_TDCS_VT_DIM, freewayTdcsHexRgb, freewayTdcsSpeedLut, type FreewayTdcsColorMode,
} from "../data/freewayTdcsSimTypes";

export const FREEWAY_TDCS_SIM_LAYER_ID = "freeway-tdcs-sim-3d";

/** 同時在路上峰值 15,397 台（trips_meta peak_concurrent）；預算留餘裕，超過就截斷並警告一次 */
const HEAD_BUDGET = 20000;
/** 路面判為橋梁／高架的門檻：資料路面高程比 Mapbox 地表高出這麼多（m）才用資料高程 */
const BRIDGE_DEADBAND_M = 4;
/** 線與車頭離地抬高（m，乘誇張倍率）：Mapbox 地形網格在節點之間會略為隆起，避免路面被地形吃掉 */
const LIFT_M = 2;
/** 預建下一塊時每段最多佔用主執行緒的毫秒數 */
const PREBUILD_SLICE_MS = 6;
let warnedBudget = false;
let warnedRender = false;

export interface FreewayTdcsSimLayerOptions {
  getData: () => FreewayTdcsData | null;
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getTrail: () => number;
  getWidth: () => number;
  getSize: () => number;
  getColorMode: () => FreewayTdcsColorMode;
  getVtMask: () => number;
  getIsDark: () => boolean;
  getFollowTrip: () => number | null;
}

interface DebugFlags {
  __freewayTdcsNoDepth?: boolean; __freewayTdcsShowTunnel?: boolean;
  __freewayTdcsHeight?: { ms: number; exag: number; ground: number; bridge: number; tunnel: number };
  __freewayTdcsPerf?: { fps: number; active: number; zoom: number; near: boolean; pieces: number; chunkMs: number; maxFrameMs: number; syncBuilds: number; prebuilt: number };
}
const dbg = (): DebugFlags => (typeof window !== "undefined" ? (window as unknown as DebugFlags) : {});

function zoomPx(z: number): number {
  return z < 11 ? 2.5 : z < 12.5 ? 3 : z < 14 ? 4 : z < 15.5 ? 5.5 : 7;
}

function terrainExag(map: MapboxMap): number {
  const t = map.getTerrain();
  if (!t) return 0;
  const e = (t as { exaggeration?: unknown }).exaggeration;
  return typeof e === "number" ? e : 1;
}

export function createFreewayTdcsSimLayer(opts: FreewayTdcsSimLayerOptions): CustomLayerInterface {
  const scene = new FreewayTdcsSimScene(HEAD_BUDGET);
  let map: MapboxMap | null = null;
  let unsubTime: (() => void) | null = null;
  const cache = new Map<string, FreewayTdcsChunk>();
  let prebuildTimer: ReturnType<typeof setTimeout> | null = null;
  // 預建中的下一塊（分段做，每段 ≤ PREBUILD_SLICE_MS，讓出主執行緒給畫面）
  let syncBuilds = 0, prebuilt = 0;   // 除錯：同步建塊（會卡）與分段預建完成的次數
  let prebuild: { key: string; D: FreewayTdcsData; it: Generator<void, FreewayTdcsChunk, void> } | null = null;
  const pos = new Float64Array(SEGPOS_LEN);
  const hLng = new Float64Array(HEAD_BUDGET), hLat = new Float64Array(HEAD_BUDGET);
  const hTrip = new Uint32Array(HEAD_BUDGET), hSeg = new Uint32Array(HEAD_BUDGET);
  let frames = 0, fpsT = performance.now(), lastFrameT = 0, maxFrameMs = 0;
  // 高度
  let heightNodes: Float32Array | null = null;   // 路網（nodeZ）換了才重配高度陣列；時段檔合併不影響
  let H = new Float32Array(0), G = new Float32Array(0);
  let heightExag = -1, heightAt = 0, heightTimer: ReturnType<typeof setTimeout> | null = null;
  // 顏色
  let colorKey = "";

  // 已建好的塊：資料涵蓋整塊就沿用（時段檔合併換版不必重建）；不完整且資料換了才重建
  const usable = (ch: FreewayTdcsChunk | undefined, D: FreewayTdcsData) => !!ch && (ch.complete || ch.D === D);
  const getChunk = (D: FreewayTdcsData, k: number, o: ChunkOpts): FreewayTdcsChunk => {
    const key = chunkKeyOf(k, o);
    let ch = cache.get(key);
    if (!usable(ch, D)) {
      // 預建到一半就要用：同一份資料就接著做完（不浪費已做的部分），否則重建
      if (prebuild && prebuild.key === key && prebuild.D === D) {
        let r = prebuild.it.next();
        while (!r.done) r = prebuild.it.next();
        ch = r.value;
      } else ch = buildChunk(D, k, o);
      syncBuilds++;
      if (prebuild?.key === key) prebuild = null;
      cache.set(key, ch);
    }
    // 只留目前與下一塊
    for (const [ck, c] of cache) if (ck !== key && !(c.k === k + 1 && ck === chunkKeyOf(k + 1, o))) cache.delete(ck);
    const nChunks = Math.ceil((D.winEnd - D.winStart) / FREEWAY_TDCS_CHUNK_S);
    const nextKey = chunkKeyOf(k + 1, o);
    if (k + 1 < nChunks && !usable(cache.get(nextKey), D) && !prebuildTimer && !(prebuild?.key === nextKey && prebuild.D === D)) {
      // 下一塊放到 paint pass 之外分段預建：每段最多 PREBUILD_SLICE_MS，換塊時不卡、平常也不會一次卡一大段
      prebuild = { key: nextKey, D, it: buildChunkSteps(D, k + 1, o) };
      const step = () => {
        prebuildTimer = null;
        const job = prebuild;
        if (!job || job.D !== opts.getData()) { if (job === prebuild) prebuild = null; return; }
        const until = performance.now() + PREBUILD_SLICE_MS;
        let r = job.it.next();
        while (!r.done && performance.now() < until) r = job.it.next();
        if (r.done) { cache.set(job.key, r.value); prebuild = null; prebuilt++; return; }
        prebuildTimer = setTimeout(step, 0);
      };
      prebuildTimer = setTimeout(step, 50);
    }
    return ch!;
  };

  /**
   * 每節點高度（m，乘誇張倍率）：
   * - 沒開地形（pitch 0）：全 0（平面）。
   * - 一般路段：Mapbox 地表（queryTerrainElevation，未誇張）——車貼在畫面上的地形上。
   * - 橋梁／高架：資料路面高程比 Mapbox 地表高出 > 4 m 時用資料高程（資料沒有 DTM 地表欄，無法算「路面－地表」差值）。
   * - 隧道：一律資料高程（在山體內，低於地表）。
   * Mapbox 地表還沒載入（回 null）時沿用上次值，第一次則用資料高程。
   */
  let nG = 0, nB = 0, nT = 0;
  const computeHeights = (D: FreewayTdcsData) => {
    if (!map) return;
    const t0 = performance.now();
    const N = D.nodeZ.length;
    if (heightNodes !== D.nodeZ) { H = new Float32Array(N); G = new Float32Array(N).fill(NaN); heightNodes = D.nodeZ; }
    const exag = terrainExag(map);
    if (exag === 0) H.fill(0);
    else {
      const { nodeZ: Z, tun, nodeLng, nodeLat, lineOf } = D;
      const ll: [number, number] = [0, 0];
      nG = 0; nB = 0; nT = 0;
      for (let i = 0; i < N; i++) {
        ll[0] = nodeLng[i]!; ll[1] = nodeLat[i]!;
        const g = map.queryTerrainElevation(ll, { exaggerated: false });
        if (g != null && Number.isFinite(g)) G[i] = g;
        const z = Z[i]!, gi = Number.isNaN(G[i]!) ? z : G[i]!;
        const inTunnel = tun[i] === 1 || (i > 0 && tun[i - 1] === 1 && lineOf[i - 1] === lineOf[i]);
        const bridge = !inTunnel && z - gi > BRIDGE_DEADBAND_M;
        if (g != null) nG++;
        if (bridge) nB++;
        if (inTunnel) nT++;
        H[i] = (inTunnel || bridge ? z : gi) * exag;
      }
    }
    heightExag = exag; heightAt = performance.now();
    dbg().__freewayTdcsHeight = { ms: Math.round(heightAt - t0), exag, ground: nG, bridge: nB, tunnel: nT };
    scene.setHeights(H);
  };
  const scheduleHeights = (delay: number) => {
    if (heightTimer) return;
    heightTimer = setTimeout(() => {
      heightTimer = null;
      const D = opts.getData();
      if (D && map && opts.getIsVisible()) { computeHeights(D); map.triggerRepaint(); }
    }, delay);
  };
  // 地形圖磚陸續載入：停下來（idle）後最多每秒重算一次
  const onIdle = () => {
    if (!map || !opts.getIsVisible() || terrainExag(map) === 0) return;
    scheduleHeights(Math.max(0, 1000 - (performance.now() - heightAt)));
  };

  return {
    id: FREEWAY_TDCS_SIM_LAYER_ID,
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
      scene.setGeo(MERC_PER_M, 0, FREEWAY_TDCS_VT_DIM);
      unsubTime = subscribeTimeRepaint(() => map, opts.getIsVisible);
      map.on("idle", onIdle);
    },

    render(gl: WebGLRenderingContext, matrix: number[]) {
      try {
        if (!map || !opts.getIsVisible()) return;
        const D = opts.getData();
        if (!D) return;
        const t = timeStore.getTime() - D.dayStartUnix;
        // 不在資料時段，或這個時段的檔還在載（loader 依時間軸自動載入，載到後重畫）
        if (!(t >= D.winStart && t <= D.winEnd) || t < D.coverStart || t > D.coverEnd) {
          // 不在資料時段：不畫車（圖例顯示提示與「跳到資料時段」）
          setFreewayTdcsHeads({ lng: hLng, lat: hLat, trip: hTrip, seg: hSeg, n: 0 });
          setFreewayTdcsStatus({ active: 0 });
          return;
        }
        // 高度：資料或誇張倍率（含開關地形）改變就立即重算
        const exag = terrainExag(map);
        if (heightNodes !== D.nodeZ || exag !== heightExag) computeHeights(D);
        scene.setGeo(MERC_PER_M, LIFT_M * Math.max(exag, 0) * MERC_PER_M, FREEWAY_TDCS_VT_DIM);
        // 顏色
        const mode = opts.getColorMode();
        const ck = `${mode}|${freewayTdcsColorsVersion()}`;
        if (ck !== colorKey) {
          colorKey = ck;
          const c = freewayTdcsColors();
          scene.setColors(freewayTdcsSpeedLut(c.speedPalette, c.speedCustom), c.typeColors.map(freewayTdcsHexRgb), mode);
        }
        // 隧道：開 3D 地形時車照畫，靠深度測試讓山體擋住（實測 Mapbox v3 custom layer 與地形共用深度）；
        // 沒開地形（平面）時沒有東西可擋，照原型進洞口就不畫
        const flags = dbg();
        const showTun = exag > 0 || !!flags.__freewayTdcsShowTunnel;
        scene.setDebug(!flags.__freewayTdcsNoDepth, showTun);

        const o: ChunkOpts = { trail: Math.round(opts.getTrail()), vtMask: opts.getVtMask() };
        const nChunks = Math.ceil((D.winEnd - D.winStart) / FREEWAY_TDCS_CHUNK_S);
        const k = Math.max(0, Math.min(nChunks - 1, Math.floor((t - D.winStart) / FREEWAY_TDCS_CHUNK_S)));
        const ch = getChunk(D, k, o);
        scene.setTrails(ch.key, ch.a, ch.b, ch.c, ch.pieceCount);
        const CD = ch.D;   // 車頭用建塊時的資料（段序號屬於它）

        const zoom = map.getZoom();
        const near = zoom >= FREEWAY_TDCS_NEAR_ZOOM;
        const follow = opts.getFollowTrip();
        const lift = LIFT_M * Math.max(exag, 0);
        let n = 0;
        for (let i = 0; i < ch.segIdx.length; i++) {
          const si = ch.segIdx[i]!;
          if (CD.segStart[si]! > t || CD.segEnd[si]! < t) continue;
          if (n >= HEAD_BUDGET) {
            if (!warnedBudget) { warnedBudget = true; console.warn(`[freewayTdcsSim] 車頭超過預算 ${HEAD_BUDGET}，截斷`); }
            break;
          }
          segPos(CD, si, t, pos);
          if (pos[6] === 1 && !showTun) continue; // 平面時隧道內不畫（原型同）
          const trip = CD.segs[3 * si + 2]!;
          hLng[n] = pos[0]!; hLat[n] = pos[1]!; hTrip[n] = trip; hSeg[n] = si;
          const r = pos[5]!, j = Math.floor(r), g = r - j;
          const hm = H.length ? H[j]! + ((H[Math.min(j + 1, H.length - 1)]! - H[j]!) * g) : 0;
          const x = mercX(pos[0]!) - CD.originX, y = mercY(pos[1]!) - CD.originY, z = (hm + lift) * MERC_PER_M;
          scene.headPos[3 * n] = x; scene.headPos[3 * n + 1] = y; scene.headPos[3 * n + 2] = z;
          const si8 = speedIdx(pos[4]!), vt = CD.vt[trip]!;
          scene.headCI[2 * n] = si8; scene.headCI[2 * n + 1] = vt;
          scene.headSel[n] = trip === follow ? 1 : 0;
          if (near) {
            // 車頭朝向＝行進方向＋換道橫向速度（換道時車頭偏轉，原型同）
            const vs = (Number.isFinite(pos[4]!) ? pos[4]! : 30) / 3.6, dOff = pos[7]!;
            const ax = pos[2]! * vs + pos[3]! * dOff, ay = pos[3]! * vs - pos[2]! * dOff;
            scene.carI[4 * n] = x; scene.carI[4 * n + 1] = y; scene.carI[4 * n + 2] = hm * MERC_PER_M;
            scene.carI[4 * n + 3] = Math.atan2(-ay, ax);   // Mercator y 向南
            scene.carCI[2 * n] = si8; scene.carCI[2 * n + 1] = vt;
          }
          n++;
        }
        setFreewayTdcsHeads({ lng: hLng, lat: hLat, trip: hTrip, seg: hSeg, n });
        const opacity = opts.getOpacity(), trail = opts.getTrail();
        const dpr = gl.drawingBufferWidth / Math.max(1, map.getCanvas().clientWidth);
        scene.setFrame({
          now: t - ch.c0,
          // 近景：尾巴最多 4 秒、淡一些（原型同），主角是 3D 車
          trail: near ? Math.min(4, trail) : trail,
          trailOpacity: (near ? 0.35 : 0.85) * opacity,
          widthPx: near ? Math.max(2, opts.getWidth()) : opts.getWidth(),
          opacity, sizePx: zoomPx(zoom) * opts.getSize(), headCount: n, carCount: near ? n : 0, near,
          isDark: opts.getIsDark(), pulse: 0.5 + 0.5 * Math.sin(performance.now() / 250),
        }, gl.drawingBufferWidth, gl.drawingBufferHeight, dpr);
        scene.render(matrix, D.originX, D.originY);
        if (follow != null) map.triggerRepaint();   // 跟隨光暈脈動

        frames++;
        const now = performance.now();
        if (lastFrameT) maxFrameMs = Math.max(maxFrameMs, now - lastFrameT);
        lastFrameT = now;
        if (now - fpsT > 1000) {
          const fps = Math.round((frames * 1000) / (now - fpsT) * 10) / 10;
          setFreewayTdcsStatus({ active: n, fps });
          dbg().__freewayTdcsPerf = {
            fps, active: n, zoom: Math.round(zoom * 10) / 10, near, pieces: ch.pieceCount,
            chunkMs: Math.round(ch.buildMs), maxFrameMs: Math.round(maxFrameMs), syncBuilds, prebuilt,
          };
          frames = 0; fpsT = now; maxFrameMs = 0;
        }
      } catch (error) {
        if (!warnedRender) { warnedRender = true; console.warn("[freewayTdcsSim] custom layer render skipped", error); }
      }
    },

    onRemove() {
      unsubTime?.();
      unsubTime = null;
      map?.off("idle", onIdle);
      if (prebuildTimer) clearTimeout(prebuildTimer);
      prebuildTimer = null;
      prebuild = null;
      if (heightTimer) clearTimeout(heightTimer);
      heightTimer = null;
      cache.clear();
      scene.dispose();
      map = null;
    },
  };
}
