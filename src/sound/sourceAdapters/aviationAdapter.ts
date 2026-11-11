/**
 * 飛機聲源 adapter（A01，移動 3D 點）。
 *
 * 資料：重用 airspaceLoader.fetchAirspaceDayArrow（get_flight_trails）回來的 Flight[]；
 * 測試／離線可用 flightTrails.flightRowsToFlights 產出同形資料。
 *
 * 高度單位（2026-11-11 查核，data-collectors storage/supabase_writer.py:1098-1146）：
 *   trail 的 alt 直接串 live.flight_positions.altitude，**兩個來源單位不同**：
 *   - FR24 zone 來源：flight_id 為 8 位 hex → 英尺
 *   - OpenSky 來源：flight_id 為 6 位 hex → 公尺（baro，缺時 geo）
 *   - 其他 → unknown：只算 2D 距離，relativePotential=null，notes 標 blocker（T05）
 *   高度基準（MSL／AGL、氣壓／幾何）未與地形校正，斜距一律附 note。
 *
 * 缺口：Flight 已被 splitTrailByGap(>30 分鐘) 切段；本 adapter 依 fr24_id 的 `_<n>` 後綴
 * 把同一原始航班的段重組，段與段之間回 unknown（T04），不跨缺口插值。
 */
import type { Flight, TrailPoint } from "../../types";
import { fetchAirspaceDayArrow } from "../../data/airspaceLoader";
import { AVIATION, COMMON, MODEL_VERSION } from "../model/soundProfiles";
import { haversineM, slantDistanceM } from "../engines/geometryDistance";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { clipCoverageEnd } from "../engines/coverageWindow";
import type {
  IntervalQuery,
  Receiver,
  SoundSourceAdapter,
  SoundSourceRecord,
  SoundSourceSet,
  SourceContribution,
  SourceEvaluation,
} from "../types";

export type AltitudeUnit = "unknown" | "ft" | "m";

export interface AviationPayload {
  flightId: string;
  callsign: string;
  /** 每段內相鄰點間隔 ≤30 分鐘（loader 的 splitTrailByGap 寫死預設 1800 s，本 adapter 不另設）；段已按時間排序 */
  segments: TrailPoint[][];
  coverageStart: number;
  coverageEnd: number;
  altitudeUnit: AltitudeUnit;
}

export type AviationRecord = SoundSourceRecord<AviationPayload>;

/** 依 flight_id 判定高度單位（純函式）：8 hex → ft、6 hex → m、其他 → unknown */
export function altitudeUnitForFlightId(flightId: string): AltitudeUnit {
  const base = flightId.replace(/_\d+$/, "");
  if (/^[0-9a-f]{8}$/i.test(base)) return "ft";
  if (/^[0-9a-f]{6}$/i.test(base)) return "m";
  return "unknown";
}

export function altitudeToMeters(alt: number, unit: AltitudeUnit): number | null {
  if (!Number.isFinite(alt)) return null;
  if (unit === "ft") return alt * AVIATION.feetToMeters.value;
  if (unit === "m") return alt;
  return null;
}

/** Flight[]（可能已被切段，id 帶 `_<n>`）→ 每個原始航班一筆 record */
export function flightsToAviationRecords(
  flights: readonly Flight[],
  opts: { altitudeUnitOverride?: AltitudeUnit } = {},
): AviationRecord[] {
  const groups = new Map<string, Flight[]>();
  for (const f of flights) {
    const base = f.fr24_id.replace(/_\d+$/, "");
    const list = groups.get(base);
    if (list) list.push(f);
    else groups.set(base, [f]);
  }
  const records: AviationRecord[] = [];
  for (const [base, list] of groups) {
    const segments = list
      .map((f) => f.path)
      .filter((p) => p.length >= 1)
      .sort((a, b) => a[0]![3] - b[0]![3]);
    if (segments.length === 0) continue;
    const coverageStart = segments[0]![0]![3];
    const last = segments[segments.length - 1]!;
    const coverageEnd = last[last.length - 1]![3];
    const altitudeUnit = opts.altitudeUnitOverride ?? altitudeUnitForFlightId(base);
    records.push({
      id: `aviation:${base}`,
      family: "aviation",
      geometryKind: "moving_point_3d",
      payload: { flightId: base, callsign: list[0]!.callsign, segments, coverageStart, coverageEnd, altitudeUnit },
      validFrom: coverageStart,
      validUntil: coverageEnd,
      modelVersion: MODEL_VERSION,
      provenance: { provider: altitudeUnit === "ft" ? "fr24" : altitudeUnit === "m" ? "opensky" : "unknown", originalId: base },
      quality: { location: "exact_observed", time: "observed", emission: "unmeasured" },
      visibility: "public",
    });
  }
  return records;
}

export type AviationPosition =
  | { status: "position"; lon: number; lat: number; altitudeM: number | null; interpolated: boolean }
  | { status: "inactive" }
  | { status: "unknown"; reason: string };

/** 時間 t 的航機位置：段內短間隔線性插值；段間缺口或段內長間隔 → unknown */
export function aviationPositionAt(payload: AviationPayload, t: number): AviationPosition {
  if (t < payload.coverageStart || t > payload.coverageEnd) return { status: "inactive" };
  for (const seg of payload.segments) {
    const first = seg[0]![3];
    const last = seg[seg.length - 1]![3];
    if (t < first || t > last) continue;
    for (let i = 0; i < seg.length; i++) {
      const a = seg[i]!;
      if (a[3] === t) {
        return { status: "position", lat: a[0], lon: a[1], altitudeM: altitudeToMeters(a[2], payload.altitudeUnit), interpolated: false };
      }
      const b = seg[i + 1];
      if (!b || !(a[3] < t && t < b[3])) continue;
      const gap = b[3] - a[3];
      if (gap > AVIATION.maxInterpolationGapS.value) {
        return { status: "unknown", reason: `trail_gap_${Math.round(gap)}s_exceeds_interpolation_limit` };
      }
      const f = (t - a[3]) / gap;
      const altA = altitudeToMeters(a[2], payload.altitudeUnit);
      const altB = altitudeToMeters(b[2], payload.altitudeUnit);
      return {
        status: "position",
        lat: a[0] + (b[0] - a[0]) * f,
        lon: a[1] + (b[1] - a[1]) * f,
        altitudeM: altA == null || altB == null ? null : altA + (altB - altA) * f,
        interpolated: true,
      };
    }
  }
  return { status: "unknown", reason: "trail_gap_over_30min_between_segments" };
}

export function evaluateAviation(record: AviationRecord, t: number): SourceEvaluation {
  const pos = aviationPositionAt(record.payload, t);
  if (pos.status !== "position") return pos;
  return { status: "active", geometry: { lon: pos.lon, lat: pos.lat, altitudeM: pos.altitudeM }, relativeActivity: 1 };
}

function sampleTimes(t0: number, t1: number, step: number): number[] {
  if (t1 <= t0) return [t0];
  const out: number[] = [];
  for (let t = t0; t < t1; t += step) out.push(t);
  out.push(t1);
  return out;
}

const iso = (t: number) => new Date(t * 1000).toISOString();

export const queryAviationInterval: IntervalQuery<AviationPayload> = (records, receiver, t0, t1) => {
  const contributions: SourceContribution[] = [];
  const recvH = receiver.heightM ?? COMMON.receiverDefaultHeightM.value;
  const radius = AVIATION.candidateRadiusM.value;
  const times = sampleTimes(t0, t1, AVIATION.intervalSampleStepS.value);
  for (const r of records) {
    if (r.validUntil < t0 || r.validFrom > t1) continue;
    let best: SourceContribution | null = null;
    let unknownCandidate: SourceContribution | null = null;
    for (const t of times) {
      const pos = aviationPositionAt(r.payload, t);
      if (pos.status === "inactive") continue;
      if (pos.status === "unknown") {
        // 缺口期間位置未知：只有在缺口兩端任一端落在候選半徑內才當候選 unknown
        if (!unknownCandidate && gapTouchesRadius(r.payload, t, receiver, radius)) {
          unknownCandidate = baseContribution(r, t, null, null, "unknown", [`position_unknown:${pos.reason}`, "trail_incomplete"], pos.reason);
        }
        continue;
      }
      const dh = haversineM(receiver.longitude, receiver.latitude, pos.lon, pos.lat);
      if (dh > radius) continue;
      if (pos.altitudeM == null) {
        const c = baseContribution(r, t, dh, null, "unknown", [
          "blocker:T05 altitude unit unconfirmed — 3D attenuation blocked, 2D distance only",
        ], "altitude_unit_unknown");
        c.propagationApproximation = "2d";
        if (!unknownCandidate) unknownCandidate = c;
        continue;
      }
      const slant = slantDistanceM(dh, pos.altitudeM - recvH);
      const pot = proximityPotential(slant, AVIATION.halfPotentialDistanceM.value);
      if (!best || (best.relativePotential ?? 0) < pot) {
        best = baseContribution(r, t, slant, pot, "active", [
          `altitude_unit:${r.payload.altitudeUnit}`,
          "altitude_datum_unverified(MSL/AGL, baro/geo)",
          pos.interpolated ? "position_interpolated_linear" : "position_observed",
        ]);
        best.propagationApproximation = "3d";
      }
    }
    if (best) contributions.push(best);
    else if (unknownCandidate) contributions.push(unknownCandidate);
  }
  return { contributions, notes: [] };
};

function gapTouchesRadius(payload: AviationPayload, t: number, receiver: Receiver, radius: number): boolean {
  let before: TrailPoint | null = null;
  let after: TrailPoint | null = null;
  for (const seg of payload.segments) {
    for (const pt of seg) {
      if (pt[3] <= t) before = pt;
      else if (!after) after = pt;
    }
  }
  return [before, after].some(
    (pt) => pt != null && haversineM(receiver.longitude, receiver.latitude, pt[1], pt[0]) <= radius,
  );
}

function baseContribution(
  r: AviationRecord,
  t: number,
  distance: number | null,
  potential: number | null,
  status: "active" | "unknown",
  notes: string[],
  unknownReason?: string,
): SourceContribution {
  return {
    ...(unknownReason ? { unknownReason } : {}),
    sourceId: r.id,
    family: "aviation",
    status,
    sourceTime: iso(t),
    spatialDistanceM: distance,
    relativePotential: potential,
    modeledDbA: null,
    evidence: "observed",
    spatialPrecision: "adsb_track_point",
    temporalPrecision: "trail_point_or_linear_interpolation",
    acousticConfidence: "proxy",
    notes: [`callsign:${r.payload.callsign}`, ...notes],
  };
}

export async function loadAviation(
  ctx: { date: string; nowUnix?: number },
  fetcher: (date: string) => Promise<{ flights: Flight[] }> = fetchAirspaceDayArrow,
): Promise<SoundSourceSet<AviationPayload>> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const now = ctx.nowUnix ?? Date.now() / 1000;
  const base = { family: "aviation" as const, provider: "flight_trails", dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
  try {
    const data = await fetcher(ctx.date);
    const records = flightsToAviationRecords(data.flights);
    // 今天：涵蓋窗只到最後一筆航跡（且不超過現在），之後的時段 unavailable 而非 0
    const lastTs = records.reduce((m, r) => Math.max(m, r.payload.coverageEnd), -Infinity);
    const windowEnd = clipCoverageEnd(start, now, Number.isFinite(lastTs) ? lastTs : null);
    return {
      family: "aviation",
      dateKey: ctx.date,
      records,
      coverage: [{ ...base, windowEnd, status: records.length ? "ok" : "empty", reason: records.length ? undefined : "no_flight_trails_for_date" }],
    };
  } catch (e) {
    return { family: "aviation", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const aviationAdapter: SoundSourceAdapter<AviationPayload> = {
  family: "aviation",
  load: loadAviation,
  evaluate: evaluateAviation,
  queryInterval: queryAviationInterval,
};
