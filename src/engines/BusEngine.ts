/**
 * 公車即時引擎 — GPS snap + 沿線插值
 *
 * 與鐵路引擎不同：鐵路靠時刻表插值，公車靠 GPS 位置 snap 到路線上，
 * 兩次 poll 之間依速度沿路線推進。
 */

import type { BusCity, BusRouteData, BusRouteGeometry, BusPosition, BusVehicle, BusTrail, TrailPoint } from "../types";
import { interpolateOnLineString } from "./railUtils";

/** 公車最大合理速度 (km/h)，超過視為 GPS 異常 */
const MAX_BUS_SPEED_KMH = 90;
const KM_PER_DEG = 111.0;

/** 過濾 trail 中的 GPS 異常點（逐點速度閾值，同 shipLoader 模式） */
function filterTrailAnomalies(path: TrailPoint[]): TrailPoint[] {
  if (path.length < 2) return path;
  const filtered: TrailPoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const prev = filtered[filtered.length - 1]!;
    const cur = path[i]!;
    const dtHours = (cur[3] - prev[3]) / 3600;
    if (dtHours > 0) {
      const dLat = (cur[0] - prev[0]) * KM_PER_DEG;
      const dLng = (cur[1] - prev[1]) * KM_PER_DEG * 0.91; // cos(25°) ≈ 0.91
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      const speedKmh = distKm / dtHours;
      if (speedKmh > MAX_BUS_SPEED_KMH) continue; // GPS 跳躍，丟棄
    }
    filtered.push(cur);
  }
  return filtered;
}

/** 速度低於此值 (km/h) 視為停靠 */
const STOPPED_SPEED_THRESHOLD = 3;

/** GPS 資料超過此秒數視為過期（開發階段放寬，collector 正常時改回 600） */
const STALE_THRESHOLD = 86400; // 24 小時

/** 公車顏色 palette — 依路線 hash 取色 */
const BUS_PALETTE = [
  "#4fc3f7", "#81c784", "#ffb74d", "#f06292",
  "#ba68c8", "#4dd0e1", "#aed581", "#ff8a65",
  "#7986cb", "#fff176", "#80deea", "#ef9a9a",
];

function hashColor(routeUid: string): string {
  let h = 0;
  for (let i = 0; i < routeUid.length; i++) {
    h = (h * 31 + routeUid.charCodeAt(i)) | 0;
  }
  return BUS_PALETTE[Math.abs(h) % BUS_PALETTE.length]!;
}

/** 點投影到 LineString 最近處，回傳 progress [0,1] */
function snapToRoute(
  lat: number,
  lng: number,
  route: BusRouteGeometry,
): { progress: number; dist: number } {
  const coords = route.coords;
  const cumDist = route.cumDist;
  const total = route.totalDist;
  if (coords.length < 2 || total === 0) return { progress: 0, dist: Infinity };

  let bestDist = Infinity;
  let bestProgress = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const ax = coords[i]![0], ay = coords[i]![1];
    const bx = coords[i + 1]![0], by = coords[i + 1]![1];
    const dx = bx - ax, dy = by - ay;
    const segLen2 = dx * dx + dy * dy;

    let t = 0;
    if (segLen2 > 0) {
      t = ((lng - ax) * dx + (lat - ay) * dy) / segLen2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }

    const px = ax + t * dx;
    const py = ay + t * dy;
    const d2 = (lng - px) * (lng - px) + (lat - py) * (lat - py);

    if (d2 < bestDist) {
      bestDist = d2;
      const segStart = cumDist[i]!;
      const segEnd = cumDist[i + 1]!;
      bestProgress = (segStart + t * (segEnd - segStart)) / total;
    }
  }

  return { progress: bestProgress, dist: Math.sqrt(bestDist) };
}

/** Replay 模式預計算的路線 progress 時間軸點 */
interface ProgressPoint {
  ts: number;
  progress: number;
  /** 趟次 id：progress 倒退 >30% 或時間 gap >15min 時遞增 */
  tripId: number;
}

/** Trip segmentation / progress 異常偵測參數 */
const TRIP_GAP_SECONDS = 900;        // > 15 分鐘視為新趟次
const TRIP_BACKWARD_THRESHOLD = 0.3; // progress 倒退 >30% 視為新趟次（折返/回程）
const MIN_BACKWARD_TOLERANCE = 0.02; // GPS 誤差容忍：2% 以內的倒退視為正常
const MAX_ANOMALY_SPEED_KMH = 80;    // 路線上推進最高速度（計算最大合理 Δprogress）
const MAX_CONSECUTIVE_REJECTS = 3;   // 連續異常到此次數就接受新 GPS（避免卡住）
const FADE_SECONDS = 60;             // 淡入/淡出時長（秒）— 用於 trail 首尾與 trip 交界

/**
 * 把 GPS 軌跡投影到路線，產生 (ts, progress, tripId) 序列
 * - 倒退 >30% 或時間 gap >15min → 新 trip
 * - 單次異常 GPS（進退幅度不合理）→ 丟棄，但連續 3 次異常就接受（開新 trip）
 */
function buildProgressPath(path: TrailPoint[], route: BusRouteGeometry): ProgressPoint[] {
  const result: ProgressPoint[] = [];
  if (path.length === 0) return result;
  const totalKm = Math.max(route.totalDist * 111, 0.5);
  let tripId = 0;
  let consecutiveRejects = 0;

  for (let i = 0; i < path.length; i++) {
    const pt = path[i]!;
    const lat = pt[0];
    const lng = pt[1];
    const ts = pt[3];
    const { progress } = snapToRoute(lat, lng, route);

    if (result.length === 0) {
      result.push({ ts, progress, tripId });
      continue;
    }

    const last = result[result.length - 1]!;
    const dt = ts - last.ts;
    const dp = progress - last.progress;

    // ── Trip 邊界 ──
    if (dt > TRIP_GAP_SECONDS) {
      tripId++;
      consecutiveRejects = 0;
      result.push({ ts, progress, tripId });
      continue;
    }
    if (dp <= -TRIP_BACKWARD_THRESHOLD) {
      tripId++;
      consecutiveRejects = 0;
      result.push({ ts, progress, tripId });
      continue;
    }

    // ── 異常偵測 ──
    // 最大合理前進量：MAX_ANOMALY_SPEED_KMH × dt / totalKm，1.5 倍安全係數，最少 10%
    const maxForward = Math.max((MAX_ANOMALY_SPEED_KMH * dt / 3600) / totalKm * 1.5, 0.1);
    const isAnomaly =
      dp > maxForward ||
      (dp < -MIN_BACKWARD_TOLERANCE && dp > -TRIP_BACKWARD_THRESHOLD);

    if (isAnomaly && consecutiveRejects < MAX_CONSECUTIVE_REJECTS) {
      consecutiveRejects++;
      continue;
    }

    // 連續異常達上限 → 接受此點，視為新 trip（GPS 真的偏了或換線）
    if (isAnomaly) {
      tripId++;
      consecutiveRejects = 0;
      result.push({ ts, progress, tripId });
      continue;
    }

    consecutiveRejects = 0;
    result.push({ ts, progress, tripId });
  }

  return result;
}

interface SnappedBus {
  plateNumb: string;
  routeKey: string;
  progress: number;
  progressRate: number; // progress per second
  snapTime: number;
  snapLat: number;
  snapLng: number;
  speed: number;
  routeName: string;
  routeUid: string;
  direction: number;
  color: string;
  city: BusCity;
  /** 連續被判 progress 跳躍的次數，達上限就接受新 GPS */
  rejectStreak: number;
  /** 此車首次進入系統的時間（unix 秒），用於 Live 淡入效果 */
  appearTs: number;
}

/** Replay mode 內部狀態 */
interface ReplayBus {
  path: TrailPoint[];
  /** 預計算的 progress 時間軸（有 routeKey 時才有） */
  progressPath?: ProgressPoint[];
  routeKey: string | null;
  routeUid: string;
  /** 用於 routeKey 為 null 時後續重試 resolve（路線晚到的 race） */
  direction: number;
  routeName: string;
  color: string;
  city: BusCity;
}

export class BusEngine {
  private cityRoutes = new Map<BusCity, BusRouteData>();
  private mergedRoutes = new Map<string, BusRouteGeometry>();
  private mergedIndex = new Map<string, string[]>();
  private snapped = new Map<string, SnappedBus>();
  /** 快取 plateNumb → routeKey 配對結果 */
  private routeMatch = new Map<string, string | null>();
  /** Replay mode 歷史軌跡 */
  private replayTrails = new Map<string, ReplayBus>();

  constructor() {}

  /** 新增或更新某城市的路線資料 */
  addCityRoutes(city: BusCity, data: BusRouteData): void {
    this.cityRoutes.set(city, data);
    for (const [key, geom] of data.routes) {
      this.mergedRoutes.set(key, geom);
    }
    for (const [routeUid, keys] of data.routeIndex) {
      const existing = this.mergedIndex.get(routeUid) ?? [];
      const merged = Array.from(new Set([...existing, ...keys]));
      this.mergedIndex.set(routeUid, merged);
    }
    this.routeMatch.clear();
    // 路線載入晚於 trail ingest 的 race：補建缺失的 progressPath
    this.ensureProgressPaths();
  }

  /**
   * 確保所有 replay trail 都有 progressPath（路線載入後補救）
   * - routeKey 為 null 的 trail 重跑 resolveRouteKey
   * - 有 routeKey 但沒 progressPath 的，build
   */
  private ensureProgressPaths(): void {
    if (this.replayTrails.size === 0) return;
    let resolved = 0;
    let built = 0;
    for (const bus of this.replayTrails.values()) {
      if (!bus.routeKey && bus.routeUid) {
        const key = this.resolveRouteKey(bus.routeUid, bus.direction);
        if (key) {
          bus.routeKey = key;
          resolved++;
        }
      }
      if (bus.routeKey && !bus.progressPath) {
        const route = this.mergedRoutes.get(bus.routeKey);
        if (route) {
          const progressPath = buildProgressPath(bus.path, route);
          if (progressPath.length >= 2) {
            bus.progressPath = progressPath;
            built++;
          }
        }
      }
    }
    if (resolved > 0 || built > 0) {
      console.log(`[Bus] ensureProgressPaths: resolved ${resolved} routeKey, built ${built} progressPath (after route load)`);
    }
  }

  /** 移除某城市的路線資料 */
  removeCityRoutes(city: BusCity): void {
    const data = this.cityRoutes.get(city);
    if (!data) return;
    this.cityRoutes.delete(city);
    // 從 mergedRoutes 刪除該城市的 route keys
    for (const key of data.routes.keys()) {
      this.mergedRoutes.delete(key);
    }
    // 重建 mergedIndex
    this.mergedIndex.clear();
    for (const cityData of this.cityRoutes.values()) {
      for (const [routeUid, keys] of cityData.routeIndex) {
        const existing = this.mergedIndex.get(routeUid) ?? [];
        const merged = Array.from(new Set([...existing, ...keys]));
        this.mergedIndex.set(routeUid, merged);
      }
    }
    this.routeMatch.clear();
  }

  hasCityRoutes(city: BusCity): boolean {
    return this.cityRoutes.has(city);
  }

  /** 找到 bus_current row 對應的路線 key */
  private resolveRouteKey(routeUid: string, direction: number): string | null {
    const key1 = `${routeUid}_${direction}`;
    if (this.mergedRoutes.has(key1)) return key1;

    // fallback: routeIndex 查表
    const keys = this.mergedIndex.get(routeUid);
    if (keys) {
      for (const k of keys) {
        if (k.endsWith(`_${direction}`)) return k;
      }
      // 任一方向
      if (keys.length > 0) return keys[0]!;
    }
    return null;
  }

  /** 新的 poll 資料進來 */
  ingestPoll(positions: BusPosition[], now: number): void {
    const seen = new Set<string>();

    for (const pos of positions) {
      seen.add(pos.plateNumb);

      // 路線配對（快取）
      let routeKey = this.routeMatch.get(pos.plateNumb);
      if (routeKey === undefined) {
        routeKey = this.resolveRouteKey(pos.routeUid, pos.direction);
        this.routeMatch.set(pos.plateNumb, routeKey);
      }
      if (!routeKey) continue;

      // 如果路線變了（例如司機換線），清掉快取
      const existing = this.snapped.get(pos.plateNumb);
      if (existing && existing.routeUid !== pos.routeUid) {
        this.routeMatch.delete(pos.plateNumb);
        routeKey = this.resolveRouteKey(pos.routeUid, pos.direction);
        this.routeMatch.set(pos.plateNumb, routeKey);
        if (!routeKey) continue;
      }

      const route = this.mergedRoutes.get(routeKey);
      if (!route) continue;

      // Snap GPS → 路線
      const { progress } = snapToRoute(pos.lat, pos.lng, route);

      // 計算 progressRate: speed (km/h) → progress/s（totalDist 是度，1度 ≈ 111km）
      const totalDistKm = route.totalDist * 111;
      const speedKmPerSec = pos.speed / 3600;
      const progressRate = totalDistKm > 0 ? speedKmPerSec / totalDistKm : 0;

      // ── Progress 跳躍偵測 ──
      // 比較新 progress 與「基於上次位置、速度推進得到的 expected progress」，
      // 若偏離過大視為 GPS 漂移，沿用 prev（等下一次 poll 再看）。
      // 連續 rejectStreak 次異常就接受（避免卡住）。
      const prev = this.snapped.get(pos.plateNumb);
      if (prev && prev.routeKey === routeKey) {
        const elapsed = now - prev.snapTime;
        if (elapsed > 0 && elapsed < 600) {
          const totalKm = Math.max(totalDistKm, 0.5);
          // 使用當下/前次速度平均推進；若兩者都低，給 30km/h 下限（避免停車時判太嚴）
          const avgSpeed = Math.max((pos.speed + prev.speed) / 2, 30);
          const expectedForward = (avgSpeed * elapsed / 3600) / totalKm;
          // 容忍係數：前進 ×3、至少 10%；倒退容忍 3%（真折返會透過 direction 切換重置）
          const maxForward = Math.max(expectedForward * 3, 0.1);
          const maxBackward = 0.03;
          const dp = progress - prev.progress;

          const isAnomaly = dp > maxForward || dp < -maxBackward;
          if (isAnomaly && prev.rejectStreak < MAX_CONSECUTIVE_REJECTS) {
            // 保留 prev 位置，但把 rejectStreak 加 1 + 刷新 snapTime 讓時間持續推進
            this.snapped.set(pos.plateNumb, {
              ...prev,
              rejectStreak: prev.rejectStreak + 1,
            });
            continue;
          }
          // 連續異常達上限 → 接受新 GPS（可能是司機繞路/GPS 長期偏移）
        }
      }

      this.snapped.set(pos.plateNumb, {
        plateNumb: pos.plateNumb,
        routeKey,
        progress,
        progressRate,
        snapTime: now,
        snapLat: pos.lat,
        snapLng: pos.lng,
        speed: pos.speed,
        routeName: pos.routeName,
        routeUid: pos.routeUid,
        direction: pos.direction,
        color: hashColor(pos.routeUid),
        city: pos.city,
        rejectStreak: 0,
        appearTs: prev?.appearTs ?? now, // 新車記今天的首次時間，舊車沿用
      });
    }

    // 清理不再出現的車輛
    for (const key of this.snapped.keys()) {
      if (!seen.has(key)) {
        this.snapped.delete(key);
        this.routeMatch.delete(key);
      }
    }

    // debug: 首次 poll 或數量變化時輸出配對統計
    const matched = this.snapped.size;
    const unmatched = positions.length - matched;
    console.log(`[Bus] ingestPoll: ${positions.length} in → ${matched} matched, ${unmatched} unmatched`);
    if (unmatched > 0 && matched === 0) {
      // 印出前 3 筆 routeUid 供 debug
      const samples = positions.slice(0, 3).map(p => `${p.routeUid}_${p.direction}`);
      const routeKeys = Array.from(this.mergedRoutes.keys()).slice(0, 3);
      console.log("[Bus] Sample bus routeKeys:", samples);
      console.log("[Bus] Sample map routeKeys:", routeKeys);
    }
  }

  /** 每 frame 呼叫，自動判斷 live/replay */
  update(unixTimestamp: number): BusVehicle[] {
    if (this.replayTrails.size > 0) return this.updateReplay(unixTimestamp);
    return this.updateLive(unixTimestamp);
  }

  // ── Live mode ──

  private updateLive(unixTimestamp: number): BusVehicle[] {
    const buses: BusVehicle[] = [];

    for (const bus of this.snapped.values()) {
      const elapsed = unixTimestamp - bus.snapTime;

      // 過期資料跳過
      if (elapsed > STALE_THRESHOLD || elapsed < -60) continue;

      const route = this.mergedRoutes.get(bus.routeKey);
      if (!route) continue;

      // 沿路線推進
      let progress = bus.progress + bus.progressRate * Math.max(elapsed, 0);
      if (progress > 1) progress = 1;
      if (progress < 0) progress = 0;

      const position = interpolateOnLineString(route.coords, progress);
      const stopped = bus.speed < STOPPED_SPEED_THRESHOLD;

      // 新車淡入：首次出現後 FADE 秒內漸顯
      const ageSinceAppear = unixTimestamp - bus.appearTs;
      const fadeAlpha = ageSinceAppear < FADE_SECONDS
        ? Math.max(0, ageSinceAppear / FADE_SECONDS)
        : 1;

      buses.push({
        plateNumb: bus.plateNumb,
        routeUid: bus.routeUid,
        routeName: bus.routeName,
        position,
        color: bus.color,
        status: stopped ? "stopped" : "running",
        speed: bus.speed,
        progress,
        direction: bus.direction,
        city: bus.city,
        fadeAlpha,
      });
    }

    return buses;
  }

  // ── Replay mode ──

  /** 載入歷史軌跡資料（切換日期時呼叫） */
  ingestTrails(trails: BusTrail[]): void {
    this.replayTrails.clear();
    let totalFiltered = 0;
    for (const trail of trails) {
      if (trail.path.length < 2) continue;
      // GPS 異常過濾（同 shipLoader 模式）
      const cleanPath = filterTrailAnomalies(trail.path);
      totalFiltered += trail.path.length - cleanPath.length;
      if (cleanPath.length < 2) continue;
      trail.path = cleanPath;

      // 路線配對：直接用 trail 的 direction（DB 端已按 direction 分 trail）
      const routeKey = trail.routeUid
        ? this.resolveRouteKey(trail.routeUid, trail.direction)
        : null;

      // 有路線 → 預計算 progress 時間軸（含 trip segmentation + 異常過濾）
      let progressPath: ProgressPoint[] | undefined;
      if (routeKey) {
        const route = this.mergedRoutes.get(routeKey);
        if (route) {
          progressPath = buildProgressPath(cleanPath, route);
          if (progressPath.length < 2) progressPath = undefined;
        }
      }

      // key = plateNumb_direction（同車不同方向是獨立 trail）
      const trailKey = `${trail.plateNumb}_${trail.direction}`;
      this.replayTrails.set(trailKey, {
        path: trail.path,
        progressPath,
        routeKey,
        routeUid: trail.routeUid ?? "",
        direction: trail.direction,
        routeName: trail.routeName ?? "",
        color: hashColor(trail.routeUid ?? trail.plateNumb),
        city: (trail.city ?? "Taipei") as BusCity,
      });
    }
    const withProgress = Array.from(this.replayTrails.values()).filter(b => b.progressPath).length;
    console.log(`[Bus] ingestTrails: ${trails.length} → ${this.replayTrails.size} (${withProgress} with progressPath), filtered ${totalFiltered} anomalous points`);
  }

  /**
   * Binary search 找 trail 中 ts 的位置，用 Catmull-Rom spline 插值
   * 當相鄰點間距差異過大時退回線性插值，避免 spline 抄捷徑
   */
  private interpolateTrail(path: TrailPoint[], ts: number): [number, number] | null {
    if (path.length < 2) return null;
    if (ts < path[0]![3] || ts > path[path.length - 1]![3]) return null;

    // Binary search 找到 path[lo].ts <= ts < path[hi].ts
    let lo = 0, hi = path.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (path[mid]![3] <= ts) lo = mid; else hi = mid;
    }

    const p1 = path[lo]!;
    const p2 = path[hi]!;
    const dt = p2[3] - p1[3];

    // Gap guard：兩點間隔 > 15 分鐘視為不同趟次，不插值
    if (dt > 900) return null;

    const t = dt > 0 ? (ts - p1[3]) / dt : 0;

    // p1-p2 間距（度）
    const segDist = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);

    // 距離太小（靜止）或路徑只有 2-3 個點 → 線性插值
    if (path.length <= 3 || segDist < 0.0001) {
      return [
        p1[0] + (p2[0] - p1[0]) * t,
        p1[1] + (p2[1] - p1[1]) * t,
      ];
    }

    // 4 控制點
    const p0 = path[Math.max(lo - 1, 0)]!;
    const p3 = path[Math.min(hi + 1, path.length - 1)]!;

    // Overshoot guard：如果前段或後段間距比本段大 3 倍以上 → 退回線性
    const d01 = Math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2);
    const d23 = Math.sqrt((p3[0] - p2[0]) ** 2 + (p3[1] - p2[1]) ** 2);
    if (d01 > segDist * 3 || d23 > segDist * 3) {
      return [
        p1[0] + (p2[0] - p1[0]) * t,
        p1[1] + (p2[1] - p1[1]) * t,
      ];
    }

    // Catmull-Rom spline
    const t2 = t * t;
    const t3 = t2 * t;
    let lat = 0.5 * (
      2 * p1[0]
      + (-p0[0] + p2[0]) * t
      + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
      + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
    );
    let lng = 0.5 * (
      2 * p1[1]
      + (-p0[1] + p2[1]) * t
      + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
      + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
    );

    // 最終 clamp：結果不能離 p1-p2 線段太遠（超過 segDist → 退回線性）
    const midLat = p1[0] + (p2[0] - p1[0]) * t;
    const midLng = p1[1] + (p2[1] - p1[1]) * t;
    const deviation = Math.sqrt((lat - midLat) ** 2 + (lng - midLng) ** 2);
    if (deviation > segDist * 0.5) {
      lat = midLat;
      lng = midLng;
    }

    return [lat, lng];
  }

  /**
   * 在預計算的 progress 時間軸上插值，同時計算 fade alpha：
   *   - trail 頭部（ts 在 start 前 FADE 秒內）→ 淡入，位置固定在 start
   *   - trail 尾部（ts 在 end 後 FADE 秒內）→ 淡出，位置固定在 end
   *   - 跨 trip 交界：前半 fade-out 停在舊 trip 終點；後半 fade-in 停在新 trip 起點
   *   - 同 trip 內正常 lerp，alpha=1
   * 回傳 null 表示該時刻公車完全不可見
   */
  private interpolateProgressPath(
    progressPath: ProgressPoint[],
    ts: number,
  ): { progress: number; alpha: number } | null {
    if (progressPath.length < 2) return null;

    const startTs = progressPath[0]!.ts;
    const endTs = progressPath[progressPath.length - 1]!.ts;

    // ── Trail 頭部 fade-in（ts 在第一筆點之前 FADE 秒內）──
    if (ts < startTs) {
      const gap = startTs - ts;
      if (gap > FADE_SECONDS) return null;
      return { progress: progressPath[0]!.progress, alpha: 1 - gap / FADE_SECONDS };
    }

    // ── Trail 尾部 fade-out（ts 在最後一筆點之後 FADE 秒內）──
    if (ts > endTs) {
      const gap = ts - endTs;
      if (gap > FADE_SECONDS) return null;
      return { progress: progressPath[progressPath.length - 1]!.progress, alpha: 1 - gap / FADE_SECONDS };
    }

    // Binary search
    let lo = 0, hi = progressPath.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (progressPath[mid]!.ts <= ts) lo = mid; else hi = mid;
    }

    const p1 = progressPath[lo]!;
    const p2 = progressPath[hi]!;
    const dt = p2.ts - p1.ts;

    // ── 跨 trip 交界：前半 fade-out 停在 p1，後半 fade-in 停在 p2 ──
    if (p1.tripId !== p2.tripId) {
      const elapsed = ts - p1.ts;       // 距離 p1 的時間
      const remaining = p2.ts - ts;     // 距離 p2 的時間
      // fade-out：從 p1 離開後 FADE 秒內，alpha 從 1 降到 0
      // fade-in：抵達 p2 前 FADE 秒內，alpha 從 0 升到 1
      const outAlpha = Math.max(0, 1 - elapsed / FADE_SECONDS);
      const inAlpha = Math.max(0, 1 - remaining / FADE_SECONDS);
      if (outAlpha === 0 && inAlpha === 0) return null; // 中間完全隱藏
      // 取較強者：決定這一刻顯示的是哪一端
      if (outAlpha >= inAlpha) {
        return { progress: p1.progress, alpha: outAlpha };
      }
      return { progress: p2.progress, alpha: inAlpha };
    }

    // ── 同 trip 內正常 lerp ──
    if (dt > TRIP_GAP_SECONDS) return null; // 保險
    if (dt <= 0) return { progress: p1.progress, alpha: 1 };
    const t = (ts - p1.ts) / dt;
    return { progress: p1.progress + (p2.progress - p1.progress) * t, alpha: 1 };
  }

  private updateReplay(ts: number): BusVehicle[] {
    const buses: BusVehicle[] = [];

    for (const [plateNumb, bus] of this.replayTrails) {
      // ── Path A：有 progressPath → progress lerp → LineString 插值（主路徑，絕對沿路線）──
      if (bus.progressPath && bus.routeKey) {
        const result = this.interpolateProgressPath(bus.progressPath, ts);
        if (!result) continue; // 完全在時間範圍外 or fade 已到 0 → 隱藏

        const route = this.mergedRoutes.get(bus.routeKey);
        if (!route) continue;

        const position = interpolateOnLineString(route.coords, result.progress);
        buses.push({
          plateNumb,
          routeUid: bus.routeUid,
          routeName: bus.routeName,
          position,
          color: bus.color,
          status: "running",
          speed: 0,
          progress: result.progress,
          direction: 0,
          city: bus.city,
          fadeAlpha: result.alpha,
        });
        continue;
      }

      // ── Path B：無路線配對 → 用原始 GPS 軌跡（舊路徑保留，最少見的 fallback）──
      const interp = this.interpolateTrail(bus.path, ts);
      if (!interp) continue;
      const [lat, lng] = interp;
      buses.push({
        plateNumb,
        routeUid: bus.routeUid,
        routeName: bus.routeName,
        position: [lng, lat],
        color: bus.color,
        status: "running",
        speed: 0,
        progress: 0,
        direction: 0,
        city: bus.city,
      });
    }

    return buses;
  }

  clearReplay(): void {
    this.replayTrails.clear();
  }

  getCount(): number {
    return this.replayTrails.size > 0 ? this.replayTrails.size : this.snapped.size;
  }

  dispose(): void {
    this.snapped.clear();
    this.routeMatch.clear();
    this.replayTrails.clear();
  }
}
