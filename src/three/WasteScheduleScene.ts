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
 * 最短移動 / 停留時間 (秒)
 *
 * Source data 兩種極端缺漏：
 *   (A) 高雄 / 臺北：departure_time = 下一站 arrival_time → gap=0，車瞬移
 *   (B) 新北：departure_time = arrival_time（fallback）→ dwell=0，車「過站不停」
 *
 * 修補：對每個 (p0, p1) 重新分配時間，目標讓車每站看得見「停留」+「移動」。
 *
 * MIN_DWELL_S = 30 (60x 下 0.5 視覺秒) — 短暫停留可辨識
 * MIN_MOVE_S  = 60 (60x 下 1 視覺秒) — 直線移動可辨識
 *
 * 若 dwell + gap < MIN_DWELL + MIN_MOVE 就按比例壓縮（罕見極端 case）。
 */
const MIN_DWELL_S      = 30;
const MIN_MOVE_S       = 60;

/**
 * Trip-break threshold (秒)
 *
 * 觀察到台北/新北一條 route_id 一天會跑「早班/中班/晚班」多段，中間 gap
 * 10min ~ 2hr 不等（DB 觀察：延平-2 stop 11→12 gap 6300s = 1.75hr）。
 *
 * 解法：相鄰 stops 時間 gap > TRIP_BREAK_S 視為跨班次：
 *   - p0.departure 之後 FADE_DURATION_S 內 → fade out @ p0
 *   - p1.arrival 之前 FADE_DURATION_S 內 → fade in @ p1
 *   - 中間時段完全 invisible（車不在路線上）
 *
 * 600s threshold：要 ≥ 2 × FADE_DURATION_S = 360s 才有真正 invisible 區段，
 * 取 10 min 確保大多數班次切換有「先淡出 → 看不到 → 再淡入」的清楚段落。
 * 5-10 min gap (1628 筆新北 / 165 筆台北) 視為班次內 slow movement，
 * 60x 下 5-10s 視覺直線飄，可接受。
 */
const TRIP_BREAK_S     = 600;

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
  /** true = 在 stop 等待中（停車），false = 移動中 */
  waiting: boolean;
}

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
    // 路線最後一站，但還在 p0 停留時段
    return { lat: p0.lat, lng: p0.lng, alpha: ACTIVE_ALPHA, visible: true, waiting: true };
  }

  // ── 重新分配 dwell + movement 時間 ──
  // Source data 兩種缺漏（A: gap=0 瞬移、B: dwell=0 過站不停）都靠這段對稱處理。
  const total      = p1.arrivalSec - p0.arrivalSec;
  const rawDwell   = Math.max(0, p0.departureSec - p0.arrivalSec);
  const rawGap     = Math.max(0, p1.arrivalSec - p0.departureSec);

  // Trip-break 在底下另判，這裡只處理「正常 segment」(rawGap ≤ TRIP_BREAK_S)
  // total ≤ 0 是稀有的退化資料 (arrival 同時)，車卡在 p0 直到下個 segment
  let targetDwell = Math.max(rawDwell, MIN_DWELL_S);
  let targetMove  = Math.max(rawGap, MIN_MOVE_S);
  if (total > 0 && targetDwell + targetMove > total) {
    // 時間不夠分配 MIN_DWELL+MIN_MOVE，按比例壓縮
    const ratio = total / (targetDwell + targetMove);
    targetDwell *= ratio;
    targetMove  *= ratio;
  }

  const dwellEnd  = p0.arrivalSec + targetDwell;
  const dt        = targetMove;
  const moveStart = dwellEnd;

  // 在 p0 等待（arrival ~ dwellEnd）— 即使 source dwell=0 也會看見短暫停留
  if (nowSec < moveStart) {
    return { lat: p0.lat, lng: p0.lng, alpha: ACTIVE_ALPHA, visible: true, waiting: true };
  }

  // 跨班次：兩個 stops 之間時間 gap > TRIP_BREAK_S → fade out @ p0、invisible、fade in @ p1
  // FADE_DURATION 設計成 60x 倍速下感受得到（180s 真實 ≈ 3 視覺秒）
  if (dt > TRIP_BREAK_S) {
    const sinceMove = nowSec - moveStart;
    const untilArrival = p1.arrivalSec - nowSec;
    if (sinceMove < FADE_DURATION_S) {
      // 在 p0 fade out
      const a = 1 - sinceMove / FADE_DURATION_S;
      return { lat: p0.lat, lng: p0.lng, alpha: a, visible: a > 0, waiting: true };
    }
    if (untilArrival < FADE_DURATION_S) {
      // 在 p1 fade in
      const a = 1 - untilArrival / FADE_DURATION_S;
      return { lat: p1.lat, lng: p1.lng, alpha: a, visible: a > 0, waiting: true };
    }
    // 中間：完全 invisible（車不在路線上）
    return { lat: 0, lng: 0, alpha: 0, visible: false, waiting: false };
  }

  // 同班次內：移動中（直線插值，v1 沒套 OSRM）— 執勤中 alpha 一致
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

  private lastMatrix: THREE.Matrix4 | null = null;
  private _dummy = new THREE.Matrix4();
  private _color = new THREE.Color(WASTE_SCHEDULE_COLOR);

  constructor(maxInstances = 1500) {
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
