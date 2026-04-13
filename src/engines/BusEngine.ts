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
}

/** Replay mode 內部狀態 */
interface ReplayBus {
  path: TrailPoint[];
  routeKey: string | null;
  routeUid: string;
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

      // ── 異常過濾：GPS 跳躍偵測 ──
      const prev = this.snapped.get(pos.plateNumb);
      if (prev && prev.routeKey === routeKey) {
        const elapsed = now - prev.snapTime;
        if (elapsed > 0 && elapsed < 120) {
          // 預期最大移動距離（km）= speed * elapsed * 1.5 安全係數
          const maxDistKm = Math.max(pos.speed, prev.speed, 30) / 3600 * elapsed * 1.5;
          const dlat = pos.lat - prev.snapLat;
          const dlng = pos.lng - prev.snapLng;
          const actualDistKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
          if (actualDistKm > maxDistKm && actualDistKm > 0.5) {
            // GPS 跳躍：沿用上次位置，跳過此次更新
            continue;
          }
        }
      }

      // Snap GPS → 路線
      const { progress } = snapToRoute(pos.lat, pos.lng, route);

      // 計算 progressRate: speed (km/h) → progress/s
      // totalDist 是度，1度 ≈ 111km
      const totalDistKm = route.totalDist * 111;
      const speedKmPerSec = pos.speed / 3600;
      const progressRate = totalDistKm > 0 ? speedKmPerSec / totalDistKm : 0;

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
      // 路線配對：嘗試 direction 0 和 1，取 snap 距離較小的
      let routeKey: string | null = null;
      if (trail.routeUid) {
        const key0 = this.resolveRouteKey(trail.routeUid, 0);
        const key1 = this.resolveRouteKey(trail.routeUid, 1);
        if (key0 && key1) {
          const firstPt = trail.path[0]!;
          const route0 = this.mergedRoutes.get(key0)!;
          const route1 = this.mergedRoutes.get(key1)!;
          const d0 = snapToRoute(firstPt[0], firstPt[1], route0).dist;
          const d1 = snapToRoute(firstPt[0], firstPt[1], route1).dist;
          routeKey = d0 <= d1 ? key0 : key1;
        } else {
          routeKey = key0 ?? key1;
        }
      }
      this.replayTrails.set(trail.plateNumb, {
        path: trail.path,
        routeKey,
        routeUid: trail.routeUid ?? "",
        routeName: trail.routeName ?? "",
        color: hashColor(trail.routeUid ?? trail.plateNumb),
        city: (trail.city ?? "Taipei") as BusCity,
      });
    }
    console.log(`[Bus] ingestTrails: ${trails.length} → ${this.replayTrails.size} with routes, filtered ${totalFiltered} anomalous points`);
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

  private updateReplay(ts: number): BusVehicle[] {
    const buses: BusVehicle[] = [];

    for (const [plateNumb, bus] of this.replayTrails) {
      const interp = this.interpolateTrail(bus.path, ts);
      if (!interp) continue;

      const [lat, lng] = interp;
      // Replay 不走 snap-to-route：trail 包含去回程，單方向 snap 會在折返時跳躍
      // 直接用 Catmull-Rom 插值的 GPS 座標，搭配視覺 lerp 已足夠平滑
      const position: [number, number] = [lng, lat];

      buses.push({
        plateNumb,
        routeUid: bus.routeUid,
        routeName: bus.routeName,
        position,
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
