/**
 * 風×植被 adapter（N03，分布式場的站點代理 × 接收點周圍樹冠）。
 *
 * 資料：
 * - 風：CWA O-A0001-001 全測站逐時（collector `weather.py`）。Supabase `live.weather_observations` 只留 21 天且
 *   **沒有 public RPC**；S3 `weather/archives/<D>.tar.gz` 是正本（每小時一個 json，含座標、風速、陣風）。
 *   → 只有場景快照有風資料；即時路徑回 coverage=unavailable（不新增 RPC，見 ADVANCED_SOURCES.md）。
 * - 植被：Meta/WRI 2020 10 m 樹冠高度（public/forestry/canopy_height_rgb_taiwan.pmtiles，R=公尺、A=遮罩）。
 *   快照預先取樣成格網；即時由 UI 用 rasterProbeSampler.sampleCanopyHeight 取樣後呼叫 canopyGridRecord 注入。
 *
 * 規則：
 * - 接收點不在植被格網內（含 canopyRadiusM）→ unknown（vegetation_not_sampled）。
 * - 100 m 內格點全部被遮罩（A=0：可能是無樹、海或無資料，分不出來）→ unknown（canopy_masked_ambiguous）。
 *   有任一格點有值時，其餘遮罩格點才當「沒有 ≥1 m 樹冠」。
 * - 樹冠 ≥3 m 覆蓋為 0 → 不產生貢獻（inactive）。**不推論建築區紊流／風切聲。**
 * - 最近有風速站超過 maxStationDistanceM、該小時缺列、風速 null → unknown，不當 0。
 * - 潛勢 = windPotential(風速) × vegetationFactor(覆蓋)；風速≠聲級，proxyKind=wind_speed_x_canopy。
 */
import { MODEL_VERSION, WIND_VEGETATION } from "../model/soundProfiles";
import { vegetationFactor, windPotential } from "../engines/naturalKernels";
import { haversineM } from "../engines/geometryDistance";
import { taipeiMidnightMs } from "../../lib/taipeiDay";
import { insideBbox, iso, nearestStation, scanHours, stationLabel, unknownContribution, type Bbox, type StationPoint } from "./naturalShared";
import type { IntervalQuery, SoundSourceAdapter, SoundSourceRecord, SoundSourceSet, SourceContribution, SourceEvaluation } from "../types";
import { cellIndexOf, GRID_SPEC } from "../grid/gridSpec";

export const WIND_PROVIDER = "cwa_weather_obs";
const FAMILY = "wind_vegetation" as const;

export interface WindObs extends StationPoint {
  altitudeM: number | null;
  /** 整點觀測時刻（unix 秒） */
  obsTime: number;
  windSpeedMs: number | null;
  gustMs: number | null;
}

/** 樹冠高度格網：row 0 為最北列；值為公尺，-1 = 遮罩（A=0：無樹／海／無資料無法區分） */
export interface CanopyGrid {
  bbox: Bbox;
  nx: number;
  ny: number;
  heights: readonly number[];
  origin?: string;
}

/**
 * W6-3 全北北樹冠覆蓋：每個 250 m 網格格一個碼（格心 canopyRadiusM 內 ≥3 m 樹冠覆蓋 ×250，四捨五入；
 * 253＝範圍內全部遮罩、254＝沒取樣）。由 TS 預處理對 30 m 樹冠格網呼叫 canopyCover(格心) 產生；
 * 接收點落在哪一格就用那一格的覆蓋（格內不再細分）。
 */
export interface CanopyCells {
  gridId: string;
  codes: Uint8Array;
  origin?: string;
}

export const CANOPY_CELL_SCALE = 250;
export const CANOPY_CELL_MASKED = 253;
export const CANOPY_CELL_NOT_SAMPLED = 254;

export type WindVegetationPayload =
  | ({ kind: "wind_obs" } & WindObs)
  | { kind: "canopy_grid"; grid: CanopyGrid }
  | { kind: "canopy_cells"; cells: CanopyCells }
  /** 風測站清單的完整範圍：接收點在外 → unknown（快照只收 bbox 附近的站） */
  | { kind: "station_extent"; bbox: Bbox };

export type WindVegetationRecord = SoundSourceRecord<WindVegetationPayload, typeof FAMILY>;

const baseRecord = (dateStart: number) => ({
  family: FAMILY,
  modelVersion: MODEL_VERSION,
  validFrom: dateStart,
  validUntil: dateStart + 86_400,
});

export function windObsToRecords(rows: readonly WindObs[]): WindVegetationRecord[] {
  const bucket = WIND_VEGETATION.bucketDurationS.value;
  return rows.map((r) => ({
    id: `wind:${r.stationId}:${r.obsTime}`,
    family: FAMILY,
    geometryKind: "distributed_field",
    payload: { kind: "wind_obs", ...r },
    validFrom: r.obsTime,
    validUntil: r.obsTime + bucket,
    modelVersion: MODEL_VERSION,
    provenance: { provider: WIND_PROVIDER, originalId: r.stationId, observedAt: r.obsTime },
    quality: { location: "exact_observed", time: "observed", emission: "proxy" },
    visibility: "public",
  }));
}

export function canopyGridRecord(grid: CanopyGrid, dateKey: string): WindVegetationRecord {
  return {
    ...baseRecord(taipeiMidnightMs(dateKey) / 1000),
    id: `canopy:${grid.bbox.join(",")}`,
    geometryKind: "area",
    payload: { kind: "canopy_grid", grid },
    provenance: { provider: WIND_PROVIDER, originalId: grid.origin ?? "canopy_height_meta_wri_2020" },
    quality: { location: "approximate", time: "estimated", emission: "unmeasured" },
    visibility: "internal",
  };
}

export function canopyCellsRecord(cells: CanopyCells, dateKey: string): WindVegetationRecord {
  return {
    ...baseRecord(taipeiMidnightMs(dateKey) / 1000),
    id: `canopy:cells:${cells.gridId}`,
    geometryKind: "area",
    payload: { kind: "canopy_cells", cells },
    provenance: { provider: WIND_PROVIDER, originalId: cells.origin ?? "canopy_height_meta_wri_2020" },
    quality: { location: "approximate", time: "estimated", emission: "unmeasured" },
    visibility: "internal",
  };
}

/** 覆蓋比例 → 網格碼（預處理用） */
export function canopyCellCode(c: ReturnType<typeof canopyCover>): number {
  if (c == null) return CANOPY_CELL_NOT_SAMPLED;
  if (c === "masked") return CANOPY_CELL_MASKED;
  return Math.round(c.cover * CANOPY_CELL_SCALE);
}

/** 接收點所在網格格的覆蓋（不在網格或沒取樣 → null；全遮罩 → "masked"） */
export function canopyCellsCover(cells: CanopyCells, lon: number, lat: number): { cover: number; cells: number; withData: number } | "masked" | null {
  if (cells.gridId !== GRID_SPEC.id) return null;
  const i = cellIndexOf(lon, lat);
  if (i < 0) return null;
  const v = cells.codes[i]!;
  if (v === CANOPY_CELL_NOT_SAMPLED || v > CANOPY_CELL_SCALE && v !== CANOPY_CELL_MASKED) return null;
  if (v === CANOPY_CELL_MASKED) return "masked";
  return { cover: v / CANOPY_CELL_SCALE, cells: 0, withData: 0 };
}

export function windExtentRecord(bbox: Bbox, dateKey: string): WindVegetationRecord {
  return {
    ...baseRecord(taipeiMidnightMs(dateKey) / 1000),
    id: `wind:extent:${bbox.join(",")}`,
    geometryKind: "area",
    payload: { kind: "station_extent", bbox },
    provenance: { provider: WIND_PROVIDER },
    quality: { location: "unknown", time: "observed", emission: "unmeasured" },
    visibility: "internal",
  };
}

/**
 * 接收點 radiusM 內的樹冠覆蓋比例（≥ minCanopyHeightM 的格點 / 格點數）。
 * null：不在格網內；'masked'：範圍內全部遮罩（無法區分無樹與無資料）。
 */
export function canopyCover(
  grid: CanopyGrid,
  lon: number,
  lat: number,
  radiusM: number = WIND_VEGETATION.canopyRadiusM.value,
  minHeightM: number = WIND_VEGETATION.minCanopyHeightM.value,
): { cover: number; cells: number; withData: number } | "masked" | null {
  if (!insideBbox(lon, lat, grid.bbox, radiusM)) return null;
  const [w, s, e, n] = grid.bbox;
  const dx = (e - w) / grid.nx;
  const dy = (n - s) / grid.ny;
  const dLat = radiusM / 111_195;
  const dLon = radiusM / (111_195 * Math.cos((lat * Math.PI) / 180));
  const i0 = Math.max(0, Math.floor((lon - dLon - w) / dx));
  const i1 = Math.min(grid.nx - 1, Math.floor((lon + dLon - w) / dx));
  const j0 = Math.max(0, Math.floor((n - (lat + dLat)) / dy));
  const j1 = Math.min(grid.ny - 1, Math.floor((n - (lat - dLat)) / dy));
  let cells = 0;
  let withData = 0;
  let veg = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cLon = w + (i + 0.5) * dx;
      const cLat = n - (j + 0.5) * dy;
      if (haversineM(lon, lat, cLon, cLat) > radiusM) continue;
      cells++;
      const h = grid.heights[j * grid.nx + i];
      if (h == null || h < 0) continue;
      withData++;
      if (h >= minHeightM) veg++;
    }
  }
  if (cells === 0) return null;
  if (withData === 0) return "masked";
  return { cover: veg / cells, cells, withData };
}

export function evaluateWindVegetation(record: WindVegetationRecord, t: number): SourceEvaluation {
  const p = record.payload;
  if (p.kind !== "wind_obs") return { status: "inactive" };
  if (t < record.validFrom || t >= record.validUntil) return { status: "inactive" };
  const pot = windPotential(p.windSpeedMs);
  if (pot == null) return { status: "unknown", reason: "wind_speed_null" };
  if (pot <= 0) return { status: "inactive" };
  return { status: "active", geometry: { lon: p.lon, lat: p.lat, altitudeM: p.altitudeM }, relativeActivity: pot };
}

/** 空間脈絡（樹冠、站點範圍、當日有回報的站；W6-3 網格一次建好、每格共用） */
export interface WindSpatialContext {
  grids: CanopyGrid[];
  cells: CanopyCells[];
  extents: Bbox[];
  /** 當日至少有一筆風速的站，每站一列（obs 中第一次出現的那列，順序同 obs） */
  stations: WindObs[];
}

export function windSpatialContext(records: readonly WindVegetationRecord[]): WindSpatialContext {
  const obs = records.flatMap((r) => (r.payload.kind === "wind_obs" ? [r.payload] : []));
  const reporting = new Set(obs.filter((o) => o.windSpeedMs != null).map((o) => o.stationId));
  const seen = new Set<string>();
  const stations: WindObs[] = [];
  for (const o of obs) {
    if (!reporting.has(o.stationId) || seen.has(o.stationId)) continue;
    seen.add(o.stationId);
    stations.push(o);
  }
  return {
    grids: records.flatMap((r) => (r.payload.kind === "canopy_grid" ? [r.payload.grid] : [])),
    cells: records.flatMap((r) => (r.payload.kind === "canopy_cells" ? [r.payload.cells] : [])),
    extents: records.flatMap((r) => (r.payload.kind === "station_extent" ? [r.payload.bbox] : [])),
    stations,
  };
}

type QueryOut = { contributions: SourceContribution<typeof FAMILY>[]; notes: string[] };

/** 空間項：樹冠 → 站點範圍 → 最近有回報的站（8 km）。done＝已定案（無法判斷或沒有樹冠＝0）；station＝要看該站逐時風速 */
export type WindSpatial =
  | { kind: "done"; out: QueryOut }
  | { kind: "station"; station: WindObs; distanceM: number; vf: number; coverNote: string; label: string };

export function windSpatialAt(ctx: WindSpatialContext, lon: number, lat: number, t0: number): WindSpatial {
  const unknown = (reason: string, d: number | null, t: number, notes: string[] = []): WindSpatial =>
    ({ kind: "done", out: { contributions: [unknownContribution(FAMILY, "wind_vegetation:receiver", reason, t, d, { proxyKind: "wind_speed_x_canopy", notes })], notes: [] } });

  // 1. 植被（靜態）：場景 30 m 格網優先；W6-3 全北北用所在網格格的覆蓋；都沒有 → unknown
  let coverResult: ReturnType<typeof canopyCover> = null;
  for (const g of ctx.grids) {
    coverResult = canopyCover(g, lon, lat);
    if (coverResult) break;
  }
  if (coverResult == null) {
    for (const c of ctx.cells) {
      coverResult = canopyCellsCover(c, lon, lat);
      if (coverResult) break;
    }
  }
  if (coverResult == null) return unknown("vegetation_not_sampled", null, t0);
  if (coverResult === "masked") return unknown("canopy_masked_ambiguous", null, t0, ["alpha0_cannot_distinguish_no_tree_sea_or_nodata"]);
  const vf = vegetationFactor(coverResult.cover)!;
  const coverNote = `canopy_cover_ge${WIND_VEGETATION.minCanopyHeightM.value}m_within${WIND_VEGETATION.canopyRadiusM.value}m:${coverResult.cover.toFixed(2)}`;
  if (vf <= 0) return { kind: "done", out: { contributions: [], notes: [coverNote, "no_canopy:inactive(urban_turbulence_not_inferred)"] } };

  // 2. 風（時變）的空間部分
  if (!ctx.extents.some((b) => insideBbox(lon, lat, b))) return unknown("outside_wind_station_extent", null, t0, [coverNote]);
  const maxD = WIND_VEGETATION.maxStationDistanceM.value;
  const nearest = nearestStation(ctx.stations, lon, lat);
  if (!nearest || nearest.distanceM > maxD) {
    return unknown(`no_wind_station_within_${maxD}m`, nearest?.distanceM ?? null, t0, [coverNote, ...(nearest ? [stationLabel(nearest.station, nearest.distanceM)] : [])]);
  }
  return { kind: "station", station: nearest.station, distanceM: nearest.distanceM, vf, coverNote, label: stationLabel(nearest.station, nearest.distanceM) };
}

/** 時間項：該站 [t0, t1] 逐小時（每小時都要有資料）；潛勢＝windPotential × vf */
export function windStationScan(stationObs: readonly WindObs[], vf: number, t0: number, t1: number) {
  return scanHours(
    t0,
    t1,
    WIND_VEGETATION.bucketDurationS.value,
    (h) => stationObs.find((o) => o.obsTime === h),
    (o) => {
      const wp = windPotential(o.windSpeedMs);
      return wp == null ? { reason: "wind_speed_null" } : { potential: wp * vf };
    },
    "station_hour_missing",
  );
}

export const queryWindVegetationInterval: IntervalQuery<WindVegetationPayload, typeof FAMILY> = (records, receiver, t0, t1) => {
  const { longitude: lon, latitude: lat } = receiver;
  const sp = windSpatialAt(windSpatialContext(records), lon, lat, t0);
  if (sp.kind === "done") return sp.out;
  const { station, distanceM, vf, coverNote, label } = sp;
  const stationObs = records.flatMap((r) => (r.payload.kind === "wind_obs" && r.payload.stationId === station.stationId ? [r.payload] : []));
  const scan = windStationScan(stationObs, vf, t0, t1);
  const contributions: SourceContribution<typeof FAMILY>[] = [];
  if (scan.best) {
    const o = scan.best.row;
    contributions.push({
      sourceId: `wind:${o.stationId}:${o.obsTime}`,
      family: FAMILY,
      status: "active",
      sourceTime: iso(o.obsTime),
      spatialDistanceM: distanceM,
      relativePotential: scan.best.potential,
      modeledDbA: null,
      evidence: "observed",
      spatialPrecision: "nearest_station_wind_x_receiver_canopy",
      temporalPrecision: "hourly",
      acousticConfidence: "proxy",
      proxyKind: "wind_speed_x_canopy",
      notes: [
        label,
        `wind_speed_ms:${o.windSpeedMs}`,
        `gust_ms:${o.gustMs ?? "null"}`,
        coverNote,
        `station_altitude_m:${o.altitudeM ?? "null"}`,
        "wind_speed_is_not_sound_level",
      ],
    });
  } else if (scan.firstUnknown) {
    contributions.push(unknownContribution(FAMILY, `wind:${station.stationId}`, scan.firstUnknown.reason, scan.firstUnknown.hour, distanceM, { proxyKind: "wind_speed_x_canopy", notes: [label, coverNote] }));
  }
  return { contributions, notes: [label, coverNote] };
};

/**
 * 即時路徑：沒有可用的 public RPC（live.weather_observations 只有 collector 寫入，前端禁直打 live.*）。
 * 回 coverage=unavailable，家族結果為 unknown（no_healthy_source），不當 0。
 */
export async function loadWindVegetation(ctx: { date: string }): Promise<SoundSourceSet<WindVegetationPayload, typeof FAMILY>> {
  const start = taipeiMidnightMs(ctx.date) / 1000;
  return {
    family: FAMILY,
    dateKey: ctx.date,
    records: [],
    coverage: [
      { family: FAMILY, provider: WIND_PROVIDER, dateKey: ctx.date, status: "unavailable", windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series", reason: "no_public_rpc_for_weather_observations(snapshot_only)" },
    ],
  };
}

export const windVegetationAdapter: SoundSourceAdapter<WindVegetationPayload, typeof FAMILY> = {
  family: FAMILY,
  load: loadWindVegetation,
  evaluate: evaluateWindVegetation,
  queryInterval: queryWindVegetationInterval,
};
