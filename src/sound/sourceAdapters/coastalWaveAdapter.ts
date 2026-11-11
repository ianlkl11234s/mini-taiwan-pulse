/**
 * 海浪×海岸 adapter（N04，帶狀自然聲源）。
 *
 * 資料：
 * - 浪：CWA O-B0075 逐時浪高（wave_height, m）與週期（wave_period, s），浮標／潮位站（collector `cwa_marine_observation.py`）。
 *   S3 `cwa_marine_observation/archives/<D>.tar.gz` 每 15 分鐘一個 json，每個含滾動 48 小時讀數；
 *   快照取 D+1 包的第一個 json 即涵蓋 D 全天。即時 RPC 只有逐站逐指標的 history（一天要數十次呼叫），
 *   本版即時路徑回 coverage=unavailable，UI 接線時再決定（見 ADVANCED_SOURCES.md）。
 * - 海岸：國家公園署 111 年「海岸地區範圍」的**近岸海域**面（analytics coastal_area_extents），當海岸線 proxy；
 *   **不是現行海岸線**（近岸海域自平均低潮線起算）。
 *
 * 規則：
 * - 沒有海岸幾何或接收點不在其範圍內 → unknown（coastline_not_loaded_here）。
 * - 離近岸海域 > coastMaxDistanceM → 不產生貢獻（inactive），不論浪資料是否健康。
 * - 最近浪測站 > maxStationDistanceM、該小時缺列、浪高或週期任一 null → unknown。
 * - 潛勢 = wavePotential(Hs, T) × proximity(離海岸距離)；只做距離衰減 proxy，不推近岸衰減、岸型、地形遮蔽。
 */
import { COASTAL_WAVE, MODEL_VERSION } from "../model/soundProfiles";
import { wavePotential } from "../engines/naturalKernels";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { distanceToGeometryM } from "../engines/geometryShapes";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { insideBbox, iso, nearestStation, scanHours, stationLabel, unknownContribution, type Bbox, type StationPoint } from "./naturalShared";
import type { IntervalQuery, SoundSourceAdapter, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceEvaluation } from "../types";

export const WAVE_PROVIDER = "cwa_marine_obs";
const FAMILY = "coastal_wave" as const;

export interface WaveObs extends StationPoint {
  stationType: string | null;
  obsTime: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
}

export type CoastalWavePayload =
  | ({ kind: "wave_obs" } & WaveObs)
  /** 近岸海域面（海岸線 proxy）；bbox＝這份幾何保證完整的範圍 */
  | { kind: "coast"; bbox: Bbox; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }
  | { kind: "station_extent"; bbox: Bbox };

export type CoastalWaveRecord = SoundSourceRecord<CoastalWavePayload, typeof FAMILY>;

const dayRecord = (dateKey: string) => {
  const start = taipeiMidnightMs(dateKey) / 1000;
  return { family: FAMILY, modelVersion: MODEL_VERSION, validFrom: start, validUntil: start + 86_400 };
};

export function waveObsToRecords(rows: readonly WaveObs[]): CoastalWaveRecord[] {
  const bucket = COASTAL_WAVE.bucketDurationS.value;
  return rows.map((r) => ({
    id: `wave:${r.stationId}:${r.obsTime}`,
    family: FAMILY,
    geometryKind: "distributed_field",
    payload: { kind: "wave_obs", ...r },
    validFrom: r.obsTime,
    validUntil: r.obsTime + bucket,
    modelVersion: MODEL_VERSION,
    provenance: { provider: WAVE_PROVIDER, originalId: r.stationId, observedAt: r.obsTime },
    quality: { location: "exact_observed", time: "observed", emission: "proxy" },
    visibility: "public",
  }));
}

export function coastRecord(bbox: Bbox, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, dateKey: string): CoastalWaveRecord {
  return {
    ...dayRecord(dateKey),
    id: `coast:${bbox.join(",")}`,
    geometryKind: "line",
    payload: { kind: "coast", bbox, geometry },
    provenance: { provider: WAVE_PROVIDER, originalId: "nlma_coastal_area_extents_111_nearshore" },
    quality: { location: "approximate", time: "estimated", emission: "unmeasured" },
    visibility: "internal",
  };
}

export function waveExtentRecord(bbox: Bbox, dateKey: string): CoastalWaveRecord {
  return {
    ...dayRecord(dateKey),
    id: `wave:extent:${bbox.join(",")}`,
    geometryKind: "area",
    payload: { kind: "station_extent", bbox },
    provenance: { provider: WAVE_PROVIDER },
    quality: { location: "unknown", time: "observed", emission: "unmeasured" },
    visibility: "internal",
  };
}

export function evaluateCoastalWave(record: CoastalWaveRecord, t: number): SourceEvaluation {
  const p = record.payload;
  if (p.kind !== "wave_obs" || t < record.validFrom || t >= record.validUntil) return { status: "inactive" };
  const pot = wavePotential(p.waveHeightM, p.wavePeriodS);
  if (pot == null) return { status: "unknown", reason: "wave_height_or_period_null" };
  if (pot <= 0) return { status: "inactive" };
  return { status: "active", geometry: { lon: p.lon, lat: p.lat, altitudeM: 0 }, relativeActivity: pot };
}

export const queryCoastalWaveInterval: IntervalQuery<CoastalWavePayload, typeof FAMILY> = (records, receiver, t0, t1) => {
  const { longitude: lon, latitude: lat } = receiver;
  const unknown = (reason: string, d: number | null, t: number, notes: string[] = []) =>
    ({ contributions: [unknownContribution(FAMILY, "coastal_wave:receiver", reason, t, d, { proxyKind: "wave_height_period_x_coast_distance", notes })], notes: [] });

  // 1. 海岸距離（靜態）
  const maxCoast = COASTAL_WAVE.coastMaxDistanceM.value;
  const coasts = records.flatMap((r) => (r.payload.kind === "coast" && insideBbox(lon, lat, r.payload.bbox, maxCoast) ? [r.payload] : []));
  if (!coasts.length) return unknown("coastline_not_loaded_here", null, t0);
  const ds = coasts.map((c) => distanceToGeometryM(c.geometry, lon, lat)).filter((d): d is number => d != null);
  if (!ds.length) return unknown("coastline_geometry_invalid", null, t0);
  const coastD = Math.min(...ds);
  const coastNote = `distance_to_nearshore_zone_m:${Math.round(coastD)}(coastline_proxy_not_shoreline)`;
  if (coastD > maxCoast) return { contributions: [], notes: [coastNote, `beyond_${maxCoast}m:inactive`] };
  const distFactor = proximityPotential(coastD, COASTAL_WAVE.halfPotentialDistanceM.value);

  // 2. 浪（時變）
  const extents = records.flatMap((r) => (r.payload.kind === "station_extent" ? [r.payload.bbox] : []));
  if (!extents.some((b) => insideBbox(lon, lat, b))) return unknown("outside_wave_station_extent", coastD, t0, [coastNote]);
  const obs = records.flatMap((r) => (r.payload.kind === "wave_obs" ? [r.payload] : []));
  const maxD = COASTAL_WAVE.maxStationDistanceM.value;
  const nearest = nearestStation(obs, lon, lat);
  if (!nearest || nearest.distanceM > maxD) {
    return unknown(`no_wave_station_within_${maxD}m`, coastD, t0, [coastNote, ...(nearest ? [stationLabel(nearest.station, nearest.distanceM)] : [])]);
  }
  const label = stationLabel(nearest.station, nearest.distanceM);
  const stationObs = obs.filter((o) => o.stationId === nearest.station.stationId);
  const scan = scanHours(
    t0,
    t1,
    COASTAL_WAVE.bucketDurationS.value,
    (h) => stationObs.find((o) => o.obsTime === h),
    (o) => {
      const wp = wavePotential(o.waveHeightM, o.wavePeriodS);
      return wp == null ? { reason: "wave_height_or_period_null" } : { potential: wp * distFactor };
    },
    "station_hour_missing",
  );
  const contributions: SourceContribution<typeof FAMILY>[] = [];
  if (scan.best) {
    const o = scan.best.row;
    contributions.push({
      sourceId: `wave:${o.stationId}:${o.obsTime}`,
      family: FAMILY,
      status: "active",
      sourceTime: iso(o.obsTime),
      spatialDistanceM: coastD,
      relativePotential: scan.best.potential,
      modeledDbA: null,
      evidence: "observed",
      spatialPrecision: "offshore_station_x_coast_distance_proxy",
      temporalPrecision: "hourly",
      acousticConfidence: "proxy",
      proxyKind: "wave_height_period_x_coast_distance",
      notes: [label, `wave_height_m:${o.waveHeightM}`, `wave_period_s:${o.wavePeriodS}`, coastNote, "nearshore_attenuation_not_modeled"],
    });
  } else if (scan.firstUnknown) {
    contributions.push(unknownContribution(FAMILY, `wave:${nearest.station.stationId}`, scan.firstUnknown.reason, scan.firstUnknown.hour, coastD, { proxyKind: "wave_height_period_x_coast_distance", notes: [label, coastNote] }));
  }
  return { contributions, notes: [label, coastNote] };
};

/** 即時路徑尚未接（per-station history RPC 成本高）：coverage=unavailable，不當 0 */
export async function loadCoastalWave(ctx: { date: string }): Promise<SoundSourceSet<CoastalWavePayload, typeof FAMILY>> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  return {
    family: FAMILY,
    dateKey: ctx.date,
    records: [],
    coverage: [
      { family: FAMILY, provider: WAVE_PROVIDER, dateKey: ctx.date, status: "unavailable", windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series", reason: "live_marine_loader_not_wired(snapshot_only)" },
    ],
  };
}

export const coastalWaveAdapter: SoundSourceAdapter<CoastalWavePayload, typeof FAMILY> = {
  family: FAMILY,
  load: loadCoastalWave,
  evaluate: evaluateCoastalWave,
  queryInterval: queryCoastalWaveInterval,
};
