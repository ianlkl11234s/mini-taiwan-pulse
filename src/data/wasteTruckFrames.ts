/**
 * 垃圾車 GPS 軌跡的時間插值（R6 段 3 從 `three/WasteTruckScene.ts` 原樣抽出，不依賴 three）。
 *
 * Three.js 立體模式（WasteTruckScene）與 Mapbox 平面模式（flatMovingLayers）共用同一份算式：
 *   - 若 row.matched 存在：走 progress-based interpolation，沿 OSRM matched polyline 移動
 *   - 若 matched 不存在：GPS 插值（三種模式）
 *       1. Catmull-Rom spline（短距離 & 同 trip）→ 平滑曲線經過點
 *       2. Linear lerp（長距離但同 trip）→ 補沒有 GPS 點的區間，避免淡出跳點
 *       3. Teleport fade（跨 trip）→ alpha 0.5 前淡出舊、後淡入新
 * 平滑＝資料插值（每幀依時間重算位置），不是 CSS／GL transition。
 */
import { interpolateOnLineString, bearingDeg } from "../engines/railUtils";
import type {
  WasteMatchedTrail,
  WasteMatchedProgressPoint,
  WasteTrailRow,
  WasteTrailPoint,
  WasteStatus,
} from "./wasteLoader";

// VIEW_LAG_SECONDS：視覺時間落後真實時間幾秒
//   trail 範圍 [now-3600s, now]，但 collector 每 2 分鐘才寫一筆，
//   trail 末端離 now 還有 0~120s 的「未來空檔」。
//   讓視覺時間落後 300s（5 分鐘）→ nowSec 永遠落在 trail 中段，前後都有點可插值，
//   垃圾車就會持續沿過去 5~65 分鐘前的軌跡平滑移動。
//   對 2 分鐘取樣的垃圾車，5 分鐘延遲在感受上幾乎等於即時。
export const VIEW_LAG_SECONDS = 300;

const LINEAR_HOP_THRESHOLD_M   = 120;   // 同 trip 但距離較長 → linear，避免 Catmull-Rom overshoot
const STALE_DATA_THRESHOLD_S   = 300;   // 過去 5 分鐘沒更新 → 半透明
const HARD_STALE_THRESHOLD_S   = 1200;  // 過去 20 分鐘沒更新 → 不顯示（車輛離線太久）
const MATCHED_SEGMENT_FADE_S   = 45;    // matched rows 是 trip/segment 粒度，段外只做短 fade，避免重複車影

// ── 數學工具 ──────────────────────────────────────────────

/** 兩經緯度間距離（米），haversine */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export interface WasteTruckFrame {
  lat: number;
  lng: number;
  status: WasteStatus;
  alpha: number;
  visible: boolean;
}

/** 對單車 trail 算當前時刻的位置/狀態 */
export function interpolateWasteTrail(trail: WasteTrailPoint[], nowSec: number): WasteTruckFrame {
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
export function interpolateWasteMatchedTrail(matched: WasteMatchedTrail, nowSec: number): WasteTruckFrame {
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

/**
 * 依時間軸時間決定插值用的「視覺時間」。
 * currentTimeSec 若貼近真實現在（±30s），視為 live，套 5 分鐘 visual lag；
 * 若是 timeline replay 的歷史時間，直接使用該時間，讓播放/倍速可見。
 */
export function wasteVisualTimeSec(currentTimeSec: number | undefined, nowMs: number): number {
  const liveNowSec = nowMs / 1000;
  const clockSec = currentTimeSec ?? liveNowSec;
  const isLiveClock = Math.abs(clockSec - liveNowSec) < 30;
  return isLiveClock ? liveNowSec - VIEW_LAG_SECONDS : clockSec;
}

/** 單車在 nowSec 的插值結果；沒有可用軌跡回 null（與舊 Scene 的 `continue` 相同條件）。 */
export function wasteTruckFrameAt(row: WasteTrailRow, nowSec: number): WasteTruckFrame | null {
  const matched = row.matched;
  const hasMatched = !!matched && matched.polyline.length >= 2 && matched.timeline.length >= 2;
  if (!hasMatched && row.trail.length === 0) return null;
  return hasMatched ? interpolateWasteMatchedTrail(matched, nowSec) : interpolateWasteTrail(row.trail, nowSec);
}

/** 方位角取樣間隔（秒）與最小位移（公尺）：位移太小（停車、收運中）不給方向 */
const BEARING_SAMPLE_S = 20;
const BEARING_MIN_MOVE_M = 3;

/**
 * 行進方位角（度，正北 0 順時針）：比較 nowSec 前後 20 秒的插值位置；不動或跨 trip 時回 null。
 * 純函式，暫停或拖時間軸時也能算出方向。
 */
export function wasteTruckBearing(row: WasteTrailRow, nowSec: number, frame: WasteTruckFrame): number | null {
  const prev = wasteTruckFrameAt(row, nowSec - BEARING_SAMPLE_S);
  if (prev?.visible && haversineMeters(prev.lat, prev.lng, frame.lat, frame.lng) >= BEARING_MIN_MOVE_M) {
    return bearingDeg([prev.lng, prev.lat], [frame.lng, frame.lat]);
  }
  const next = wasteTruckFrameAt(row, nowSec + BEARING_SAMPLE_S);
  if (next?.visible && haversineMeters(frame.lat, frame.lng, next.lat, next.lng) >= BEARING_MIN_MOVE_M) {
    return bearingDeg([frame.lng, frame.lat], [next.lng, next.lat]);
  }
  return null;
}

export interface WasteTruckPlacement {
  row: WasteTrailRow;
  frame: WasteTruckFrame;
  /** 只有 withBearing 時才計算 */
  bearing: number | null;
}

/**
 * 一幀所有可見車輛的位置（依 trails 順序、最多 maxCount 台；與舊 Scene 迴圈的截斷規則相同）。
 */
export function computeWasteTruckFrames(
  trails: readonly WasteTrailRow[],
  nowSec: number,
  opts: { maxCount?: number; withBearing?: boolean } = {},
): WasteTruckPlacement[] {
  const max = opts.maxCount ?? Infinity;
  const out: WasteTruckPlacement[] = [];
  for (const row of trails) {
    if (out.length >= max) break;
    const frame = wasteTruckFrameAt(row, nowSec);
    if (!frame || !frame.visible) continue;
    out.push({ row, frame, bearing: opts.withBearing ? wasteTruckBearing(row, nowSec, frame) : null });
  }
  return out;
}

const PATH_BREAK_M = 500;

/**
 * 點選車輛的近段軌跡（平面模式只畫點選的那台）：nowSec 往前 windowSec 秒，每 stepSec 取一個插值點。
 * 跨 trip（teleport）或不可見的時段斷開，回傳多段折線。
 */
export function wasteTruckRecentPath(
  row: WasteTrailRow,
  nowSec: number,
  windowSec = 600,
  stepSec = 15,
): [number, number][][] {
  const lines: [number, number][][] = [];
  let cur: [number, number][] = [];
  const flush = () => { if (cur.length >= 2) lines.push(cur); cur = []; };
  for (let t = nowSec - windowSec; t <= nowSec + 1e-6; t += stepSec) {
    const f = wasteTruckFrameAt(row, Math.min(t, nowSec));
    if (!f || !f.visible || f.alpha <= 0) { flush(); continue; }
    const prev = cur[cur.length - 1];
    // 一步跳太遠＝跨 trip 瞬移（teleport fade），斷開不連線
    if (prev && haversineMeters(prev[1], prev[0], f.lat, f.lng) > PATH_BREAK_M) flush();
    cur.push([f.lng, f.lat]);
  }
  flush();
  return lines;
}
