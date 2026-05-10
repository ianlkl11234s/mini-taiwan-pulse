import * as THREE from "three";
import { toMercator } from "../utils/coordinates";
import {
  WASTE_SCHEDULE_COLOR,
  type WasteScheduleRoute,
  type WasteScheduleStop,
} from "../data/wasteScheduleLoader";

// 給 picking 用：當前 frame 在路線中的位置資訊
export interface ScheduleDebugFrame {
  route: WasteScheduleRoute;
  nowSec: number;          // 當日 wall-clock 秒數
  segmentIdx: number;      // 當前 segment index in stops[] (= prev stop index)
  prevStop: WasteScheduleStop;
  nextStop: WasteScheduleStop | null;
  gapToNextSec: number;    // prev.departure → next.arrival
  state: "waiting" | "moving" | "before-route" | "after-route";
  totalStops: number;
}

/**
 * 垃圾車「表定」場景（Phase 3 prototype）
 *
 * 跟 WasteTruckScene (GPS) 的差異：
 *   - GPS scene 走「真實 GPS 軌跡 + Catmull-Rom / OSRM matched polyline」
 *   - 本 scene 走「stops 序列 + arrival/departure 時間插值」（v1 stops-as-polyline）
 *     stops[i] → stops[i+1] 直線移動，中間用 linear interp 算位置
 *
 * 時間驅動：
 *   - 每幀讀外部傳入的 currentTimeSec（unix epoch 秒），轉成 Asia/Taipei 當日 wall-clock 秒數
 *   - wall-clock 秒在 stops 序列中找位置（可能 > 86400 跨日）
 *   - 跟 timeline 連動：replay 時播到 14:30 → 顯示當天 14:30 的表定 (跟 GPS 時間一致)
 *
 * 顏色：統一用 WASTE_SCHEDULE_COLOR (#a78bfa 淡紫)，跟 GPS 琥珀區隔
 *
 * 進階版（待 follow-up）：
 *   - 高雄/新北用真正的 route LineString 路徑（不是 stops 直線）
 *   - 北/基/宜用 OSRM /route 補
 *   - 目前 v1：所有 5 城都用 stops 直線連接，視覺先跑起來
 */

/**
 * Fade window — 真實秒。
 *
 * 使用者多以 60x 倍速觀看，故必須以「視覺秒」設計：
 *   180 真實秒 / 60x ≈ 3 視覺秒 fade，柔和不突兀，也不會「啵一下」。
 *
 * 路線首尾 + 班次切換的 fade-out/fade-in 都用同一個常數，方便一致調整。
 * 若覺得仍快/慢可調這個值。
 */
const FADE_DURATION_S  = 180;

/**
 * 執勤中 alpha 統一 1.0：停留 / 移動不切換 alpha、不切換 size，
 * 否則使用者眼睛會被「車一直變淡又變亮、忽大忽小」高頻切換刺激。
 */
const ACTIVE_ALPHA     = 1.0;

/**
 * 兩段式設計：短 dwell 持續移動，長 dwell 真停
 *
 * 60x 倍速下短 gap 視覺只有 1-2 秒，「停 + 跳」感很糟。但長 dwell 直接忽略
 * 又會讓「車真的在 stop 收 5 分鐘」失真。
 *
 * 解：dwell 比 DWELL_THRESHOLD_S 短的 stop，整段 arrival → next.arrival 持續移動
 *     （車一直在路上），dwell 比門檻長的 stop，正常停留 + 移動。
 *
 *   short_dwell ──→ p0.arrival ─────連續移動──── p1.arrival
 *   long_dwell  ──→ p0.arrival ─停留─ p0.dep ─移動─ p1.arrival
 *
 * Catmull-Rom 平滑（4 控制點）：4 個 stops 連續（無 trip-break）用 spline 而非折線，
 * 視覺更像「沿馬路走」。
 */
/** dwell 短於這值，視為「過站不停」，整段純移動到下一站 */
const DWELL_THRESHOLD_S = 120;
/** 移動 window 最低秒數（gap=0 從 dwell 借時間用） */
const MIN_MOVE_S        = 60;

/**
 * Trip-break threshold (秒)
 *
 * 觀察到一條 route_id 一天會跑「早班/中班/晚班」多段，中間 gap 10min ~ 2hr 不等。
 *
 * 但「stops 間 gap」隨地理密度差異極大：
 *   - 板橋 / 永和 / 新莊（密集市區）median 60s, p90 120s
 *   - 三重 / 淡水（一般市區）        median 240-300s, p90 840-900s
 *   - 林口（地廣山坡）              median **600s**, p90 **1200s**
 *
 * 600s threshold 對板橋等密集區 OK，但林口正常 stops 間 movement 大量被誤判為
 * 班次切換 → 整段 invisible。
 *
 * 取 1500s (25min)：林口 p90=1200s 涵蓋 90% 正常 movement 不誤判，
 * 真班次切換 (1.5-3 hr) 仍能識別。
 *
 * 60x 下大 gap 視為 movement 會「線性飄 N 視覺秒」，但比「整段 invisible」好。
 */
const TRIP_BREAK_S     = 1500;

// ── 時間工具 ──────────────────────────────────────────────

interface DayCacheEntry {
  dateKey: string;
  startOfDayUnix: number;
}
let dayCache: DayCacheEntry | null = null;

/** 把 unix 秒轉成 Asia/Taipei 當日的 wall-clock 秒數（0~86399；跨日可 > 86400） */
function unixToWallClockSec(unixSec: number): number {
  const dateKey = new Date(unixSec * 1000).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Taipei",
  });
  if (!dayCache || dayCache.dateKey !== dateKey) {
    dayCache = {
      dateKey,
      startOfDayUnix: new Date(`${dateKey}T00:00:00+08:00`).getTime() / 1000,
    };
  }
  return unixSec - dayCache.startOfDayUnix;
}

// ── 插值 ──────────────────────────────────────────────────

interface ScheduleFrame {
  lat: number;
  lng: number;
  alpha: number;
  visible: boolean;
  /** true = fade in/out 邊緣或路線開始/結束的「未動」狀態，false = 移動中 */
  waiting: boolean;
}

// 註：曾試過 Catmull-Rom 4 控制點曲線平滑，但 schedule stops 連線不是真實路徑
// （v1 沒套 OSRM），stops 為之字形時 spline 會 overshoot 飛出 p0-p1 直線外
// → 視覺上車「往回退一點再前進」。直線插值雖會「穿牆」，但不會反向 overshoot。
// 真正解 OSRM 整合在 BL-17。

/**
 * Binary search 找 nowSec 在 stops 中的 segment：
 *   返回 i 使得 stops[i].arrivalSec <= nowSec
 *   (i = -1 表 nowSec 早於所有 stops；i = stops.length-1 表 nowSec 晚於最後)
 */
function findStopIndex(stops: WasteScheduleStop[], nowSec: number): number {
  if (stops.length === 0) return -2;
  if (nowSec < stops[0]!.arrivalSec) return -1;
  if (nowSec >= stops[stops.length - 1]!.arrivalSec) return stops.length - 1;
  let lo = 0, hi = stops.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (stops[mid]!.arrivalSec <= nowSec) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** 對單條 route 算當前位置 */
function interpolateRoute(stops: WasteScheduleStop[], nowSec: number): ScheduleFrame {
  if (stops.length === 0) {
    return { lat: 0, lng: 0, alpha: 0, visible: false, waiting: false };
  }
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;

  // 路線還沒開始：fade-in window（柔和登場）
  if (nowSec < first.arrivalSec) {
    const gap = first.arrivalSec - nowSec;
    if (gap > FADE_DURATION_S) return { lat: 0, lng: 0, alpha: 0, visible: false, waiting: false };
    const a = 1 - gap / FADE_DURATION_S;
    return { lat: first.lat, lng: first.lng, alpha: a, visible: true, waiting: true };
  }

  // 路線已結束：fade-out window（柔和退場）
  if (nowSec >= last.departureSec) {
    const gap = nowSec - last.departureSec;
    if (gap > FADE_DURATION_S) return { lat: 0, lng: 0, alpha: 0, visible: false, waiting: false };
    const a = 1 - gap / FADE_DURATION_S;
    return { lat: last.lat, lng: last.lng, alpha: a, visible: true, waiting: true };
  }

  const idx = findStopIndex(stops, nowSec);
  const p0 = stops[idx]!;
  const p1 = stops[idx + 1];

  if (!p1) {
    // 路線最後一站
    return { lat: p0.lat, lng: p0.lng, alpha: ACTIVE_ALPHA, visible: true, waiting: true };
  }

  const rawDwell = Math.max(0, p0.departureSec - p0.arrivalSec);
  const isShortDwell = rawDwell < DWELL_THRESHOLD_S;

  // 算 movement window 的時間範圍：
  //   short_dwell：moveStart = p0.arrival, dt = p1.arrival - p0.arrival（整段移動，無停留）
  //   long_dwell ：moveStart = p0.departure, dt = p1.arrival - p0.departure
  //                若 dt < MIN_MOVE_S 從 dwell 後段借（gap=0 case）
  let moveStart: number;
  let dt: number;
  if (isShortDwell) {
    moveStart = p0.arrivalSec;
    dt = p1.arrivalSec - p0.arrivalSec;
  } else {
    moveStart = p0.departureSec;
    dt = p1.arrivalSec - moveStart;
    if (dt < MIN_MOVE_S) {
      // gap=0：從 dwell 後段借 MIN_MOVE_S（DWELL_THRESHOLD_S 已保證 dwell 夠借）
      const borrow = Math.min(MIN_MOVE_S - dt, rawDwell - DWELL_THRESHOLD_S);
      moveStart -= Math.max(0, borrow);
      dt = p1.arrivalSec - moveStart;
    }
  }

  // 跨班次：gap > TRIP_BREAK_S → fade out @ p0 → invisible → fade in @ p1
  if (dt > TRIP_BREAK_S) {
    const sinceMove = nowSec - moveStart;
    const untilArrival = p1.arrivalSec - nowSec;
    if (sinceMove < FADE_DURATION_S) {
      const a = 1 - sinceMove / FADE_DURATION_S;
      return { lat: p0.lat, lng: p0.lng, alpha: a, visible: a > 0, waiting: true };
    }
    if (untilArrival < FADE_DURATION_S) {
      const a = 1 - untilArrival / FADE_DURATION_S;
      return { lat: p1.lat, lng: p1.lng, alpha: a, visible: a > 0, waiting: true };
    }
    return { lat: 0, lng: 0, alpha: 0, visible: false, waiting: false };
  }

  // long_dwell：尚未到 moveStart → 在 p0 停留（alpha 一致 1.0）
  if (!isShortDwell && nowSec < moveStart) {
    return { lat: p0.lat, lng: p0.lng, alpha: ACTIVE_ALPHA, visible: true, waiting: true };
  }

  // 移動：整段或 dwell 後 → p1（直線插值，避免 Catmull-Rom 反向 overshoot）
  const localT = dt > 0 ? Math.max(0, Math.min(1, (nowSec - moveStart) / dt)) : 0;
  return {
    lat: p0.lat + (p1.lat - p0.lat) * localT,
    lng: p0.lng + (p1.lng - p0.lng) * localT,
    alpha: ACTIVE_ALPHA,
    visible: true,
    waiting: false,
  };
}

// ── Scene ────────────────────────────────────────────────

export class WasteScheduleScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private alphaAttribute: THREE.InstancedBufferAttribute | null = null;
  private maxInstances: number;
  private isDarkTheme = true;
  private orbScale = 0.000020;
  private altOffset = 0;

  /** instanceIndex → route + 當下 frame debug info（給 picking 顯示）*/
  private debugByInstance = new Map<number, ScheduleDebugFrame>();

  /**
   * 對外快照：執勤中車的 Mercator 位置（給 WasteMusicNoteScene 用）。
   * Schedule 沒有 GPS 的 collecting/parked 狀態切分，所有 visible 車都當「執勤中」噴音符。
   * 用 `vehicle_no` 欄位重 use WasteMusicNoteScene 的 spawnFromTrucks 簽名（實際填 routeId）。
   */
  private activePositions: Array<{ vehicle_no: string; x: number; y: number; z: number }> = [];

  private lastMatrix: THREE.Matrix4 | null = null;
  private _dummy = new THREE.Matrix4();
  private _color = new THREE.Color(WASTE_SCHEDULE_COLOR);

  constructor(maxInstances = 20000) {
    this.maxInstances = maxInstances;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
  }

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;

    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.alphaAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances).fill(1),
      1,
    );
    this.alphaAttribute.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aAlpha", this.alphaAttribute);

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float aAlpha;\nvarying float vAlpha;\n" +
        shader.vertexShader.replace(
          /void\s+main\s*\(\s*\)\s*\{/,
          "void main() {\n  vAlpha = aAlpha;",
        );
      shader.fragmentShader =
        "varying float vAlpha;\n" +
        shader.fragmentShader.replace(
          /\}\s*$/,
          "  gl_FragColor.a *= vAlpha;\n}",
        );
    };

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances * 3),
      3,
    );
    // 全部 instance 預先填同色（淡紫）— 表定圖層不分 status 顏色
    const baseColor = this.isDarkTheme
      ? this._color.clone().multiplyScalar(1.4)
      : this._color.clone();
    for (let i = 0; i < this.maxInstances; i++) {
      this.instancedMesh.instanceColor.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
    }
    this.scene.add(this.instancedMesh);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    if (!this.instancedMesh) return;
    const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
    mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
    mat.opacity = isDark ? 0.85 : 0.7;
    // 重新填色
    const baseColor = isDark
      ? this._color.clone().multiplyScalar(1.4)
      : this._color.clone();
    if (this.instancedMesh.instanceColor) {
      for (let i = 0; i < this.maxInstances; i++) {
        this.instancedMesh.instanceColor.setXYZ(i, baseColor.r, baseColor.g, baseColor.b);
      }
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }

  setOrbScale(scale: number) { this.orbScale = scale; }
  setAltitudeOffset(offset: number) { this.altOffset = offset; }

  /**
   * 每幀呼叫：對每條 route 用「當日 wall-clock 秒」插值。
   * @param routes 已分組的表定路線
   * @param currentTimeSec timeStore unix epoch 秒（replay 時 = 歷史時間）
   */
  update(routes: WasteScheduleRoute[], currentTimeSec: number) {
    if (!this.instancedMesh || !this.alphaAttribute) return;

    const nowSec = unixToWallClockSec(currentTimeSec);
    const dummy = this._dummy;
    const baseScale = this.orbScale * 0.5;
    let count = 0;
    this.debugByInstance.clear();
    this.activePositions = [];

    for (const route of routes) {
      if (count >= this.maxInstances) break;
      if (route.stops.length === 0) continue;

      const frame = interpolateRoute(route.stops, nowSec);
      if (!frame.visible) continue;

      const target = toMercator(frame.lat, frame.lng, this.altOffset);

      // 執勤中 size 一致（停留 / 移動不切換大小，避免眼睛感受到高頻變化）
      const s = baseScale;
      dummy.makeScale(s, s, s);
      dummy.setPosition(target.x, target.y, target.z);
      this.instancedMesh.setMatrixAt(count, dummy);
      this.alphaAttribute.setX(count, frame.alpha);

      // 暴露給音符 scene（schedule 全部 visible 車都當執勤中）
      if (frame.alpha > 0.5) {
        this.activePositions.push({
          vehicle_no: `${route.city}:${route.routeId}`,
          x: target.x, y: target.y, z: target.z,
        });
      }

      // 給 picking 用：保存當下幀在 stops 中的位置資訊
      const stops = route.stops;
      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      let state: ScheduleDebugFrame["state"];
      let segmentIdx: number;
      let prevStop: WasteScheduleStop;
      let nextStop: WasteScheduleStop | null;
      let gapToNextSec: number;
      if (nowSec < first.arrivalSec) {
        state = "before-route";
        segmentIdx = -1;
        prevStop = first;
        nextStop = stops[1] ?? null;
        gapToNextSec = first.arrivalSec - nowSec;
      } else if (nowSec >= last.departureSec) {
        state = "after-route";
        segmentIdx = stops.length - 1;
        prevStop = last;
        nextStop = null;
        gapToNextSec = 0;
      } else {
        const idx = findStopIndex(stops, nowSec);
        segmentIdx = idx;
        prevStop = stops[idx]!;
        nextStop = stops[idx + 1] ?? null;
        gapToNextSec = nextStop ? nextStop.arrivalSec - prevStop.departureSec : 0;
        state = frame.waiting ? "waiting" : "moving";
      }

      this.debugByInstance.set(count, {
        route,
        nowSec,
        segmentIdx,
        prevStop,
        nextStop,
        gapToNextSec,
        state,
        totalStops: stops.length,
      });
      count++;
    }

    this.instancedMesh.count = count;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.alphaAttribute.needsUpdate = true;
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    if (!this.lastMatrix) this.lastMatrix = new THREE.Matrix4();
    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  getVisibleCount(): number { return this.instancedMesh?.count ?? 0; }

  /** 給 WasteMusicNoteScene 讀目前執勤中車（Mercator 位置） */
  getActivePositions() {
    return this.activePositions;
  }

  /** 點擊拾取：返回當下 frame 的 route + debug info */
  pickRoute(screenX: number, screenY: number, viewWidth: number, viewHeight: number): ScheduleDebugFrame | null {
    if (!this.lastMatrix || !this.instancedMesh) return null;
    const threshold = 25;
    let closest: { info: ScheduleDebugFrame; dist: number } | null = null;
    const mat = new THREE.Matrix4();
    for (const [idx, info] of this.debugByInstance) {
      this.instancedMesh.getMatrixAt(idx, mat);
      const v = new THREE.Vector4(mat.elements[12], mat.elements[13], mat.elements[14], 1.0);
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;
      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const dist = Math.hypot(sx - screenX, sy - screenY);
      if (dist < threshold && (!closest || dist < closest.dist)) {
        closest = { info, dist };
      }
    }
    return closest?.info ?? null;
  }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.renderer?.dispose();
    this.debugByInstance.clear();
  }
}
