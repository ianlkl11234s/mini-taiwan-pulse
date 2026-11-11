/**
 * W5 自然聲源三族（風×植被、海浪×海岸、河川水聲）的載入入口與場景快照轉換。
 *
 * 同 mvpBSources.ts：刻意獨立、不改 soundAtlasData.ts。主 agent 接 UI 時在 `loadSoundFamily` 的 switch
 * 加三個 case 呼叫 `loadAdvancedFamily` 即可（規格見 docs/features/city-sound-atlas/ADVANCED_SOURCES.md §6）。
 *
 * 快照區塊 `natural`（build-sound-scenes.py --merge-w5 產出，schema pulse-sound-natural-v1）：
 *   wind／wave／river：時變觀測（S3 正本裁切），coverage 取區塊 health，不以 bbox 內筆數重判。
 *   canopy／coast／river_network：靜態脈絡，各自帶 bbox；接收點在外 → 該族 unknown。
 * 沒有 `natural` 區塊 → 走即時（風、浪即時回 unavailable；河川讀 RPC，但沒有河道與分位時仍 unknown）。
 */
import { taipeiMidnightMs } from "../lib/taipeiDay";
import type { QuantileTable } from "./engines/naturalKernels";
import type { Bbox } from "./sourceAdapters/naturalShared";
import { canopyGridRecord, loadWindVegetation, windExtentRecord, windObsToRecords, WIND_PROVIDER, type WindVegetationPayload } from "./sourceAdapters/windVegetationAdapter";
import { coastRecord, loadCoastalWave, waveExtentRecord, waveObsToRecords, WAVE_PROVIDER, type CoastalWavePayload } from "./sourceAdapters/coastalWaveAdapter";
import { loadRiverWater, riverExtentRecord, riverNetworkRecord, riverObsToRecords, riverStationRecords, RIVER_PROVIDER, type RiverWaterPayload } from "./sourceAdapters/riverWaterAdapter";
import type { AdvancedSoundFamily, SoundSourceSet } from "./types";

export const NATURAL_BLOCK_SCHEMA = "pulse-sound-natural-v1";

export type AdvancedSet =
  | SoundSourceSet<WindVegetationPayload, "wind_vegetation">
  | SoundSourceSet<CoastalWavePayload, "coastal_wave">
  | SoundSourceSet<RiverWaterPayload, "river_water">;

type Health = "ok" | "empty" | "error";
interface StationRow {
  id: string;
  name: string | null;
  lon: number;
  lat: number;
}

/** 快照 JSON 的 `natural` 區塊（數值陣列壓縮：obs 每列＝[站序, unix 秒, 值...]，null 保持 null） */
export interface SceneNaturalBlock {
  schema: typeof NATURAL_BLOCK_SCHEMA;
  wind?: { origin?: string; health: Health; bbox: Bbox; stations: (StationRow & { alt_m: number | null })[]; obs: [number, number, number | null, number | null][] };
  wave?: { origin?: string; health: Health; bbox: Bbox; stations: (StationRow & { type: string | null })[]; obs: [number, number, number | null, number | null][] };
  river?: {
    origin?: string;
    health: Health;
    bbox: Bbox;
    history_basis?: string;
    stations: (StationRow & { q: QuantileTable | null })[];
    obs: [number, number, number | null][];
  };
  canopy?: { origin?: string; bbox: Bbox; nx: number; ny: number; heights: number[] };
  coast?: { origin?: string; bbox: Bbox; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon };
  river_network?: { origin?: string; bbox: Bbox; geometry: GeoJSON.LineString | GeoJSON.MultiLineString };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isBbox = (v: unknown): v is Bbox => Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === "number" && Number.isFinite(x));
const isHealth = (v: unknown): v is Health => v === "ok" || v === "empty" || v === "error";
const okSeries = (b: unknown) => isObj(b) && isHealth(b.health) && isBbox(b.bbox) && Array.isArray(b.stations) && Array.isArray(b.obs);

/** 取 `natural` 區塊；各子區塊形狀不對 → 丟掉該子區塊（該族改走即時），不猜 */
export function parseNaturalBlock(json: unknown): SceneNaturalBlock | null {
  if (!isObj(json) || !isObj(json.natural) || json.natural.schema !== NATURAL_BLOCK_SCHEMA) return null;
  const n = json.natural;
  const out: SceneNaturalBlock = { schema: NATURAL_BLOCK_SCHEMA };
  if (okSeries(n.wind)) out.wind = n.wind as SceneNaturalBlock["wind"];
  if (okSeries(n.wave)) out.wave = n.wave as SceneNaturalBlock["wave"];
  if (okSeries(n.river)) out.river = n.river as SceneNaturalBlock["river"];
  const c = n.canopy;
  if (isObj(c) && isBbox(c.bbox) && typeof c.nx === "number" && typeof c.ny === "number" && Array.isArray(c.heights) && c.heights.length === c.nx * c.ny) {
    out.canopy = c as SceneNaturalBlock["canopy"];
  }
  if (isObj(n.coast) && isBbox(n.coast.bbox) && isObj(n.coast.geometry)) out.coast = n.coast as SceneNaturalBlock["coast"];
  if (isObj(n.river_network) && isBbox(n.river_network.bbox) && isObj(n.river_network.geometry)) out.river_network = n.river_network as SceneNaturalBlock["river_network"];
  return out;
}

function coverage<F extends AdvancedSoundFamily>(family: F, provider: string, date: string, status: Health, origin?: string) {
  const start = taipeiMidnightMs(date) / 1000;
  return { family, provider, dateKey: date, status, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" as const, reason: `snapshot:${origin ?? ""}` };
}

const num = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v);

/** 快照 → 某一族的 SoundSourceSet；該族時變子區塊不存在 → null（呼叫端改走即時） */
export function naturalSnapshotSet(block: SceneNaturalBlock, family: AdvancedSoundFamily, date: string): AdvancedSet | null {
  if (family === "wind_vegetation") {
    const w = block.wind;
    if (!w) return null;
    const obs = w.obs.flatMap(([i, t, ws, gust]) => {
      const s = w.stations[i];
      return s ? [{ stationId: s.id, stationName: s.name, lon: s.lon, lat: s.lat, altitudeM: num(s.alt_m), obsTime: t, windSpeedMs: num(ws), gustMs: num(gust) }] : [];
    });
    const records = [...windObsToRecords(obs), windExtentRecord(w.bbox, date)];
    if (block.canopy) records.push(canopyGridRecord({ bbox: block.canopy.bbox, nx: block.canopy.nx, ny: block.canopy.ny, heights: block.canopy.heights, origin: block.canopy.origin }, date));
    return { family, dateKey: date, records, coverage: [coverage(family, WIND_PROVIDER, date, w.health, w.origin)] };
  }
  if (family === "coastal_wave") {
    const v = block.wave;
    if (!v) return null;
    const obs = v.obs.flatMap(([i, t, hs, tp]) => {
      const s = v.stations[i];
      return s ? [{ stationId: s.id, stationName: s.name, stationType: s.type, lon: s.lon, lat: s.lat, obsTime: t, waveHeightM: num(hs), wavePeriodS: num(tp) }] : [];
    });
    const records = [...waveObsToRecords(obs), waveExtentRecord(v.bbox, date)];
    if (block.coast) records.push(coastRecord(block.coast.bbox, block.coast.geometry, date));
    return { family, dateKey: date, records, coverage: [coverage(family, WAVE_PROVIDER, date, v.health, v.origin)] };
  }
  const r = block.river;
  if (!r) return null;
  const obs = r.obs.flatMap(([i, t, lv]) => {
    const s = r.stations[i];
    return s ? [{ stationId: s.id, stationName: s.name, lon: s.lon, lat: s.lat, bucketStart: t, levelM: num(lv) }] : [];
  });
  const stations = r.stations.map((s) => ({ stationId: s.id, stationName: s.name, lon: s.lon, lat: s.lat, quantiles: s.q ?? null, historyBasis: r.history_basis ?? null }));
  const records = [...riverObsToRecords(obs), ...riverStationRecords(stations, date), riverExtentRecord(r.bbox, date)];
  if (block.river_network) records.push(riverNetworkRecord(block.river_network.bbox, block.river_network.geometry, date));
  return { family, dateKey: date, records, coverage: [coverage(family, RIVER_PROVIDER, date, r.health, r.origin)] };
}

/**
 * 載入一個 W5 家族。`snapshotJson` 是已通過 parseSceneSnapshot 且 snapshotApplies 為真的快照原始 JSON；
 * 日期或 bbox 不符時呼叫端要傳 null。
 */
export async function loadAdvancedFamily(
  family: AdvancedSoundFamily,
  date: string,
  snapshotJson: unknown | null = null,
): Promise<{ set: AdvancedSet; origin: "scene" | "live" }> {
  const block = snapshotJson ? parseNaturalBlock(snapshotJson) : null;
  const snap = block ? naturalSnapshotSet(block, family, date) : null;
  if (snap) return { set: snap, origin: "scene" };
  if (family === "wind_vegetation") return { set: await loadWindVegetation({ date }), origin: "live" };
  if (family === "coastal_wave") return { set: await loadCoastalWave({ date }), origin: "live" };
  return { set: await loadRiverWater({ date }), origin: "live" };
}
