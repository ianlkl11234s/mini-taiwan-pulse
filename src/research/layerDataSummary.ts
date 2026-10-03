/**
 * AG-1 follow-up: viewport digests for custom-rendered layers (Three.js / self-managed
 * sources) that `queryRenderedFeatures` cannot see. A layer hook that already holds its rows
 * in memory registers a provider (layerKey → summarize(bounds)); `summarizeVisibleLayers`
 * calls it for that layer and tags the entry `basis: "layer_data"`. Providers read only the
 * hook's existing refs/stores — never the network — and stay within the gateway result
 * limits (≤5 items per list, strings ≤60 chars).
 */
import type { AqiStation } from "../types";
import type { EarthquakeGlobalEvent } from "../data/earthquakesGlobalLoader";
import type { YoubikeH3CellData } from "../data/youbikeH3Loader";
import type { TyphoonPoint } from "../data/typhoonTracksLoader";
import { typhoonPointsToGeoJSON } from "../data/typhoonTracksLoader";

export type DataBounds = [west: number, south: number, east: number, north: number];
export type DataArea = { level: "town" | "county"; field: string; items: { name: string; count: number }[] };
export type DataMax = { field: string; value: number; name: string | null; lngLat: [number, number] | null; at?: string };
export type DataRankedItem = { name: string | null; value: number | null; area?: string | null; lngLat: [number, number]; at?: string; detail?: string };
/** Top/bottom rows of one value field inside the view (≤5). */
export type DataRanked = { field: string; order: "desc" | "asc"; items: DataRankedItem[] };
export type LayerDataSummary =
  | { status: "ok"; featureCount: number; capped: false; topAreas: DataArea | null; max: DataMax | null; ranked?: DataRanked; asOf?: string | null; note?: string }
  | { status: "data_not_loaded" }
  | { status: "not_applicable"; reason: "raster"; seeLayerKey: string; note: string };
export type LayerDataProvider = (bounds: DataBounds) => LayerDataSummary;

export const LAYER_DATA_TOP_N = 5;
const MAX_TEXT = 60;

const providers = new Map<string, LayerDataProvider>();
/** Static providers that need no live data. */
const STATIC_PROVIDERS: Record<string, LayerDataProvider> = {
  aqiImagery: () => ({ status: "not_applicable", reason: "raster", seeLayerKey: "aqiStations", note: "空品色階圖是影像，讀不到數值；各站 AQI 請開「空品測站」圖層" }),
};

/** Registers the provider for a layer; returns an unregister that only removes this exact provider. */
export function registerLayerDataProvider(layerKey: string, provider: LayerDataProvider): () => void {
  providers.set(layerKey, provider);
  return () => { if (providers.get(layerKey) === provider) providers.delete(layerKey); };
}
export function layerDataProviderFor(layerKey: string): LayerDataProvider | null {
  return providers.get(layerKey) ?? STATIC_PROVIDERS[layerKey] ?? null;
}

// ── helpers ──────────────────────────────────────────────────────────────
const round5 = (value: number) => Math.round(value * 1e5) / 1e5;
const lngLat = (lng: number, lat: number): [number, number] => [round5(lng), round5(lat)];
export function clipText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** In-bounds test that survives Mapbox's wrapped longitudes (west < -180 / east > 180 at low zoom). */
export function inBounds(bounds: DataBounds, lng: number, lat: number): boolean {
  const [west, south, east, north] = bounds;
  if (!finite(lng) || !finite(lat) || lat < south || lat > north) return false;
  if (east - west >= 360) return true;
  const shifted = ((lng - west) % 360 + 360) % 360; // 0..360 east of the west edge
  return shifted <= east - west;
}

function countAreas(names: (string | null)[], level: DataArea["level"], field: string): DataArea | null {
  const counts = new Map<string, number>();
  for (const name of names) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  if (!counts.size) return null;
  const items = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, LAYER_DATA_TOP_N);
  return { level, field, items };
}
const iso = (unixSec: number) => new Date(unixSec * 1000).toISOString();

// ── aqiStations ──────────────────────────────────────────────────────────
/** Stations in view; max/ranked by AQI (worst first) with county; topAreas = station count per county. */
export function summarizeAqiStations(stations: readonly AqiStation[], bounds: DataBounds): LayerDataSummary {
  if (!stations.length) return { status: "data_not_loaded" };
  const inView = stations.filter(station => inBounds(bounds, station.lon, station.lat));
  const valued = inView.filter(station => finite(station.aqi)).sort((a, b) => b.aqi! - a.aqi!);
  const items = valued.slice(0, LAYER_DATA_TOP_N).map(station => ({
    name: clipText(station.stationName), value: station.aqi!, area: clipText(station.county), lngLat: lngLat(station.lon, station.lat),
    ...(clipText(station.pollutant) ? { detail: `主要污染物 ${clipText(station.pollutant)}`.slice(0, MAX_TEXT) } : {}),
  }));
  const worst = valued[0];
  const asOf = inView.reduce<string | null>((latest, station) => (station.observedAt && (!latest || station.observedAt > latest) ? station.observedAt : latest), null);
  return {
    status: "ok", featureCount: inView.length, capped: false,
    topAreas: countAreas(inView.map(station => clipText(station.county)), "county", "county"),
    max: worst ? { field: "aqi", value: worst.aqi!, name: clipText(worst.stationName), lngLat: lngLat(worst.lon, worst.lat) } : null,
    ranked: { field: "aqi", order: "desc", items }, asOf: clipText(asOf),
    ...(inView.length && !valued.length ? { note: "畫面內測站此時段沒有 AQI 數值" } : {}),
  };
}

// ── youbikeFullness ──────────────────────────────────────────────────────
export type H3CellCenter = (h3Index: string) => [lat: number, lng: number];
/** H3 cells (center in view); max = highest 有車率, ranked = lowest 有車率 (缺車) tie-broken by more docks. */
export function summarizeYoubikeCells(cells: readonly YoubikeH3CellData[], bounds: DataBounds, cellCenter: H3CellCenter): LayerDataSummary {
  if (!cells.length) return { status: "data_not_loaded" };
  const inView: { cell: YoubikeH3CellData; at: [number, number] }[] = [];
  for (const cell of cells) {
    if (!finite(cell.fr)) continue;
    let center: [number, number];
    try { center = cellCenter(cell.h); } catch { continue; }
    if (inBounds(bounds, center[1], center[0])) inView.push({ cell, at: lngLat(center[1], center[0]) });
  }
  const fr = (value: number) => Math.round(value * 1000) / 1000;
  const lowest = [...inView].sort((a, b) => a.cell.fr - b.cell.fr || b.cell.sc - a.cell.sc).slice(0, LAYER_DATA_TOP_N);
  let best: (typeof inView)[number] | null = null;
  for (const entry of inView) if (!best || entry.cell.fr > best.cell.fr) best = entry;
  return {
    status: "ok", featureCount: inView.length, capped: false, topAreas: null,
    max: best ? { field: "fr", value: fr(best.cell.fr), name: null, lngLat: best.at } : null,
    ranked: { field: "fr", order: "asc", items: lowest.map(({ cell, at }) => ({ name: null, value: fr(cell.fr), lngLat: at, detail: `平均約 ${Math.round(cell.sc)} 個車柱` })) },
    note: "單位是 H3 網格（約數百公尺），有車率 0–1；越低越缺車。資料沒有行政區欄位，位置請以座標反查",
  };
}

// ── earthquakesGlobal ────────────────────────────────────────────────────
/** Events inside the drawn time window [from, to] and the view; max/ranked by magnitude. */
export function summarizeEarthquakes(events: readonly EarthquakeGlobalEvent[], bounds: DataBounds, window: { from: number; to: number; label: string }): LayerDataSummary {
  if (!events.length) return { status: "data_not_loaded" };
  const inView = events.filter(event => event.observed_ts >= window.from && event.observed_ts <= window.to && finite(event.mag) && inBounds(bounds, event.lng, event.lat));
  const ranked = [...inView].sort((a, b) => b.mag - a.mag || b.observed_ts - a.observed_ts).slice(0, LAYER_DATA_TOP_N);
  const top = ranked[0];
  const latest = inView.reduce<number | null>((max, event) => (max === null || event.observed_ts > max ? event.observed_ts : max), null);
  return {
    status: "ok", featureCount: inView.length, capped: false, topAreas: null,
    max: top ? { field: "mag", value: top.mag, name: clipText(top.place), lngLat: lngLat(top.lng, top.lat), at: iso(top.observed_ts) } : null,
    ranked: { field: "mag", order: "desc", items: ranked.map(event => ({ name: clipText(event.place), value: event.mag, lngLat: lngLat(event.lng, event.lat), at: iso(event.observed_ts), ...(finite(event.depth_km) ? { detail: `深度 ${Math.round(event.depth_km)} 公里` } : {}) })) },
    asOf: latest === null ? null : iso(latest),
    note: `統計時間窗：${window.label}`.slice(0, MAX_TEXT),
  };
}

// ── typhoonTracks ────────────────────────────────────────────────────────
type ActiveStorm = { stormId: string; name: string | null; lng: number; lat: number; wind: number | null; pressure: number | null; validTs: number };
/** Storms whose current position (the drawn yellow ring) covers `currentTime`; one row per storm. */
export function activeTyphoons(points: readonly TyphoonPoint[], currentTime: number, sourceFilter: string): ActiveStorm[] {
  const byStorm = new Map<string, ActiveStorm>();
  for (const feature of typhoonPointsToGeoJSON([...points]).current.features) {
    const p = feature.properties as Record<string, unknown> | null;
    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    if (!p || !finite(p.valid_ts) || !finite(p.valid_until) || p.valid_ts > currentTime || p.valid_until <= currentTime) continue;
    if (sourceFilter !== "all" && p.source !== sourceFilter) continue;
    const storm: ActiveStorm = {
      stormId: String(p.storm_id), name: clipText(p.name_local) ?? clipText(p.name_en),
      lng: coords[0]!, lat: coords[1]!, wind: finite(p.max_wind_kt) ? p.max_wind_kt : null, pressure: finite(p.center_pressure) ? p.center_pressure : null, validTs: p.valid_ts,
    };
    const seen = byStorm.get(storm.stormId);
    // Several agencies track one storm: keep the stronger / newer reading.
    if (!seen || (storm.wind ?? -1) > (seen.wind ?? -1) || ((storm.wind ?? -1) === (seen.wind ?? -1) && storm.validTs > seen.validTs)) byStorm.set(storm.stormId, storm);
  }
  // JMA and JTWC give one storm different ids: fold positions within ~300 km into one storm
  // (name from whichever agency named it, the strongest wind, the lowest pressure).
  const merged: ActiveStorm[] = [];
  for (const storm of [...byStorm.values()].sort((a, b) => (b.wind ?? -1) - (a.wind ?? -1) || b.validTs - a.validTs)) {
    const twin = merged.find(other => roughKm(other, storm) <= SAME_STORM_KM);
    if (!twin) { merged.push({ ...storm }); continue; }
    twin.name ??= storm.name;
    if (storm.pressure !== null && (twin.pressure === null || storm.pressure < twin.pressure)) twin.pressure = storm.pressure;
  }
  return merged;
}
const SAME_STORM_KM = 300;
function roughKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const dLng = Math.abs(((a.lng - b.lng + 540) % 360) - 180) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLng, a.lat - b.lat) * 111.2;
}
export function summarizeTyphoons(points: readonly TyphoonPoint[], bounds: DataBounds, currentTime: number, sourceFilter = "all", loaded = points.length > 0): LayerDataSummary {
  if (!loaded) return { status: "data_not_loaded" };
  const active = activeTyphoons(points, currentTime, sourceFilter);
  const inView = active.filter(storm => inBounds(bounds, storm.lng, storm.lat));
  const outside = active.filter(storm => !inView.includes(storm)).map(storm => storm.name ?? "未命名").slice(0, 3);
  const items = inView.slice(0, LAYER_DATA_TOP_N).map(storm => ({
    name: storm.name, value: storm.wind, lngLat: lngLat(storm.lng, storm.lat), at: iso(storm.validTs),
    ...(storm.pressure !== null ? { detail: `中心氣壓 ${Math.round(storm.pressure)} hPa` } : {}),
  }));
  const top = inView.find(storm => storm.wind !== null) ?? null;
  const note = !active.length ? "此時間點沒有活動中的颱風"
    : !inView.length ? `畫面內沒有活動颱風；畫面外有：${outside.join("、")}`.slice(0, MAX_TEXT)
    : outside.length ? `畫面外另有：${outside.join("、")}`.slice(0, MAX_TEXT) : undefined;
  return {
    status: "ok", featureCount: inView.length, capped: false, topAreas: null,
    max: top ? { field: "max_wind_kt", value: top.wind!, name: top.name, lngLat: lngLat(top.lng, top.lat), at: iso(top.validTs) } : null,
    ranked: { field: "max_wind_kt", order: "desc", items },
    ...(note ? { note } : {}),
  };
}
