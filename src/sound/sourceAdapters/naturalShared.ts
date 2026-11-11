/**
 * W5 自然聲源三族（風×植被、海浪×海岸、河川水聲）共用的小工具：
 * 範圍判定、最近測站、逐小時掃描（與 rainFieldAdapter 同規則：每個涵蓋到的小時都要有資料，否則 unknown）。
 */
import { haversineM } from "../engines/geometryDistance";
import type { AnySoundFamily, SourceContribution } from "../types";

/** [west, south, east, north] */
export type Bbox = readonly [number, number, number, number];

const M_PER_DEG = 111_195;

/** 接收點連同 radiusM 都在 bbox 內 */
export function insideBbox(lon: number, lat: number, b: Bbox, radiusM = 0): boolean {
  const dLat = radiusM / M_PER_DEG;
  const dLon = radiusM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return lon - dLon >= b[0] && lon + dLon <= b[2] && lat - dLat >= b[1] && lat + dLat <= b[3];
}

export interface StationPoint {
  stationId: string;
  stationName: string | null;
  lon: number;
  lat: number;
}

/** 最近測站（依 stationId 去重） */
export function nearestStation<T extends StationPoint>(rows: readonly T[], lon: number, lat: number): { station: T; distanceM: number } | null {
  let best: { station: T; distanceM: number } | null = null;
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.stationId)) continue;
    seen.add(r.stationId);
    const d = haversineM(lon, lat, r.lon, r.lat);
    if (!best || d < best.distanceM) best = { station: r, distanceM: d };
  }
  return best;
}

export const iso = (t: number) => new Date(t * 1000).toISOString();

export const stationLabel = (s: StationPoint, distanceM: number) =>
  `station:${s.stationName ?? s.stationId}(${s.stationId}) distance:${Math.round(distanceM)}m`;

export interface HourlyScan<T> {
  best: { row: T; potential: number } | null;
  firstUnknown: { hour: number; reason: string; row: T | null } | null;
  anyZero: boolean;
}

/**
 * 逐小時走過 [t0, t1]：rowAt(hour) 找該小時的列；evalRow 回潛勢或 unknown 原因。
 * 有任一小時 > 0 → best；否則有缺 → firstUnknown；全部 0 → anyZero（inactive）。
 */
export function scanHours<T>(
  t0: number,
  t1: number,
  bucketS: number,
  rowAt: (hour: number) => T | undefined,
  evalRow: (row: T) => { potential: number } | { reason: string },
  missingReason: string,
): HourlyScan<T> {
  const out: HourlyScan<T> = { best: null, firstUnknown: null, anyZero: false };
  const first = Math.floor(t0 / bucketS) * bucketS;
  for (let h = first; h <= t1; h += bucketS) {
    if (h + bucketS <= t0) continue;
    const row = rowAt(h);
    if (!row) {
      out.firstUnknown ??= { hour: h, reason: missingReason, row: null };
      continue;
    }
    const r = evalRow(row);
    if ("reason" in r) {
      out.firstUnknown ??= { hour: h, reason: r.reason, row };
      continue;
    }
    if (r.potential <= 0) {
      out.anyZero = true;
      continue;
    }
    if (!out.best || out.best.potential < r.potential) out.best = { row, potential: r.potential };
  }
  return out;
}

/** 建 unknown 貢獻的共用骨架 */
export function unknownContribution<F extends AnySoundFamily>(
  family: F,
  sourceId: string,
  reason: string,
  sourceTime: number,
  distanceM: number | null,
  extra: { spatialPrecision?: string; proxyKind?: SourceContribution["proxyKind"]; notes?: string[] } = {},
): SourceContribution<F> {
  return {
    sourceId,
    family,
    status: "unknown" as const,
    sourceTime: iso(sourceTime),
    spatialDistanceM: distanceM,
    relativePotential: null,
    modeledDbA: null,
    evidence: "observed" as const,
    spatialPrecision: "nearest_station",
    temporalPrecision: "hourly",
    acousticConfidence: "proxy" as const,
    unknownReason: reason,
    ...extra,
    notes: [reason, ...(extra.notes ?? [])],
  };
}
