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
 * - 該站該小時無列 → unknown（歷史缺口不由其他時刻內插）。
 *
 * W6-1（2026-11-12）：加入雷達每日包（src/sound/grid/radarRainPack.ts；Python 由雷達回波圖反解的分級）。
 * - 雨勢一律先換成分級（0 無雨…4 豪雨、255 無法判斷；門檻 rainClasses.json），**雷達 ∨ 雨量站取較高者**
 *   （combineRainClass 真值表）；每 10 分一格＝區間內最大值；雨量站每小時一筆，不內插成 10 分鐘。
 * - 網格（src/sound/grid/rainGrid.ts）與接收點查詢都呼叫 rainEstimateAt，網格值＝點選查詢值。
 * - 分級 0（無雨）＝inactive；舊版 0 < R < 0.5 mm/h 算 active 的情況改為 inactive（分級口徑）。
 * - 沒有雷達包的日子（即時、其他日期）只用雨量站，來源標「雨量站」。
 */
import { fetchRainGaugeDay, type RainGaugeDayRow } from "../../data/rainGaugeLoader";
import { MODEL_VERSION, RAIN } from "../model/soundProfiles";
import { haversineM } from "../engines/geometryDistance";
import { rainPotential } from "../engines/relativePotentialKernel";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { cellIndexOf, GRID_UNKNOWN } from "../grid/gridSpec";
import {
  combineRainClass, foldRainClasses, rainClassLowerEdgeMmPerHour, rainClassOfMmPerHour, type RainClass, type RainClassCode,
} from "../grid/rainClass";
import { radarClassAt, RADAR_RAIN_PROVIDER, RADAR_FRAME_STEP_S, type RadarRainPack } from "../grid/radarRainPack";
import type {
  RainEstimateInfo,
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

/** 雷達每日包（整個網格一筆 record；和雨量站列放在同一個 rain set，provider 不同） */
export interface RadarRainPayload {
  kind: "radar_pack";
  pack: RadarRainPack;
}
export type RadarRainRecord = SoundSourceRecord<RadarRainPayload>;
export type AnyRainRecord = RainRecord | RadarRainRecord;

export function isRadarRainRecord(r: SoundSourceRecord<unknown, never> | SoundSourceRecord): r is RadarRainRecord {
  return (r.payload as { kind?: unknown } | null)?.kind === "radar_pack";
}

export function radarRainRecord(pack: RadarRainPack): RadarRainRecord {
  return {
    id: `rain:radar:${pack.dateKey}`,
    family: "rain",
    geometryKind: "distributed_field",
    payload: { kind: "radar_pack", pack },
    validFrom: pack.firstSlot,
    validUntil: pack.firstSlot + pack.frameCount * RADAR_FRAME_STEP_S,
    modelVersion: MODEL_VERSION,
    provenance: { provider: RADAR_RAIN_PROVIDER, originalId: `O-A0058-005:${pack.dateKey}` },
    quality: { location: "approximate", time: "observed", emission: "proxy" },
    visibility: "public",
  };
}

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

export function evaluateRain(record: AnyRainRecord, t: number): SourceEvaluation {
  if (isRadarRainRecord(record)) return { status: "unknown", reason: "radar_field_use_query_interval" };
  if (t < record.validFrom || t >= record.validUntil) return { status: "inactive" };
  const pot = rainPotential(record.payload.precipitation1hMm);
  if (pot == null) return { status: "unknown", reason: "precipitation_1hr_null" };
  if (pot <= 0) return { status: "inactive" };
  return { status: "active", geometry: { lon: record.payload.lon, lat: record.payload.lat, altitudeM: null }, relativeActivity: pot };
}

const iso = (t: number) => new Date(t * 1000).toISOString();

/** 最近站（依站點去重）；回傳站 id 與距離 */
export function nearestRainStation(
  records: readonly AnyRainRecord[],
  lon: number,
  lat: number,
): { stationId: string; stationName: string | null; distanceM: number } | null {
  let best: { stationId: string; stationName: string | null; distanceM: number } | null = null;
  const seen = new Set<string>();
  for (const r of records) {
    if (isRadarRainRecord(r)) continue;
    if (seen.has(r.payload.stationId)) continue;
    seen.add(r.payload.stationId);
    const d = haversineM(lon, lat, r.payload.lon, r.payload.lat);
    if (!best || d < best.distanceM) best = { stationId: r.payload.stationId, stationName: r.payload.stationName, distanceM: d };
  }
  return best;
}

type NearestStation = { stationId: string; stationName: string | null; distanceM: number };

/** 雨量站那一半在 [t0, t1] 的分級（逐小時；該小時沒有列或值為 null → 255） */
export interface GaugeEstimate {
  nearest: NearestStation | null;
  /** null＝5 km 內沒有雨量站（來源不存在） */
  rainClass: RainClassCode | null;
  /** 分級最高的那一筆（同級取雨量較大者） */
  bestRow: RainRecord | null;
  unknownReason: string | null;
  unknownTime: number | null;
}

export function gaugeEstimate(stationRows: readonly RainRecord[], nearest: NearestStation | null, t0: number, t1: number): GaugeEstimate {
  const maxD = RAIN.maxStationDistanceM.value;
  if (!nearest || nearest.distanceM > maxD) {
    return { nearest, rainClass: null, bestRow: null, unknownReason: `no_rain_station_within_${maxD}m`, unknownTime: t0 };
  }
  const bucket = RAIN.bucketDurationS.value;
  const codes: RainClassCode[] = [];
  let bestRow: RainRecord | null = null;
  let bestKey = -1;
  let unknownReason: string | null = null;
  let unknownTime: number | null = null;
  for (let h = Math.floor(t0 / bucket) * bucket; h <= t1; h += bucket) {
    if (h + bucket <= t0) continue;
    const row = stationRows.find((r) => r.payload.bucketStart === h);
    if (!row) {
      codes.push(GRID_UNKNOWN);
      if (unknownReason == null) { unknownReason = "station_hour_missing"; unknownTime = h; }
      continue;
    }
    const k = rainClassOfMmPerHour(row.payload.precipitation1hMm);
    codes.push(k);
    if (k === GRID_UNKNOWN) {
      if (unknownReason == null) { unknownReason = "precipitation_1hr_null"; unknownTime = row.payload.observedAt; }
      continue;
    }
    const key = k * 1e6 + (row.payload.precipitation1hMm ?? 0);
    if (key > bestKey) { bestKey = key; bestRow = row; }
  }
  return { nearest, rainClass: foldRainClasses(codes) ?? GRID_UNKNOWN, bestRow, unknownReason, unknownTime };
}

export interface RainEstimate {
  info: RainEstimateInfo;
  gauge: GaugeEstimate;
  /** 本次用到的雷達包（沒有 → null） */
  radarPack: RadarRainPack | null;
  /** 0–1（非 dB）；分級 0 → 0；255 → null */
  potential: number | null;
}

/**
 * 一個位置在 [t0, t1] 的雨勢：雷達（格心所在格、區間內各幀最大）∨ 雨量站（最近站、逐小時）取較高者。
 * 網格與 queryReceiver 共用這一支（W6-1 決定 6）。
 */
export function rainEstimateAt(records: readonly AnyRainRecord[], lon: number, lat: number, t0: number, t1: number): RainEstimate {
  const nearest = nearestRainStation(records, lon, lat);
  const stationRows = nearest ? (records.filter((r) => !isRadarRainRecord(r) && r.payload.stationId === nearest.stationId) as RainRecord[]) : [];
  const gauge = gaugeEstimate(stationRows, nearest, t0, t1);
  const cell = cellIndexOf(lon, lat);
  let radarPack: RadarRainPack | null = null;
  const radarCodes: RainClassCode[] = [];
  let radarSlot: number | null = null;
  let radarBest = -1;
  for (const r of records) {
    if (!isRadarRainRecord(r)) continue;
    const hit = radarClassAt(r.payload.pack, cell, t0, t1);
    if (!hit) continue;
    radarPack ??= r.payload.pack;
    radarCodes.push(hit.rainClass);
    const v = hit.rainClass === GRID_UNKNOWN ? -0.5 : hit.rainClass;
    if (v > radarBest) { radarBest = v; radarSlot = hit.slotStart; radarPack = r.payload.pack; }
  }
  const radarClass = foldRainClasses(radarCodes);
  const { rainClass, source } = combineRainClass(radarClass, gauge.rainClass);
  let potential: number | null = null;
  if (rainClass === 0) potential = 0;
  else if (rainClass !== GRID_UNKNOWN) {
    const g = gauge.rainClass != null && gauge.rainClass !== GRID_UNKNOWN && gauge.rainClass >= 1 && gauge.bestRow
      ? rainPotential(gauge.bestRow.payload.precipitation1hMm) ?? 0 : 0;
    const r = radarClass != null && radarClass !== GRID_UNKNOWN && radarClass >= 1
      ? rainPotential(rainClassLowerEdgeMmPerHour(radarClass as RainClass)) ?? 0 : 0;
    potential = Math.max(g, r);
  }
  return {
    info: {
      rainClass,
      source,
      radarClass,
      radarSlotStart: radarClass == null ? null : radarSlot,
      gaugeClass: gauge.rainClass,
      gaugeObservedAt: gauge.bestRow?.payload.observedAt ?? (gauge.rainClass == null ? null : gauge.unknownTime),
    },
    gauge,
    radarPack,
    potential,
  };
}

const stationLabel = (n: NearestStation) => `station:${n.stationName ?? n.stationId}(${n.stationId}) distance:${Math.round(n.distanceM)}m`;

export const queryRainInterval: IntervalQuery<RainPayload | RadarRainPayload> = (records, receiver, t0, t1) => {
  const recs = records as unknown as AnyRainRecord[];
  const est = rainEstimateAt(recs, receiver.longitude, receiver.latitude, t0, t1);
  const { info, gauge } = est;
  const nearest = gauge.nearest;
  const stationNotes = nearest ? [stationLabel(nearest)] : [];
  const radarNotes = info.radarClass == null ? ["radar:no_pack"] : [`radar_class:${info.radarClass}`];
  if (info.rainClass === GRID_UNKNOWN) {
    // 兩邊都無法判斷：雨量站存在→沿用雨量站原因；只有雷達（缺幀／雜波）→ radar_frame_unavailable
    const reason = gauge.rainClass == null && info.radarClass != null ? "radar_frame_unavailable" : gauge.unknownReason ?? "rain_unknown";
    const unknown: SourceContribution = {
      sourceId: `rain:${nearest?.stationId ?? "none"}`,
      family: "rain",
      status: "unknown",
      sourceTime: iso(gauge.unknownTime ?? info.radarSlotStart ?? t0),
      spatialDistanceM: nearest?.distanceM ?? null,
      relativePotential: null,
      modeledDbA: null,
      evidence: "observed",
      spatialPrecision: info.radarClass != null ? "radar_grid_250m" : "nearest_gauge",
      temporalPrecision: info.radarClass != null ? "radar_10min" : "hourly",
      acousticConfidence: "proxy",
      unknownReason: reason,
      rainEstimate: info,
      notes: [reason, ...stationNotes, ...radarNotes],
    };
    return { contributions: [unknown], notes: [] };
  }
  if (info.rainClass === 0) {
    return { contributions: [], notes: [...stationNotes, ...radarNotes, "rain_class:0", gauge.rainClass != null ? "granularity:hourly" : "granularity:radar_10min"] };
  }
  const radarWins = info.source === "radar";
  const row = gauge.bestRow;
  const viaRadar = info.source === "radar" || info.source === "both";
  const contribution: SourceContribution = {
    sourceId: radarWins || !row ? `rain:radar:${est.radarPack?.dateKey ?? "none"}` : row.id,
    family: "rain",
    status: "active",
    sourceTime: iso(radarWins || !row ? info.radarSlotStart ?? t0 : row.payload.observedAt),
    spatialDistanceM: radarWins || !nearest ? null : nearest.distanceM,
    relativePotential: est.potential,
    modeledDbA: null,
    evidence: "observed",
    spatialPrecision: radarWins ? "radar_grid_250m" : viaRadar ? "radar_grid_250m+nearest_gauge" : "nearest_gauge_not_street_level",
    temporalPrecision: radarWins ? "radar_10min" : viaRadar ? "radar_10min+hourly" : "hourly",
    acousticConfidence: "proxy",
    rainEstimate: info,
    notes: [
      ...stationNotes,
      ...(row ? [`precipitation_1hr_mm:${row.payload.precipitation1hMm}`, `precipitation_10min_mm:${row.payload.precipitation10minMm ?? "null"}`, "granularity:hourly"] : []),
      ...radarNotes,
      `rain_class:${info.rainClass}`,
      `rain_source:${info.source}`,
    ],
  };
  return { contributions: [contribution], notes: [...stationNotes, ...(row ? ["granularity:hourly"] : [])] };
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
