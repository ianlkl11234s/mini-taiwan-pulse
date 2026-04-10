/**
 * 公車即時引擎 — GPS snap + 沿線插值
 *
 * 與鐵路引擎不同：鐵路靠時刻表插值，公車靠 GPS 位置 snap 到路線上，
 * 兩次 poll 之間依速度沿路線推進。
 */

import type { BusRouteData, BusRouteGeometry, BusPosition, BusVehicle } from "../types";
import { interpolateOnLineString } from "./railUtils";

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
  speed: number;
  routeName: string;
  routeUid: string;
  direction: number;
  color: string;
}

export class BusEngine {
  private routeData: BusRouteData;
  private snapped = new Map<string, SnappedBus>();
  /** 快取 plateNumb → routeKey 配對結果 */
  private routeMatch = new Map<string, string | null>();

  constructor(routeData: BusRouteData) {
    this.routeData = routeData;
  }

  /** 找到 bus_current row 對應的路線 key */
  private resolveRouteKey(routeUid: string, direction: number): string | null {
    const key1 = `${routeUid}_${direction}`;
    if (this.routeData.routes.has(key1)) return key1;

    // fallback: routeIndex 查表
    const keys = this.routeData.routeIndex.get(routeUid);
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

      const route = this.routeData.routes.get(routeKey);
      if (!route) continue;

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
        speed: pos.speed,
        routeName: pos.routeName,
        routeUid: pos.routeUid,
        direction: pos.direction,
        color: hashColor(pos.routeUid),
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
      const routeKeys = Array.from(this.routeData.routes.keys()).slice(0, 3);
      console.log("[Bus] Sample bus routeKeys:", samples);
      console.log("[Bus] Sample map routeKeys:", routeKeys);
    }
  }

  private _debugOnce = false;

  /** 每 frame 呼叫，回傳插值後的公車位置 */
  update(unixTimestamp: number): BusVehicle[] {
    const buses: BusVehicle[] = [];

    if (!this._debugOnce && this.snapped.size > 0) {
      this._debugOnce = true;
      const first = this.snapped.values().next().value!;
      console.log(`[Bus] update debug: snapped=${this.snapped.size}, ts=${unixTimestamp.toFixed(0)}, snapTime=${first.snapTime.toFixed(0)}, elapsed=${(unixTimestamp - first.snapTime).toFixed(0)}s`);
    }

    for (const bus of this.snapped.values()) {
      const elapsed = unixTimestamp - bus.snapTime;

      // 過期資料跳過
      if (elapsed > STALE_THRESHOLD || elapsed < -60) continue;

      const route = this.routeData.routes.get(bus.routeKey);
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
      });
    }

    return buses;
  }

  getCount(): number {
    return this.snapped.size;
  }

  dispose(): void {
    this.snapped.clear();
    this.routeMatch.clear();
  }
}
