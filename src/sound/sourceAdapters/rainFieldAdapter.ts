/**
 * 雨聲 adapter（N01，分布式場的站點代理）。
 *
 * 資料：重用 rainGaugeLoader.fetchRainGaugeDay(dateKey)（get_rain_gauge_day）。
 * 粒度（gis-platform 057／312 確認）：每站**每小時一筆**（DISTINCT ON 小時，取該小時最後一筆
 * 觀測），bucket_at = 該小時起點（臺北時區）。本 adapter 以 [bucket_at, bucket_at+1h) 代表該筆。
 *
 * 規則：
 * - 接收者取最近雨量站；超過 RAIN.maxStationDistanceM → unknown（T09：不假造街區雨勢）。
 * - 用 precipitation_1hr（mm，過去 1 小時累積，作 mm/h 代理）；null → unknown，不當 0（T18）。
 *   precipitation_10min 單位是 mm/10min，臺北站近期多 NULL，只放 notes，不換算混用。
 * - 該站該小時無列 → unknown（歷史缺口不由其他時刻／雷達填補）。
 * - 不讀雷達 PNG（T10）。
 */
import { fetchRainGaugeDay, type RainGaugeDayRow } from "../../data/rainGaugeLoader";
import { MODEL_VERSION, RAIN } from "../model/soundProfiles";
import { haversineM } from "../engines/geometryDistance";
import { rainPotential } from "../engines/relativePotentialKernel";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import type {
  IntervalQuery,
  SoundSourceAdapter,
  SoundSourceRecord,
  SoundSourceSet,
  SourceContribution,
  SourceEvaluation,
} from "../types";

export interface RainPayload {
  stationId: string;
  stationName: string | null;
  lon: number;
  lat: number;
  bucketStart: number;
  observedAt: number;
  /** mm，過去 1 小時累積 */
  precipitation1hMm: number | null;
  /** mm / 10 分鐘（不與 1hr 混用） */
  precipitation10minMm: number | null;
  granularity: "hourly";
}

export type RainRecord = SoundSourceRecord<RainPayload>;

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function rainRowsToRecords(rows: readonly RainGaugeDayRow[]): RainRecord[] {
  const bucket = RAIN.bucketDurationS.value;
  return rows.map((row) => {
    const bucketStart = Date.parse(row.bucket_at) / 1000;
    return {
      id: `rain:${row.station_id}:${bucketStart}`,
      family: "rain",
      geometryKind: "distributed_field",
      payload: {
        stationId: row.station_id,
        stationName: row.station_name,
        lon: Number(row.lng),
        lat: Number(row.lat),
        bucketStart,
        observedAt: Date.parse(row.observed_at) / 1000,
        precipitation1hMm: toNum(row.precipitation_1hr),
        precipitation10minMm: toNum(row.precipitation_10min),
        granularity: "hourly",
      },
      validFrom: bucketStart,
      validUntil: bucketStart + bucket,
      modelVersion: MODEL_VERSION,
      provenance: { provider: "cwa_rain_gauge", originalId: row.station_id, observedAt: Date.parse(row.observed_at) / 1000 },
      quality: { location: "exact_observed", time: "observed", emission: "proxy" },
      visibility: "public",
    };
  });
}

export function evaluateRain(record: RainRecord, t: number): SourceEvaluation {
  if (t < record.validFrom || t >= record.validUntil) return { status: "inactive" };
  const pot = rainPotential(record.payload.precipitation1hMm);
  if (pot == null) return { status: "unknown", reason: "precipitation_1hr_null" };
  if (pot <= 0) return { status: "inactive" };
  return { status: "active", geometry: { lon: record.payload.lon, lat: record.payload.lat, altitudeM: null }, relativeActivity: pot };
}

const iso = (t: number) => new Date(t * 1000).toISOString();

/** 最近站（依站點去重）；回傳站 id 與距離 */
export function nearestRainStation(
  records: readonly RainRecord[],
  lon: number,
  lat: number,
): { stationId: string; stationName: string | null; distanceM: number } | null {
  let best: { stationId: string; stationName: string | null; distanceM: number } | null = null;
  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(r.payload.stationId)) continue;
    seen.add(r.payload.stationId);
    const d = haversineM(lon, lat, r.payload.lon, r.payload.lat);
    if (!best || d < best.distanceM) best = { stationId: r.payload.stationId, stationName: r.payload.stationName, distanceM: d };
  }
  return best;
}

export const queryRainInterval: IntervalQuery<RainPayload> = (records, receiver, t0, t1) => {
  const nearest = nearestRainStation(records, receiver.longitude, receiver.latitude);
  const maxD = RAIN.maxStationDistanceM.value;
  const stationLabel = (n: { stationId: string; stationName: string | null; distanceM: number }) =>
    `station:${n.stationName ?? n.stationId}(${n.stationId}) distance:${Math.round(n.distanceM)}m`;
  const unknown = (reason: string, distance: number | null, sourceTime: number, extra: string[] = []): SourceContribution => ({
    sourceId: `rain:${nearest?.stationId ?? "none"}`,
    family: "rain",
    status: "unknown",
    sourceTime: iso(sourceTime),
    spatialDistanceM: distance,
    relativePotential: null,
    modeledDbA: null,
    evidence: "observed",
    spatialPrecision: "nearest_gauge",
    temporalPrecision: "hourly",
    acousticConfidence: "proxy",
    unknownReason: reason,
    notes: [reason, ...extra],
  });
  if (!nearest || nearest.distanceM > maxD) {
    return {
      contributions: [unknown(`no_rain_station_within_${maxD}m`, nearest?.distanceM ?? null, t0, nearest ? [stationLabel(nearest)] : [])],
      notes: [],
    };
  }
  const bucket = RAIN.bucketDurationS.value;
  const stationRows = records.filter((r) => r.payload.stationId === nearest.stationId);
  const contributions: SourceContribution[] = [];
  // 逐小時走過 [t0, t1]：每個涵蓋到的小時都要有該站資料，否則 unknown
  const firstHour = Math.floor(t0 / bucket) * bucket;
  let best: SourceContribution | null = null;
  let firstUnknown: SourceContribution | null = null;
  let anyDry = false;
  for (let h = firstHour; h <= t1; h += bucket) {
    if (h + bucket <= t0) continue;
    const row = stationRows.find((r) => r.payload.bucketStart === h);
    if (!row) {
      firstUnknown ??= unknown("station_hour_missing", nearest.distanceM, h, [stationLabel(nearest)]);
      continue;
    }
    const pot = rainPotential(row.payload.precipitation1hMm);
    if (pot == null) {
      firstUnknown ??= unknown("precipitation_1hr_null", nearest.distanceM, row.payload.observedAt, [stationLabel(nearest)]);
      continue;
    }
    if (pot <= 0) {
      anyDry = true;
      continue;
    }
    if (!best || (best.relativePotential ?? 0) < pot) {
      best = {
        sourceId: row.id,
        family: "rain",
        status: "active",
        sourceTime: iso(row.payload.observedAt),
        spatialDistanceM: nearest.distanceM,
        relativePotential: pot,
        modeledDbA: null,
        evidence: "observed",
        spatialPrecision: "nearest_gauge_not_street_level",
        temporalPrecision: "hourly",
        acousticConfidence: "proxy",
        notes: [
          stationLabel(nearest),
          `precipitation_1hr_mm:${row.payload.precipitation1hMm}`,
          `precipitation_10min_mm:${row.payload.precipitation10minMm ?? "null"}`,
          "granularity:hourly",
        ],
      };
    }
  }
  if (best) contributions.push(best);
  else if (firstUnknown) contributions.push(firstUnknown);
  return { contributions, notes: anyDry || best ? [stationLabel(nearest), "granularity:hourly"] : [] };
};

/** fetcher 可注入（測試、場景快照）；預設走 get_rain_gauge_day */
export async function loadRain(
  ctx: { date: string },
  fetcher: (date: string) => Promise<RainGaugeDayRow[]> = fetchRainGaugeDay,
): Promise<SoundSourceSet<RainPayload>> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const base = { family: "rain" as const, provider: "cwa_rain_gauge", dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
  try {
    const rows = await fetcher(ctx.date);
    const records = rainRowsToRecords(rows);
    return { family: "rain", dateKey: ctx.date, records, coverage: [{ ...base, status: records.length ? "ok" : "empty", reason: records.length ? undefined : "no_rain_rows_for_date" }] };
  } catch (e) {
    return { family: "rain", dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const rainFieldAdapter: SoundSourceAdapter<RainPayload> = {
  family: "rain",
  load: loadRain,
  evaluate: evaluateRain,
  queryInterval: queryRainInterval,
};
