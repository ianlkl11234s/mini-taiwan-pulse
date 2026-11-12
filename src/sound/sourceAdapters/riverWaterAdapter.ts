/**
 * 河川水聲 adapter（N05，線狀自然聲源；研究性）。
 *
 * **水位 ≠ 流量 ≠ 聲音。** 本族只把「水位相對該站自身歷史的分位」當河道活動 proxy。
 *
 * 資料：
 * - 水位：水利署河川水位（collector `river_water_level.py`，每 10 分鐘）。即時讀 get_river_water_level_day（每站每小時最後一筆）；
 *   快照讀 S3 `river_water_level/archives/<D>.tar.gz` 並以相同規則降成每小時。
 * - 歷史分位：場景日之前 RIVER_WATER.historyWindowDays 天（不含當天）的每小時水位，快照預先算好；
 *   即時路徑讀 `/sound-atlas/river-level-quantiles.json`（尚未產出 → 每站 null → unknown）。
 * - 河道：水利署河川線（public/geo/water_rivers.geojson），快照裁切到範圍內。
 *
 * 規則：
 * - 沒有河道幾何或接收點不在其範圍內 → unknown；離河道 > channelMaxDistanceM → inactive。
 * - 最近水位站 > maxStationDistanceM → unknown；該站沒有分位表或樣本不足 → unknown（no_station_history_quantiles）。
 * - 該小時缺列或水位 null → unknown。潛勢 = 分位 × proximity(離河道距離)。
 * - 未驗證測站與河道是同一條河；感潮河段的水位反映潮汐而非流量（notes 一律標示）。
 */
import { fetchRiverLevelDay, type RiverLevelDayRow } from "../../data/riverLevelLoader";
import { withLoading } from "../../lib/loadingRegistry";
import { MODEL_VERSION, RIVER_WATER } from "../model/soundProfiles";
import { percentileRank, type QuantileTable } from "../engines/naturalKernels";
import { proximityPotential } from "../engines/relativePotentialKernel";
import { distanceToGeometryWithinM } from "../engines/geometryShapes";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { insideBbox, iso, nearestStation, scanHours, stationLabel, unknownContribution, type Bbox, type StationPoint } from "./naturalShared";
import type { IntervalQuery, SoundSourceAdapter, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceEvaluation } from "../types";

export const RIVER_PROVIDER = "wra_river_water_level";
const FAMILY = "river_water" as const;

export interface RiverObs extends StationPoint {
  /** 小時起點（unix 秒） */
  bucketStart: number;
  levelM: number | null;
}

export interface RiverStationInfo extends StationPoint {
  quantiles: QuantileTable | null;
  /** 分位基準說明（例：2026-08-25..2026-10-23, 60 days） */
  historyBasis: string | null;
}

export type RiverWaterPayload =
  | ({ kind: "river_obs" } & RiverObs)
  | ({ kind: "river_station" } & RiverStationInfo)
  | { kind: "river_network"; bbox: Bbox; geometry: GeoJSON.LineString | GeoJSON.MultiLineString }
  | { kind: "station_extent"; bbox: Bbox };

export type RiverWaterRecord = SoundSourceRecord<RiverWaterPayload, typeof FAMILY>;

const dayRecord = (dateKey: string) => {
  const start = taipeiMidnightMs(dateKey) / 1000;
  return { family: FAMILY, modelVersion: MODEL_VERSION, validFrom: start, validUntil: start + 86_400 };
};

export function riverObsToRecords(rows: readonly RiverObs[]): RiverWaterRecord[] {
  const bucket = RIVER_WATER.bucketDurationS.value;
  return rows.map((r) => ({
    id: `river:${r.stationId}:${r.bucketStart}`,
    family: FAMILY,
    geometryKind: "point",
    payload: { kind: "river_obs", ...r },
    validFrom: r.bucketStart,
    validUntil: r.bucketStart + bucket,
    modelVersion: MODEL_VERSION,
    provenance: { provider: RIVER_PROVIDER, originalId: r.stationId, observedAt: r.bucketStart },
    quality: { location: "exact_observed", time: "observed", emission: "proxy" },
    visibility: "public",
  }));
}

export function riverStationRecords(stations: readonly RiverStationInfo[], dateKey: string): RiverWaterRecord[] {
  return stations.map((s) => ({
    ...dayRecord(dateKey),
    id: `river:station:${s.stationId}`,
    geometryKind: "point",
    payload: { kind: "river_station", ...s },
    provenance: { provider: RIVER_PROVIDER, originalId: s.stationId },
    quality: { location: "exact_observed", time: "estimated", emission: "unmeasured" },
    visibility: "internal",
  }));
}

export function riverNetworkRecord(bbox: Bbox, geometry: GeoJSON.LineString | GeoJSON.MultiLineString, dateKey: string): RiverWaterRecord {
  return {
    ...dayRecord(dateKey),
    id: `river:network:${bbox.join(",")}`,
    geometryKind: "line",
    payload: { kind: "river_network", bbox, geometry },
    provenance: { provider: RIVER_PROVIDER, originalId: "wra_water_rivers" },
    quality: { location: "approximate", time: "estimated", emission: "unmeasured" },
    visibility: "internal",
  };
}

export function riverExtentRecord(bbox: Bbox, dateKey: string): RiverWaterRecord {
  return {
    ...dayRecord(dateKey),
    id: `river:extent:${bbox.join(",")}`,
    geometryKind: "area",
    payload: { kind: "station_extent", bbox },
    provenance: { provider: RIVER_PROVIDER },
    quality: { location: "unknown", time: "observed", emission: "unmeasured" },
    visibility: "internal",
  };
}

const quantilesUsable = (q: QuantileTable | null | undefined): q is QuantileTable =>
  !!q && q.n >= RIVER_WATER.minHistorySamples.value && q.probs.length >= 2 && q.probs.length === q.values.length;

export function evaluateRiverWater(record: RiverWaterRecord, t: number): SourceEvaluation {
  const p = record.payload;
  if (p.kind !== "river_obs" || t < record.validFrom || t >= record.validUntil) return { status: "inactive" };
  if (p.levelM == null) return { status: "unknown", reason: "water_level_null" };
  // 分位表在另一筆 river_station；單筆評估拿不到 → unknown（區間查詢才有完整脈絡）
  return { status: "unknown", reason: "needs_station_quantiles(use_queryInterval)" };
}

/** 空間脈絡（W6-3 網格一次建好、每格共用） */
export interface RiverSpatialContext {
  nets: { bbox: Bbox; geometry: GeoJSON.LineString | GeoJSON.MultiLineString }[];
  extents: Bbox[];
  /** 當日至少有一筆水位的站（river_station record 順序） */
  stations: RiverStationInfo[];
}

export function riverSpatialContext(records: readonly RiverWaterRecord[]): RiverSpatialContext {
  const reporting = new Set(records.flatMap((r) => (r.payload.kind === "river_obs" && r.payload.levelM != null ? [r.payload.stationId] : [])));
  return {
    nets: records.flatMap((r) => (r.payload.kind === "river_network" ? [r.payload] : [])),
    extents: records.flatMap((r) => (r.payload.kind === "station_extent" ? [r.payload.bbox] : [])),
    stations: records.flatMap((r) => (r.payload.kind === "river_station" && reporting.has(r.payload.stationId) ? [r.payload] : [])),
  };
}

type QueryOut = { contributions: SourceContribution<typeof FAMILY>[]; notes: string[] };

export type RiverSpatial =
  | { kind: "done"; out: QueryOut }
  | { kind: "station"; station: RiverStationInfo; quantiles: QuantileTable; chD: number; distFactor: number; chNote: string; label: string; caveats: string[] };

/** 空間項：河道距離（300 m 外＝0）→ 站點範圍 → 最近有回報的水位站（5 km）→ 該站分位表要可用 */
export function riverSpatialAt(ctx: RiverSpatialContext, lon: number, lat: number, t0: number): RiverSpatial {
  const unknown = (reason: string, d: number | null, t: number, notes: string[] = []): RiverSpatial =>
    ({ kind: "done", out: { contributions: [unknownContribution(FAMILY, "river_water:receiver", reason, t, d, { proxyKind: "water_level_percentile", notes })], notes: [] } });

  // 1. 河道距離（靜態）；距離只在 300 m 內精確（外面一律 >300 m＝0）
  const maxCh = RIVER_WATER.channelMaxDistanceM.value;
  const nets = ctx.nets.filter((n) => insideBbox(lon, lat, n.bbox, maxCh));
  if (!nets.length) return unknown("river_network_not_loaded_here", null, t0);
  const ds = nets.map((n) => distanceToGeometryWithinM(n.geometry, lon, lat, maxCh)).filter((d): d is number => d != null);
  if (!ds.length) return unknown("river_network_geometry_invalid", null, t0);
  const chD = Math.min(...ds);
  if (chD > maxCh) return { kind: "done", out: { contributions: [], notes: [`distance_to_river_line_m:>${maxCh}`, `beyond_${maxCh}m:inactive`] } };
  const chNote = `distance_to_river_line_m:${Math.round(chD)}`;
  const distFactor = proximityPotential(chD, RIVER_WATER.halfPotentialDistanceM.value);

  // 2. 水位站與分位
  if (!ctx.extents.some((b) => insideBbox(lon, lat, b))) return unknown("outside_river_station_extent", chD, t0, [chNote]);
  const maxD = RIVER_WATER.maxStationDistanceM.value;
  const nearest = nearestStation(ctx.stations, lon, lat);
  if (!nearest || nearest.distanceM > maxD) {
    return unknown(`no_water_level_station_within_${maxD}m`, chD, t0, [chNote, ...(nearest ? [stationLabel(nearest.station, nearest.distanceM)] : [])]);
  }
  const st = nearest.station;
  const label = stationLabel(st, nearest.distanceM);
  const caveats = ["water_level_is_not_flow_or_sound", "station_river_match_unverified", "tidal_influence_unverified"];
  if (!quantilesUsable(st.quantiles)) {
    return unknown("no_station_history_quantiles", chD, t0, [label, chNote, `history_samples:${(st.quantiles as QuantileTable | null)?.n ?? 0}`]);
  }
  return { kind: "station", station: st, quantiles: st.quantiles, chD, distFactor, chNote, label, caveats };
}

/** 時間項：該站 [t0, t1] 逐小時；潛勢＝水位在該站歷史的分位 × 河道距離係數 */
export function riverStationScan(stationObs: readonly RiverObs[], q: QuantileTable, distFactor: number, t0: number, t1: number) {
  return scanHours(
    t0,
    t1,
    RIVER_WATER.bucketDurationS.value,
    (h) => stationObs.find((o) => o.bucketStart === h),
    (o) => {
      const rank = percentileRank(o.levelM, q);
      return rank == null ? { reason: "water_level_null" } : { potential: rank * distFactor };
    },
    "station_hour_missing",
  );
}

export const queryRiverWaterInterval: IntervalQuery<RiverWaterPayload, typeof FAMILY> = (records, receiver, t0, t1) => {
  const sp = riverSpatialAt(riverSpatialContext(records), receiver.longitude, receiver.latitude, t0);
  if (sp.kind === "done") return sp.out;
  const { station: st, quantiles: q, chD, distFactor, chNote, label, caveats } = sp;
  const obs = records.flatMap((r) => (r.payload.kind === "river_obs" && r.payload.stationId === st.stationId ? [r.payload] : []));
  const scan = riverStationScan(obs, q, distFactor, t0, t1);
  const contributions: SourceContribution<typeof FAMILY>[] = [];
  if (scan.best) {
    const o = scan.best.row;
    const rank = percentileRank(o.levelM, q)!;
    contributions.push({
      sourceId: `river:${o.stationId}:${o.bucketStart}`,
      family: FAMILY,
      status: "active",
      sourceTime: iso(o.bucketStart),
      spatialDistanceM: chD,
      relativePotential: scan.best.potential,
      modeledDbA: null,
      evidence: "observed",
      spatialPrecision: "nearest_level_station_x_channel_distance",
      temporalPrecision: "hourly",
      acousticConfidence: "proxy",
      proxyKind: "water_level_percentile",
      notes: [label, `water_level_m:${o.levelM}`, `station_percentile:${rank.toFixed(2)}`, `history_basis:${st.historyBasis ?? "unknown"}`, chNote, ...caveats],
    });
  } else if (scan.firstUnknown) {
    contributions.push(unknownContribution(FAMILY, `river:${st.stationId}`, scan.firstUnknown.reason, scan.firstUnknown.hour, chD, { proxyKind: "water_level_percentile", notes: [label, chNote] }));
  }
  return { contributions, notes: [label, chNote, ...caveats] };
};

// ── 即時載入 ───────────────────────────────────────────────

export const RIVER_QUANTILES_URL = "/sound-atlas/river-level-quantiles.json";

/** 靜態分位檔（未產出時回空物件 → 每站 null → unknown） */
export async function fetchRiverQuantiles(fetchImpl: typeof fetch = fetch): Promise<Record<string, { q: QuantileTable; basis: string }>> {
  return withLoading("sound-river-quantiles", "聲景河川水位分位", (async () => {
    try {
      const res = await fetchImpl(RIVER_QUANTILES_URL);
      if (!res.ok) return {};
      const j = JSON.parse(await res.text()) as { stations?: Record<string, { q: QuantileTable; basis: string }> };
      return j && typeof j === "object" && j.stations ? j.stations : {};
    } catch {
      return {};
    }
  })());
}

export interface RiverFetchers {
  day: (date: string) => Promise<RiverLevelDayRow[]>;
  quantiles: () => Promise<Record<string, { q: QuantileTable; basis: string }>>;
  /** 河道幾何（UI 接線時提供；未提供 → 每個接收點 unknown） */
  network?: () => Promise<{ bbox: Bbox; geometry: GeoJSON.LineString | GeoJSON.MultiLineString } | null>;
}

export const liveRiverFetchers: RiverFetchers = { day: fetchRiverLevelDay, quantiles: () => fetchRiverQuantiles() };

export function riverDayRowsToObs(rows: readonly RiverLevelDayRow[]): RiverObs[] {
  return rows.map((r) => ({
    stationId: r.station_id,
    stationName: r.station_name,
    lon: Number(r.lng),
    lat: Number(r.lat),
    bucketStart: Date.parse(r.bucket_at) / 1000,
    levelM: r.water_level_m == null || !Number.isFinite(Number(r.water_level_m)) ? null : Number(r.water_level_m),
  }));
}

export async function loadRiverWater(ctx: { date: string }, fetchers: RiverFetchers = liveRiverFetchers): Promise<SoundSourceSet<RiverWaterPayload, typeof FAMILY>> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  const base = { family: FAMILY, provider: RIVER_PROVIDER, dateKey: ctx.date, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const };
  try {
    const [rows, qs, net] = await Promise.all([fetchers.day(ctx.date), fetchers.quantiles(), fetchers.network ? fetchers.network() : Promise.resolve(null)]);
    const obs = riverDayRowsToObs(rows);
    const stations = new Map<string, RiverStationInfo>();
    for (const o of obs) {
      if (stations.has(o.stationId)) continue;
      const q = qs[o.stationId];
      stations.set(o.stationId, { stationId: o.stationId, stationName: o.stationName, lon: o.lon, lat: o.lat, quantiles: q?.q ?? null, historyBasis: q?.basis ?? null });
    }
    const records: RiverWaterRecord[] = [
      ...riverObsToRecords(obs),
      ...riverStationRecords([...stations.values()], ctx.date),
      // 即時 RPC 是全台：站點範圍＝全台
      riverExtentRecord(RIVER_WATER.liveStationExtent.value, ctx.date),
      ...(net ? [riverNetworkRecord(net.bbox, net.geometry, ctx.date)] : []),
    ];
    return { family: FAMILY, dateKey: ctx.date, records, coverage: [{ ...base, status: obs.length ? "ok" : "empty", reason: obs.length ? undefined : "no_river_level_rows_for_date" }] };
  } catch (e) {
    return { family: FAMILY, dateKey: ctx.date, records: [], coverage: [{ ...base, status: "error", reason: String(e) }] };
  }
}

export const riverWaterAdapter: SoundSourceAdapter<RiverWaterPayload, typeof FAMILY> = {
  family: FAMILY,
  load: loadRiverWater,
  evaluate: evaluateRiverWater,
  queryInterval: queryRiverWaterInterval,
};
