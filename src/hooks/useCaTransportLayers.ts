import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { krGroupFilter, krStringProp } from "../data/krDataLayers";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import {
  CA_AIRPORT_CLASSES, CA_AIRPORT_MAJOR_IDS, CA_AIRPORTS_SOURCE, CA_FALLBACK_COLOR, CA_HUB_MINOR_FROM_ZOOM, CA_PORT_MAJOR_IDS, CA_PORT_TYPES,
  CA_RAIL_MINOR_FROM_ZOOM, CA_RAIL_SOURCE, CA_RAIL_STATION_TYPES, CA_RAIL_STATIONS_FROM_ZOOM, CA_RAIL_TRACK_CLASSES, CA_ROAD_CLASSES, CA_ROADS_SOURCE,
  CA_TRANSIT_COUNT, CA_TRANSIT_SOURCE, CA_TRANSIT_TYPES, type CaCat,
} from "../data/caInfraTypes";
import { gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

/**
 * 加拿大第 1 波交通 4 層（C009 站點、C013 機場港口、C012 道路與鐵道）。靜態 PMTiles、不訂閱時間。
 * 規格（類別、色、署名）在 `data/caInfraTypes.ts`；layer id 寫字面值（gisClickRegistry／lineFillTiers 以字面值比對）。
 * V-1：國家全覽 z3.5 看得到——站點用格網熱區、機場港口與道路鐵道只畫主要類別；V-4：有名目分類的子層都可多選篩選。
 */
export const CA_TRANSIT_HEATMAP_ID = "ca-transit-stops-heatmap";
export const CA_TRANSIT_CIRCLE_ID = "ca-transit-stops-circle";
export const CA_AIRPORTS_CIRCLE_ID = "ca-airports-circle";
export const CA_AIRPORTS_MINOR_CIRCLE_ID = "ca-airports-minor-circle";
export const CA_PORTS_CIRCLE_ID = "ca-ports-circle";
export const CA_PORTS_MINOR_CIRCLE_ID = "ca-ports-minor-circle";
export const CA_MAJOR_ROADS_LINE_ID = "ca-major-roads-line";
export const CA_RAIL_TRACKS_LINE_ID = "ca-rail-tracks-line";
export const CA_RAIL_TRACKS_MINOR_LINE_ID = "ca-rail-tracks-minor-line";
export const CA_RAIL_STATIONS_CIRCLE_ID = "ca-rail-stations-circle";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
const sig = (v: unknown) => JSON.stringify(v);
export const caAllOf = (...parts: (unknown[] | null | undefined)[]): unknown[] | null => {
  const ps = parts.filter((p): p is unknown[] => !!p);
  return ps.length === 0 ? null : ps.length === 1 ? ps[0]! : ["all", ...ps];
};
/** 類別色：match(prop 轉字串) → 色。 */
export function caCatColor(prop: string, cats: readonly CaCat[], fallback = CA_FALLBACK_COLOR): Expr {
  const expr: unknown[] = ["match", krStringProp(prop)];
  for (const c of cats) if (c.values.length) expr.push([...c.values], c.color);
  expr.push(fallback);
  return expr;
}
/** 類別多選 mask → filter（選項順序＝cats 宣告順序；`withOther` 時最後一類 values 為空＝「不在其他類」）。 */
export function caCatFilter(prop: string, cats: readonly CaCat[], mask: number | undefined, withOther = false): unknown[] | null {
  const groups = (withOther ? cats.slice(0, -1) : cats).map((c) => ({ id: c.id, values: c.values }));
  return krGroupFilter(krStringProp(prop), groups, withOther, mask);
}
const inCats = (prop: string, cats: readonly CaCat[], ids: readonly string[]): Expr =>
  ["in", krStringProp(prop), ["literal", cats.filter((c) => ids.includes(c.id)).flatMap((c) => [...c.values])]];
function circleBuild(o: { id: string; source: SourceSpec; sourceLayer: string; minzoom: number; filter: unknown[] | null; paint: () => Record<string, unknown>; sortKey?: unknown }): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type: "circle", source: o.source.id, "source-layer": o.sourceLayer, minzoom: o.minzoom, ...(o.filter ? { filter: o.filter } : {}),
      layout: { visibility: "none", ...(o.sortKey ? { "circle-sort-key": o.sortKey } : {}) }, paint: o.paint(),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(o.id, (o.filter ?? null) as any); setPaint(map, o.id, o.paint()); },
  };
}
function zoomWidth(at: (idx: 0 | 1) => unknown): Expr {
  return ["interpolate", ["linear"], ["zoom"], 4, ["*", 0.5, at(0) as number], 10, at(0), 14, at(1)];
}

// ─────────────────────────── 公共運輸站點（11.9 萬點，P-4：z12 起單點、之下格網熱區） ───────────────────────────

const TRANSIT_SOURCE: SourceSpec = { id: "ca-transit-stops", file: "ca_transit_stops.pmtiles", minzoom: 10, maxzoom: 14, attribution: CA_TRANSIT_SOURCE.short, loading: "加拿大公共運輸站點載入中" };
// 格網層 `ca_transit_stops_grid`（count）只在 z3–9 的圖磚：另開 maxzoom 9 的 source，讓 z9–12 overzoom 接到單點，不留縫。
const TRANSIT_GRID_SOURCE: SourceSpec = { id: "ca-transit-stops-grid", file: "ca_transit_stops.pmtiles", minzoom: 3, maxzoom: 9, attribution: CA_TRANSIT_SOURCE.short, loading: "加拿大公共運輸站點載入中" };
export const CA_TRANSIT_POINTS_FROM_ZOOM = densePointsFromZoom(CA_TRANSIT_COUNT, 10);
const TRANSIT_HEAT_INTENSITY = 200;
// 粗格（z3–7）與細格（z8–9）同一組 intensity：細格權重壓低，避免 z8 起整片飽和（2026-11-04 多倫多 z8 目視校正）。
const TRANSIT_GRID_WEIGHT = ["*", ["match", ["get", "res"], "fine", 0.12, 1], ["interpolate", ["linear"], ["coalesce", ["get", "count"], 1], 1, 0.08, 10, 0.3, 100, 0.65, 1000, 1]];
export const caTransitTypeFilter = (mask: number | undefined) => caCatFilter("location_type", CA_TRANSIT_TYPES, mask);

export function useCaTransitStopsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const heatStyle = useHeatmapStyleSignature(["caTransitStops"]);
  const def = opacityDefault("caTransitStops", 0.6);
  const filter = caTransitTypeFilter(catMask);
  useGbPmtilesLayers(mapRef, TRANSIT_GRID_SOURCE, visible, () => [gbHeatmapBuild({
    id: CA_TRANSIT_HEATMAP_ID, key: "caTransitStops", sourceId: TRANSIT_GRID_SOURCE.id, sourceLayer: "ca_transit_stops_grid",
    maxzoom: heatmapMaxzoom(CA_TRANSIT_POINTS_FROM_ZOOM), isDark, opacityScale: clamp01(opacity) / def, intensity: TRANSIT_HEAT_INTENSITY, weight: TRANSIT_GRID_WEIGHT,
  })], [opacity, isDark, heatStyle]);
  useGbPmtilesLayers(mapRef, TRANSIT_SOURCE, visible, () => [circleBuild({
    id: CA_TRANSIT_CIRCLE_ID, source: TRANSIT_SOURCE, sourceLayer: "ca_transit_stops", minzoom: CA_TRANSIT_POINTS_FROM_ZOOM, filter,
    paint: () => ({
      "circle-radius": pointRadius("S", scale / scaleDefault("caTransitStops")), "circle-color": caCatColor("location_type", CA_TRANSIT_TYPES),
      "circle-opacity": clamp01(opacity), ...pointStrokePaint(isDark, clamp01(opacity) / def),
    }),
  })], [opacity, scale, isDark, sig(filter)]);
}

// ─────────────────────────── 機場與港口（同檔兩個 tile layer） ───────────────────────────

const HUBS_SOURCE: SourceSpec = { id: "ca-airports-ports", file: "ca_airports_ports.pmtiles", minzoom: 2, maxzoom: 12, attribution: CA_AIRPORTS_SOURCE.short, loading: "加拿大機場與港口載入中" };
export const caAirportClassFilter = (mask: number | undefined) => caCatFilter("source_class", CA_AIRPORT_CLASSES, mask);
export const caPortTypeFilter = (mask: number | undefined) => caCatFilter("sub_type", CA_PORT_TYPES, mask);

export function useCaAirportsPortsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, airportMask?: number, portMask?: number) {
  const def = opacityDefault("caAirportsPorts", 0.8);
  const af = caAirportClassFilter(airportMask);
  const pf = caPortTypeFilter(portMask);
  const airportMajor = inCats("source_class", CA_AIRPORT_CLASSES, CA_AIRPORT_MAJOR_IDS);
  const portMajor = inCats("sub_type", CA_PORT_TYPES, CA_PORT_MAJOR_IDS);
  const paint = (prop: string, cats: readonly CaCat[], tier: "M" | "S") => () => ({
    "circle-radius": pointRadius(tier, scale / scaleDefault("caAirportsPorts")), "circle-color": caCatColor(prop, cats),
    "circle-opacity": clamp01(opacity), ...pointStrokePaint(isDark, clamp01(opacity) / def),
  });
  useGbPmtilesLayers(mapRef, HUBS_SOURCE, visible, () => [
    circleBuild({ id: CA_PORTS_MINOR_CIRCLE_ID, source: HUBS_SOURCE, sourceLayer: "ca_ports", minzoom: CA_HUB_MINOR_FROM_ZOOM, filter: caAllOf(["!", portMajor], pf), paint: paint("sub_type", CA_PORT_TYPES, "S") }),
    circleBuild({ id: CA_PORTS_CIRCLE_ID, source: HUBS_SOURCE, sourceLayer: "ca_ports", minzoom: 2, filter: caAllOf(portMajor, pf), paint: paint("sub_type", CA_PORT_TYPES, "M") }),
    circleBuild({ id: CA_AIRPORTS_MINOR_CIRCLE_ID, source: HUBS_SOURCE, sourceLayer: "ca_airports", minzoom: CA_HUB_MINOR_FROM_ZOOM, filter: caAllOf(["!", airportMajor], af), paint: paint("source_class", CA_AIRPORT_CLASSES, "S") }),
    circleBuild({ id: CA_AIRPORTS_CIRCLE_ID, source: HUBS_SOURCE, sourceLayer: "ca_airports", minzoom: 2, filter: caAllOf(airportMajor, af), paint: paint("source_class", CA_AIRPORT_CLASSES, "M") }),
  ], [opacity, scale, isDark, sig(af), sig(pf)]);
}

// ─────────────────────────── 主要道路（NRN 三級） ───────────────────────────

const ROADS_SOURCE: SourceSpec = { id: "ca-major-roads", file: "ca_major_roads.pmtiles", minzoom: 3, maxzoom: 13, attribution: CA_ROADS_SOURCE.short, loading: "加拿大主要道路載入中" };
export const caRoadClassFilter = (mask: number | undefined) => caCatFilter("roadclass", CA_ROAD_CLASSES, mask);
const roadWidth = (): Expr => zoomWidth((i) => {
  const expr: unknown[] = ["match", ["get", "roadclass"]];
  for (const c of CA_ROAD_CLASSES) expr.push([...c.values], LINE_WIDTH[c.width][i]);
  expr.push(LINE_WIDTH.thin[i]);
  return expr;
});
const roadSortKey = (): Expr => ["match", ["get", "roadclass"], "Freeway", 3, "Expressway / Highway", 2, 1];

export function useCaMajorRoadsLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("caMajorRoads", 0.85);
  const filter = caRoadClassFilter(catMask);
  const paint = (op: number) => hookLinePaint("caMajorRoads", CA_MAJOR_ROADS_LINE_ID,
    { "line-color": caCatColor("roadclass", CA_ROAD_CLASSES), "line-width": roadWidth(), "line-opacity": clamp01(op) },
    { "line-color": caCatColor("roadclass", CA_ROAD_CLASSES), "line-width": roadWidth(), "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, ROADS_SOURCE, visible, () => [{
    id: CA_MAJOR_ROADS_LINE_ID,
    layer: () => ({
      id: CA_MAJOR_ROADS_LINE_ID, type: "line", source: ROADS_SOURCE.id, "source-layer": "ca_major_roads", minzoom: 3, ...(filter ? { filter } : {}),
      layout: { visibility: "none", ...hookLineLayout("caMajorRoads", CA_MAJOR_ROADS_LINE_ID), "line-sort-key": roadSortKey() }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(CA_MAJOR_ROADS_LINE_ID, (filter ?? null) as any); map.setPaintProperty(CA_MAJOR_ROADS_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any); },
  }], [opacity, isDark, sig(filter)]);
}

// ─────────────────────────── 鐵道（軌道線＋車站） ───────────────────────────

const RAIL_SOURCE: SourceSpec = { id: "ca-railways", file: "ca_railways.pmtiles", minzoom: 3, maxzoom: 13, attribution: CA_RAIL_SOURCE.short, loading: "加拿大鐵道載入中" };
const RAIL_MAJOR_IDS = ["main", "connecting", "ferry"];
export const caRailTrackFilter = (mask: number | undefined) => caCatFilter("track_class", CA_RAIL_TRACK_CLASSES, mask);
export const caRailStationFilter = (mask: number | undefined) => caCatFilter("station_type", CA_RAIL_STATION_TYPES, mask);
const railWidth = (): Expr => zoomWidth((i) => {
  const expr: unknown[] = ["match", ["get", "track_class"]];
  for (const c of CA_RAIL_TRACK_CLASSES) expr.push([...c.values], LINE_WIDTH[c.width][i]);
  expr.push(LINE_WIDTH.thin[i]);
  return expr;
});
const railOpacity = (op: number): Expr => {
  const expr: unknown[] = ["match", ["get", "track_class"]];
  for (const c of CA_RAIL_TRACK_CLASSES) expr.push([...c.values], c.opacity);
  expr.push(0.55);
  return ["*", clamp01(op), expr];
};

export function useCaRailwaysLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, trackMask?: number, stationMask?: number) {
  const def = opacityDefault("caRailways", 0.85);
  const tf = caRailTrackFilter(trackMask);
  const sf = caRailStationFilter(stationMask);
  const major = inCats("track_class", CA_RAIL_TRACK_CLASSES, RAIL_MAJOR_IDS);
  const linePaint = (id: string) => (op: number) => hookLinePaint("caRailways", id,
    { "line-color": caCatColor("track_class", CA_RAIL_TRACK_CLASSES), "line-width": railWidth(), "line-opacity": railOpacity(op) },
    { "line-color": caCatColor("track_class", CA_RAIL_TRACK_CLASSES), "line-width": railWidth(), "line-opacity": railOpacity(def) }, isDark);
  const lineBuild = (id: string, minzoom: number, filter: unknown[] | null): LayerBuild => ({
    id,
    layer: () => ({
      id, type: "line", source: RAIL_SOURCE.id, "source-layer": "ca_rail_tracks", minzoom, ...(filter ? { filter } : {}),
      layout: { visibility: "none", ...hookLineLayout("caRailways", id) }, paint: linePaint(id)(opacity),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(id, (filter ?? null) as any); map.setPaintProperty(id, "line-opacity", linePaint(id)(opacity)["line-opacity"] as any); },
  });
  useGbPmtilesLayers(mapRef, RAIL_SOURCE, visible, () => [
    lineBuild(CA_RAIL_TRACKS_MINOR_LINE_ID, CA_RAIL_MINOR_FROM_ZOOM, caAllOf(["!", major], tf)),
    lineBuild(CA_RAIL_TRACKS_LINE_ID, 3, caAllOf(major, tf)),
    circleBuild({
      id: CA_RAIL_STATIONS_CIRCLE_ID, source: RAIL_SOURCE, sourceLayer: "ca_rail_stations", minzoom: CA_RAIL_STATIONS_FROM_ZOOM, filter: sf,
      paint: () => ({
        "circle-radius": pointRadius("M", scale / scaleDefault("caRailways")), "circle-color": caCatColor("station_type", CA_RAIL_STATION_TYPES),
        "circle-opacity": clamp01(opacity), ...pointStrokePaint(isDark, clamp01(opacity) / def),
      }),
    }),
  ], [opacity, scale, isDark, sig(tf), sig(sf)]);
}
