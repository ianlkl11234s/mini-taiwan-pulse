import * as THREE from "three";
import { toMercator } from "../utils/coordinates";
import { interpolateOnLineString } from "../engines/railUtils";
import {
  WASTE_STATUS_COLORS,
  type WasteMatchedTrail,
  type WasteMatchedProgressPoint,
  type WasteTrailRow,
  type WasteTrailPoint,
  type WasteStatus,
} from "../data/wasteLoader";

// 時間來源由 custom layer 傳入：
//   - replay：用 timeStore 時間，讓播放/倍速能驅動近 60 分鐘 trail
//   - live：timeStore 會貼近 Date.now()，再套 5 分鐘 visual lag
// Historical replay：useWasteLayer 會載入當天 day trail；matched 存在時沿 OSRM 路網 progress 移動。
//
// VIEW_LAG_SECONDS：視覺時間落後真實時間幾秒
//   trail 範圍 [now-3600s, now]，但 collector 每 2 分鐘才寫一筆，
//   trail 末端離 now 還有 0~120s 的「未來空檔」。
//   讓視覺時間落後 300s（5 分鐘）→ nowSec 永遠落在 trail 中段，前後都有點可插值，
//   垃圾車就會持續沿過去 5~65 分鐘前的軌跡平滑移動。
//   對 2 分鐘取樣的垃圾車，5 分鐘延遲在感受上幾乎等於即時。
const VIEW_LAG_SECONDS = 300;

/**
 * 垃圾車光球場景（方案 A 軌跡插值）
 *
 * 架構：
 *   - 接收 trails: WasteTrailRow[]（每車 ~30 點 GPS 軌跡）
 *   - 每幀用 timeStore.getTime() (= Date.now() in live) 在 trail 上時間插值
 *   - 若 row.matched 存在：走 progress-based interpolation，沿 OSRM matched polyline 移動
 *   - 若 matched 不存在：fallback 到既有 GPS 插值（三種插值模式）
 *       1. Catmull-Rom spline（短距離 & 同 trip）→ 平滑曲線經過點
 *       2. Linear lerp（長距離但同 trip）→ 補沒有 GPS 點的區間，避免淡出跳點
 *       3. Teleport fade（跨 trip）→ alpha 0.5 前淡出舊、後淡入新
 *
 *   - collecting 鎖定：stop snapping 已在後端處理（連續點吸到同 stop = 不動）
 *
 * 顏色：依 status 區分（collecting=琥珀，會噴音符）
 *
 * 多城市可復用：跟 city 無關，只看 trail 資料本身
 */

const LINEAR_HOP_THRESHOLD_M   = 120;   // 同 trip 但距離較長 → linear，避免 Catmull-Rom overshoot
const STALE_DATA_THRESHOLD_S   = 300;   // 過去 5 分鐘沒更新 → 半透明
const HARD_STALE_THRESHOLD_S   = 1200;  // 過去 20 分鐘沒更新 → 不顯示（車輛離線太久）
const MATCHED_SEGMENT_FADE_S   = 45;    // matched rows 是 trip/segment 粒度，段外只做短 fade，避免重複車影

// ── 數學工具 ──────────────────────────────────────────────

/** 兩經緯度間距離（米），haversine */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Catmull-Rom 1D，t in [0,1]，4 控制點 */
function catmullRom1D(pm1: number, p0: number, p1: number, p2: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p0) +
    (-pm1 + p1) * t +
    (2 * pm1 - 5 * p0 + 4 * p1 - p2) * t2 +
    (-pm1 + 3 * p0 - 3 * p1 + p2) * t3
  );
}

/** Binary search 找 nowSec 在 trail 中的 segment index（第 i 點 ≤ nowSec < 第 i+1 點） */
function findSegmentIndex(trail: WasteTrailPoint[], nowSec: number): number {
  if (trail.length === 0) return -2;
  if (nowSec < trail[0]!.t) return -1;          // before start
  if (nowSec >= trail[trail.length - 1]!.t) return trail.length - 1; // after end
  let lo = 0, hi = trail.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (trail[mid]!.t <= nowSec) lo = mid;
    else hi = mid;
  }
  return lo;
}

function findMatchedSegmentIndex(timeline: WasteMatchedProgressPoint[], nowSec: number): number {
  if (timeline.length === 0) return -2;
  if (nowSec < timeline[0]!.t) return -1;
  if (nowSec >= timeline[timeline.length - 1]!.t) return timeline.length - 1;
  let lo = 0, hi = timeline.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid]!.t <= nowSec) lo = mid;
    else hi = mid;
  }
  return lo;
}

interface InterpolatedFrame {
  lat: number;
  lng: number;
  status: WasteStatus;
  alpha: number;
  visible: boolean;
}

/** 對單車 trail 算當前時刻的位置/狀態 */
function interpolateTrail(trail: WasteTrailPoint[], nowSec: number): InterpolatedFrame {
  const idx = findSegmentIndex(trail, nowSec);
  if (idx === -2) return { lat: 0, lng: 0, status: "unknown", alpha: 0, visible: false };

  // before-start：trail 第一筆還在未來（很罕見，因為我們抓近 1hr，但 user 進來瞬間時間可能正好）
  if (idx === -1) {
    const p = trail[0]!;
    return { lat: p.lat, lng: p.lng, status: p.status, alpha: 0.4, visible: true };
  }

  const p0 = trail[idx]!;
  const p1 = trail[idx + 1];

  // after-end：trail 最後一筆已經過去
  if (!p1) {
    const elapsed = nowSec - p0.t;
    if (elapsed > HARD_STALE_THRESHOLD_S) {
      return { lat: p0.lat, lng: p0.lng, status: "offline", alpha: 0, visible: false };
    }
    const alpha = elapsed > STALE_DATA_THRESHOLD_S ? 0.45 : 1.0;
    return { lat: p0.lat, lng: p0.lng, status: p0.status, alpha, visible: true };
  }

  // 段內 t [0, 1]
  const dt = p1.t - p0.t;
  const localT = dt > 0 ? (nowSec - p0.t) / dt : 0;

  // 跨 trip break → teleport fade。距離遠但同 trip 則用線性插值補沒有 GPS 的區間。
  const distM = haversineMeters(p0.lat, p0.lng, p1.lat, p1.lng);
  const isTripBreak = p0.tripId !== p1.tripId;

  if (isTripBreak) {
    if (localT < 0.5) {
      // 前半：固定在 p0，淡出
      const a = Math.max(0, 1 - localT * 2);
      return { lat: p0.lat, lng: p0.lng, status: p0.status, alpha: a, visible: true };
    } else {
      // 後半：固定在 p1，淡入
      const a = Math.min(1, (localT - 0.5) * 2);
      return { lat: p1.lat, lng: p1.lng, status: p1.status, alpha: a, visible: true };
    }
  }

  if (distM > LINEAR_HOP_THRESHOLD_M) {
    return {
      lat: p0.lat + (p1.lat - p0.lat) * localT,
      lng: p0.lng + (p1.lng - p0.lng) * localT,
      status: p0.status,
      alpha: 1.0,
      visible: true,
    };
  }

  // 正常段：Catmull-Rom（同 trip 才能用相鄰點當控制點）
  const pm1Raw = idx > 0 ? trail[idx - 1] : null;
  const p2Raw  = idx + 2 < trail.length ? trail[idx + 2] : null;
  const pm1 = pm1Raw && pm1Raw.tripId === p0.tripId ? pm1Raw : p0;
  const p2  = p2Raw  && p2Raw.tripId  === p1.tripId ? p2Raw  : p1;

  const lat = catmullRom1D(pm1.lat, p0.lat, p1.lat, p2.lat, localT);
  const lng = catmullRom1D(pm1.lng, p0.lng, p1.lng, p2.lng, localT);

  return { lat, lng, status: p0.status, alpha: 1.0, visible: true };
}

/** 對 OSRM matched polyline + progress timeline 算當前位置。 */
function interpolateMatchedTrail(matched: WasteMatchedTrail, nowSec: number): InterpolatedFrame {
  const timeline = matched.timeline;
  const idx = findMatchedSegmentIndex(timeline, nowSec);
  if (idx === -2 || matched.polyline.length < 2) {
    return { lat: 0, lng: 0, status: "unknown", alpha: 0, visible: false };
  }

  if (idx === -1) {
    const p = timeline[0]!;
    const gap = p.t - nowSec;
    if (gap > MATCHED_SEGMENT_FADE_S) {
      return { lat: 0, lng: 0, status: p.status, alpha: 0, visible: false };
    }
    const [lng, lat] = interpolateOnLineString(matched.polyline, p.progress);
    return { lat, lng, status: p.status, alpha: 1 - gap / MATCHED_SEGMENT_FADE_S, visible: true };
  }

  const p0 = timeline[idx]!;
  const p1 = timeline[idx + 1];

  if (!p1) {
    const gap = nowSec - p0.t;
    if (gap > MATCHED_SEGMENT_FADE_S) {
      return { lat: 0, lng: 0, status: p0.status, alpha: 0, visible: false };
    }
    const [lng, lat] = interpolateOnLineString(matched.polyline, p0.progress);
    return { lat, lng, status: p0.status, alpha: 1 - gap / MATCHED_SEGMENT_FADE_S, visible: true };
  }

  const dt = p1.t - p0.t;
  const localT = dt > 0 ? (nowSec - p0.t) / dt : 0;

  if (p0.tripId !== p1.tripId) {
    const progress = localT < 0.5 ? p0.progress : p1.progress;
    const alpha = localT < 0.5 ? Math.max(0, 1 - localT * 2) : Math.min(1, (localT - 0.5) * 2);
    const [lng, lat] = interpolateOnLineString(matched.polyline, progress);
    return { lat, lng, status: localT < 0.5 ? p0.status : p1.status, alpha, visible: true };
  }

  const progress = p0.progress + (p1.progress - p0.progress) * localT;
  const [lng, lat] = interpolateOnLineString(matched.polyline, progress);
  return { lat, lng, status: p0.status, alpha: 1.0, visible: true };
}

// ── Scene ────────────────────────────────────────────────

export class WasteTruckScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private alphaAttribute: THREE.InstancedBufferAttribute | null = null;
  private maxInstances: number;
  private isDarkTheme = true;
  private orbScale = 0.000020;
  private altOffset = 0;

  private colorCache = new Map<string, THREE.Color>();
  /** instanceIndex → trail row (給 picking 用) */
  private trailIndex = new Map<number, WasteTrailRow>();
  /** 對外快照：collecting 中的 truck 已平滑後 Mercator 位置（給音符 scene 用） */
  private collectingPositions: Array<{ vehicle_no: string; x: number; y: number; z: number }> = [];

  private lastMatrix: THREE.Matrix4 | null = null;
  private _dummy = new THREE.Matrix4();

  constructor(maxInstances = 500) {
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
    this.scene.add(this.instancedMesh);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    this.colorCache.clear();
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.85 : 0.7;
    }
  }

  setOrbScale(scale: number) { this.orbScale = scale; }
  setAltitudeOffset(offset: number) { this.altOffset = offset; }

  private getColor(hex: string): THREE.Color {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      if (this.isDarkTheme) c.multiplyScalar(1.4);
      this.colorCache.set(hex, c);
    }
    return c;
  }

  /**
   * 每幀呼叫：用指定時間對每車軌跡做時間插值。
   *
   * currentTimeSec 若貼近真實現在，視為 live，套 5 分鐘 visual lag；
   * 若是 timeline replay 的歷史時間，直接使用該時間，讓播放/倍速可見。
   */
  update(trails: WasteTrailRow[], currentTimeSec?: number) {
    if (!this.instancedMesh) return;

    const liveNowSec = Date.now() / 1000;
    const clockSec = currentTimeSec ?? liveNowSec;
    const isLiveClock = Math.abs(clockSec - liveNowSec) < 30;
    // live 視覺時間落後真實時間 5 分鐘（讓 nowSec 落在 trail 中段，可雙向插值）
    const nowSec = isLiveClock ? liveNowSec - VIEW_LAG_SECONDS : clockSec;

    const dummy = this._dummy;
    const baseScale = this.orbScale * 0.5;
    let count = 0;
    this.trailIndex.clear();
    this.collectingPositions = [];

    for (const row of trails) {
      if (count >= this.maxInstances) break;
      const matched = row.matched;
      const hasMatched = !!matched && matched.polyline.length >= 2 && matched.timeline.length >= 2;
      if (!hasMatched && row.trail.length === 0) continue;

      const frame = hasMatched ? interpolateMatchedTrail(matched, nowSec) : interpolateTrail(row.trail, nowSec);
      if (!frame.visible) continue;

      const target = toMercator(frame.lat, frame.lng, this.altOffset);

      // 停車/離線縮小
      const sizeMul = frame.status === "parked" || frame.status === "offline" ? 0.6 : 1.0;
      const s = baseScale * sizeMul;
      dummy.makeScale(s, s, s);
      dummy.setPosition(target.x, target.y, target.z);
      this.instancedMesh.setMatrixAt(count, dummy);

      const colorHex = WASTE_STATUS_COLORS[frame.status] ?? "#9ca3af";
      const color = this.getColor(colorHex);
      this.instancedMesh.instanceColor!.setXYZ(count, color.r, color.g, color.b);

      // collecting → 暴露給音符 scene
      if (frame.status === "collecting" && frame.alpha > 0.5) {
        this.collectingPositions.push({
          vehicle_no: row.vehicle_no,
          x: target.x, y: target.y, z: target.z,
        });
      }

      // alpha：teleport 中 / stale 數據 自然降低
      if (this.alphaAttribute) {
        this.alphaAttribute.setX(count, frame.alpha);
      }

      this.trailIndex.set(count, row);
      count++;
    }

    this.instancedMesh.count = count;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    if (this.alphaAttribute) this.alphaAttribute.needsUpdate = true;
  }

  /** 給 WasteMusicNoteScene 讀目前正在收運的車（已是 Mercator） */
  getCollectingPositions() {
    return this.collectingPositions;
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

  pickTruck(screenX: number, screenY: number, viewWidth: number, viewHeight: number): WasteTrailRow | null {
    if (!this.lastMatrix || !this.instancedMesh) return null;
    const threshold = 25;
    let closest: { row: WasteTrailRow; dist: number } | null = null;
    const mat = new THREE.Matrix4();
    for (const [idx, row] of this.trailIndex) {
      this.instancedMesh.getMatrixAt(idx, mat);
      const v = new THREE.Vector4(mat.elements[12], mat.elements[13], mat.elements[14], 1.0);
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;
      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const dist = Math.hypot(sx - screenX, sy - screenY);
      if (dist < threshold && (!closest || dist < closest.dist)) {
        closest = { row, dist };
      }
    }
    return closest?.row ?? null;
  }

  getVisibleCount(): number { return this.instancedMesh?.count ?? 0; }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.renderer?.dispose();
    this.colorCache.clear();
    this.trailIndex.clear();
  }
}
