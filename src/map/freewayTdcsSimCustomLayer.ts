import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { FreewayTdcsSimScene } from "../three/FreewayTdcsSimScene";
import { timeStore } from "../state/timeStore";
import { subscribeTimeRepaint } from "./customLayer";
import {
  FREEWAY_TDCS_CHUNK_S, buildChunk, carRgb, chunkKeyOf, mercX, mercY, segPos,
  type ChunkOpts, type FreewayTdcsChunk, type FreewayTdcsData,
} from "../data/freewayTdcsSimModel";
import { setFreewayTdcsHeads, setFreewayTdcsStatus } from "../data/freewayTdcsSimStore";
import type { FreewayTdcsColorMode } from "../data/freewayTdcsSimTypes";

export const FREEWAY_TDCS_SIM_LAYER_ID = "freeway-tdcs-sim-3d";

/** 同時在路上峰值 14,980 台（trips_meta peak_concurrent）；預算留餘裕，超過就截斷並警告一次 */
const HEAD_BUDGET = 20000;
let warnedBudget = false;
let warnedRender = false;

export interface FreewayTdcsSimLayerOptions {
  getData: () => FreewayTdcsData | null;
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getTrail: () => number;
  getSize: () => number;
  getColorMode: () => FreewayTdcsColorMode;
  getVtMask: () => number;
  getIsDark: () => boolean;
  getFollowTrip: () => number | null;
}

function zoomPx(z: number): number {
  return z < 11 ? 2.5 : z < 12.5 ? 3 : z < 14 ? 4 : z < 15.5 ? 5.5 : 7;
}

export function createFreewayTdcsSimLayer(opts: FreewayTdcsSimLayerOptions): CustomLayerInterface {
  const scene = new FreewayTdcsSimScene(HEAD_BUDGET);
  let map: MapboxMap | null = null;
  let unsubTime: (() => void) | null = null;
  const cache = new Map<string, FreewayTdcsChunk>();
  let prebuildTimer: ReturnType<typeof setTimeout> | null = null;
  const pos = new Float64Array(5);
  const hLng = new Float64Array(HEAD_BUDGET), hLat = new Float64Array(HEAD_BUDGET);
  const hTrip = new Uint32Array(HEAD_BUDGET), hSeg = new Uint32Array(HEAD_BUDGET);
  let frames = 0, fpsT = performance.now();

  const getChunk = (D: FreewayTdcsData, k: number, o: ChunkOpts): FreewayTdcsChunk => {
    const key = chunkKeyOf(k, o);
    let ch = cache.get(key);
    if (!ch) { ch = buildChunk(D, k, o); cache.set(key, ch); }
    // 只留目前與下一塊
    for (const [ck, c] of cache) if (ck !== key && !(c.k === k + 1 && ck === chunkKeyOf(k + 1, o))) cache.delete(ck);
    const nChunks = Math.ceil((D.winEnd - D.winStart) / FREEWAY_TDCS_CHUNK_S);
    const nextKey = chunkKeyOf(k + 1, o);
    if (k + 1 < nChunks && !cache.has(nextKey) && !prebuildTimer) {
      // 下一塊放到 paint pass 之外預建，換塊時不卡
      prebuildTimer = setTimeout(() => {
        prebuildTimer = null;
        if (!cache.has(nextKey)) cache.set(nextKey, buildChunk(D, k + 1, o));
      }, 50);
    }
    return ch;
  };

  return {
    id: FREEWAY_TDCS_SIM_LAYER_ID,
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
      unsubTime = subscribeTimeRepaint(() => map, opts.getIsVisible);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      try {
        if (!map || !opts.getIsVisible()) return;
        const D = opts.getData();
        if (!D) return;
        const t = timeStore.getTime() - D.dayStartUnix;
        if (!(t >= D.winStart && t <= D.winEnd)) {
          // 不在資料時段：不畫車（圖例顯示提示與「跳到資料時段」）
          setFreewayTdcsHeads({ lng: hLng, lat: hLat, trip: hTrip, seg: hSeg, n: 0 });
          setFreewayTdcsStatus({ active: 0 });
          return;
        }
        const o: ChunkOpts = { trail: Math.round(opts.getTrail()), mode: opts.getColorMode(), vtMask: opts.getVtMask() };
        const nChunks = Math.ceil((D.winEnd - D.winStart) / FREEWAY_TDCS_CHUNK_S);
        const k = Math.max(0, Math.min(nChunks - 1, Math.floor((t - D.winStart) / FREEWAY_TDCS_CHUNK_S)));
        const ch = getChunk(D, k, o);
        scene.setTrails(ch.key, ch.positions, ch.times, ch.colors, ch.vertexCount);

        const follow = opts.getFollowTrip();
        let n = 0;
        for (let i = 0; i < ch.segIdx.length; i++) {
          const si = ch.segIdx[i]!;
          if (D.segStart[si]! > t || D.segEnd[si]! < t) continue;
          if (n >= HEAD_BUDGET) {
            if (!warnedBudget) { warnedBudget = true; console.warn(`[freewayTdcsSim] 車頭超過預算 ${HEAD_BUDGET}，截斷`); }
            break;
          }
          segPos(D, si, t, pos);
          const trip = D.segs[3 * si + 2]!;
          hLng[n] = pos[0]!; hLat[n] = pos[1]!; hTrip[n] = trip; hSeg[n] = si;
          scene.headPos[3 * n] = mercX(pos[0]!) - D.originX;
          scene.headPos[3 * n + 1] = mercY(pos[1]!) - D.originY;
          scene.headPos[3 * n + 2] = 0;
          const rgb = carRgb(D, trip, pos[4]!, o.mode);
          scene.headCol[3 * n] = rgb[0]; scene.headCol[3 * n + 1] = rgb[1]; scene.headCol[3 * n + 2] = rgb[2];
          scene.headSel[n] = trip === follow ? 1 : 0;
          n++;
        }
        setFreewayTdcsHeads({ lng: hLng, lat: hLat, trip: hTrip, seg: hSeg, n });
        scene.setFrame(t - ch.c0, o.trail, opts.getOpacity(), zoomPx(map.getZoom()) * opts.getSize(), n, opts.getIsDark());
        scene.render(matrix, D.originX, D.originY);

        frames++;
        const now = performance.now();
        if (now - fpsT > 1000) {
          setFreewayTdcsStatus({ active: n, fps: Math.round((frames * 1000) / (now - fpsT) * 10) / 10 });
          frames = 0; fpsT = now;
        }
      } catch (error) {
        if (!warnedRender) { warnedRender = true; console.warn("[freewayTdcsSim] custom layer render skipped", error); }
      }
    },

    onRemove() {
      unsubTime?.();
      unsubTime = null;
      if (prebuildTimer) clearTimeout(prebuildTimer);
      prebuildTimer = null;
      cache.clear();
      scene.dispose();
      map = null;
    },
  };
}
