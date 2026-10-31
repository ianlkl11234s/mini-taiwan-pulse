import { useEffect } from "react";
import type { AnyLayer, CircleLayer, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { krGroupFilter, krStringProp } from "../data/krDataLayers";
import {
  KR_AIRPORT_COLOR, KR_AIRPORTS_ATTRIBUTION, KR_BUS_STOPS_ATTRIBUTION, KR_BUS_STOPS_COLOR, KR_BUS_STOPS_COUNT, KR_FALLBACK_COLOR,
  KR_NATIONAL_ROAD_COLOR, KR_NATIONAL_ROADS_ATTRIBUTION, KR_OSM_ATTRIBUTION, KR_PORT_COLOR, KR_PORTS_ATTRIBUTION, KR_RAIL_LINE_CLASSES,
  KR_RAIL_NETWORKS, KR_RAIL_STATIONS_ATTRIBUTION,
} from "../data/krInfraTypes";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 南韓第 1 波交通 6 層：公車站（點，P-4 熱區）、鐵道車站、機場、港灣區（面）、一般國道（線）、鐵道線（OSM）。靜態資料、不訂閱時間。
 */
export const KR_BUS_STOPS_CIRCLE_ID = "kr-bus-stops-circle";
export const KR_BUS_STOPS_HEATMAP_ID = "kr-bus-stops-heatmap";
export const KR_RAIL_STATIONS_CIRCLE_ID = "kr-rail-stations-circle";
export const KR_AIRPORTS_CIRCLE_ID = "kr-airports-circle";
export const KR_PORTS_FILL_ID = "kr-ports-fill";
export const KR_PORTS_LINE_ID = "kr-ports-line";
export const KR_NATIONAL_ROADS_LINE_ID = "kr-national-roads-line";
export const KR_RAIL_LINES_LINE_ID = "kr-rail-lines-line";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
function matchBy(field: string, pairs: readonly (readonly [unknown, unknown])[], fallback: unknown): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const [v, c] of pairs) expr.push(v, c);
  expr.push(fallback);
  return expr;
}
function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

// ─────────────────────────── 公車站（22.7 萬點，P-4：z12 起單點、之下熱區） ───────────────────────────

const BUS_SOURCE_ID = "kr-bus-stops";
// R5（P-4／G-2）：227,059 點；PMTiles 在出點縮放前為抽稀概覽（z14 才全收），不可當筆數依據。
const BUS_POINTS_FROM_ZOOM = densePointsFromZoom(KR_BUS_STOPS_COUNT);
const BUS_HEAT_KEYS = ["krBusStops"] as const;
// 低縮放熱區吃 PMTiles 的 `kr_bus_stops_grid`（0.05° 格 z5–8、0.01° 格 z9–11，屬性 count，總和＝227,059），不再是抽稀概覽；
// 格網圖層 maxzoom 11，故另開一個 maxzoom 11 的 source 讓 z11–12 overzoom 接到 z12 單點，不留縫。
const BUS_GRID_SOURCE_ID = "kr-bus-stops-grid";
const BUS_HEATMAP_INTENSITY = 50;
const BUS_GRID_WEIGHT = ["interpolate", ["linear"], ["coalesce", ["get", "count"], 1], 1, 0.08, 10, 0.3, 100, 0.65, 1000, 1];

export function useKrBusStopsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDarkTheme = true) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature(BUS_HEAT_KEYS);
  const def = Number(paramDefault("krBusStops", "krBusStopsOpacity"));

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of [KR_BUS_STOPS_CIRCLE_ID, KR_BUS_STOPS_HEATMAP_ID]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const mount = () => {
      const op = clamp01(opacity);
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(BUS_SOURCE_ID)) {
        sourceAdded = true;
        map.addSource(BUS_SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl("kr_bus_stops.pmtiles"), attribution: KR_BUS_STOPS_ATTRIBUTION, minzoom: 5, maxzoom: 14,
        } as any);
      }
      if (!map.getSource(BUS_GRID_SOURCE_ID)) {
        map.addSource(BUS_GRID_SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl("kr_bus_stops.pmtiles"), attribution: KR_BUS_STOPS_ATTRIBUTION, minzoom: 5, maxzoom: 11,
        } as any);
      }
      if (!map.getLayer(KR_BUS_STOPS_HEATMAP_ID)) {
        map.addLayer({
          id: KR_BUS_STOPS_HEATMAP_ID, type: "heatmap", source: BUS_GRID_SOURCE_ID, "source-layer": "kr_bus_stops_grid",
          maxzoom: heatmapMaxzoom(BUS_POINTS_FROM_ZOOM), layout: { visibility: "none" },
          paint: heatmapLayerPaint("krBusStops", isDarkTheme, op / def, BUS_HEATMAP_INTENSITY, BUS_GRID_WEIGHT),
        } as HeatmapLayer, map.getLayer(KR_BUS_STOPS_CIRCLE_ID) ? KR_BUS_STOPS_CIRCLE_ID : undefined);
      }
      map.setLayoutProperty(KR_BUS_STOPS_HEATMAP_ID, "visibility", "visible");
      applyHeatmapStyle(map, KR_BUS_STOPS_HEATMAP_ID, "krBusStops", isDarkTheme, op / def);
      if (!map.getLayer(KR_BUS_STOPS_CIRCLE_ID)) {
        map.addLayer({
          id: KR_BUS_STOPS_CIRCLE_ID, type: "circle", source: BUS_SOURCE_ID, "source-layer": "kr_bus_stops", minzoom: BUS_POINTS_FROM_ZOOM,
          layout: { visibility: "none" },
          paint: { "circle-radius": pointRadius("S", scale), "circle-color": KR_BUS_STOPS_COLOR, "circle-opacity": op, ...pointStrokePaint(isDarkTheme, op / def) },
        } as CircleLayer);
      }
      map.setLayoutProperty(KR_BUS_STOPS_CIRCLE_ID, "visibility", "visible");
      map.setPaintProperty(KR_BUS_STOPS_CIRCLE_ID, "circle-opacity", op);
      map.setPaintProperty(KR_BUS_STOPS_CIRCLE_ID, "circle-radius", pointRadius("S", scale));
      for (const [k, v] of Object.entries(pointStrokePaint(isDarkTheme, op / def))) map.setPaintProperty(KR_BUS_STOPS_CIRCLE_ID, k as any, v as never);
      if (sourceAdded) keepLoadingUntilMapIdle(map, "kr-bus-stops:render", "韓國公車站 버스정류장 載入中", BUS_GRID_SOURCE_ID);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, isDarkTheme, mapTick, heatStyle, def]);
}

// ─────────────────────────── 鐵道車站 ───────────────────────────

const RAIL_ST_SOURCE: SourceSpec = {
  id: "kr-rail-stations", file: "kr_rail_stations.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_RAIL_STATIONS_ATTRIBUTION, loading: "韓國鐵道車站載入中",
};
function railStationsPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("krRailStations")),
    "circle-color": matchBy("network", KR_RAIL_NETWORKS.map((n) => [n.value, n.color] as const), KR_FALLBACK_COLOR),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("krRailStations", 0.8)),
  };
}
/** V-4：營運網多選（`krRailStationsCatMask`；選項順序＝`KR_RAIL_NETWORKS`）。 */
export const krRailNetworkFilter = (mask: number | undefined) =>
  krGroupFilter(krStringProp("network"), KR_RAIL_NETWORKS.map((n) => ({ id: n.value, values: [n.value] })), false, mask);
export function useKrRailStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const filter = krRailNetworkFilter(catMask);
  useGbPmtilesLayers(mapRef, RAIL_ST_SOURCE, visible, () => [{
    id: KR_RAIL_STATIONS_CIRCLE_ID,
    layer: () => ({
      // V-1：955 站（<1 萬）直接畫到圖磚起點 z4
      id: KR_RAIL_STATIONS_CIRCLE_ID, type: "circle", source: RAIL_ST_SOURCE.id, "source-layer": "kr_rail_stations", minzoom: 4,
      ...(filter ? { filter } : {}), layout: { visibility: "none" }, paint: railStationsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(KR_RAIL_STATIONS_CIRCLE_ID, (filter ?? null) as any); setPaint(map, KR_RAIL_STATIONS_CIRCLE_ID, railStationsPaint(isDark, opacity, scale)); },
  }], [opacity, scale, isDark, JSON.stringify(filter)]);
}

// ─────────────────────────── 機場 ───────────────────────────

const AIRPORT_SOURCE: SourceSpec = {
  id: "kr-airports", file: "kr_airports.pmtiles", minzoom: 4, maxzoom: 12, attribution: KR_AIRPORTS_ATTRIBUTION, loading: "韓國機場載入中",
};
function airportsPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("L", scale / scaleDefault("krAirports")),
    "circle-color": KR_AIRPORT_COLOR,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("krAirports", 0.85)),
  };
}
export function useKrAirportsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, AIRPORT_SOURCE, visible, () => [{
    id: KR_AIRPORTS_CIRCLE_ID,
    layer: () => ({
      id: KR_AIRPORTS_CIRCLE_ID, type: "circle", source: AIRPORT_SOURCE.id, "source-layer": "kr_airports", minzoom: 5,
      layout: { visibility: "none" }, paint: airportsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, KR_AIRPORTS_CIRCLE_ID, airportsPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 港灣區（面） ───────────────────────────

const PORT_SOURCE: SourceSpec = {
  id: "kr-ports", file: "kr_ports.pmtiles", minzoom: 4, maxzoom: 12, attribution: KR_PORTS_ATTRIBUTION, loading: "韓國港灣區載入中",
};
export function useKrPortsLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("krPorts", 0.45);
  const fillPaint = (op: number) => hookFillPaint("krPorts", KR_PORTS_FILL_ID,
    { "fill-color": KR_PORT_COLOR, "fill-opacity": clamp01(op) }, { "fill-color": KR_PORT_COLOR, "fill-opacity": def }, isDark);
  const linePaint = (op: number) => hookLinePaint("krPorts", KR_PORTS_LINE_ID,
    { "line-color": KR_PORT_COLOR, "line-width": 1, "line-opacity": clamp01(op / def) * 0.9 },
    { "line-color": KR_PORT_COLOR, "line-width": 1, "line-opacity": 0.9 }, isDark);
  useGbPmtilesLayers(mapRef, PORT_SOURCE, visible, () => [
    {
      id: KR_PORTS_FILL_ID,
      layer: () => ({
        id: KR_PORTS_FILL_ID, type: "fill", source: PORT_SOURCE.id, "source-layer": "kr_ports", minzoom: 6,
        layout: { visibility: "none" }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_PORTS_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: KR_PORTS_LINE_ID,
      layer: () => ({
        id: KR_PORTS_LINE_ID, type: "line", source: PORT_SOURCE.id, "source-layer": "kr_ports", minzoom: 6,
        layout: { visibility: "none", "line-join": "round" }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(KR_PORTS_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

// ─────────────────────────── 一般國道 ───────────────────────────

const ROAD_SOURCE: SourceSpec = {
  id: "kr-national-roads", file: "kr_national_roads.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_NATIONAL_ROADS_ATTRIBUTION, loading: "韓國一般國道載入中",
};
export function useKrNationalRoadsLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("krNationalRoads", 0.85);
  const width = ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, LINE_WIDTH.standard[0], 14, LINE_WIDTH.standard[1]];
  const paint = (op: number) => hookLinePaint("krNationalRoads", KR_NATIONAL_ROADS_LINE_ID,
    { "line-color": KR_NATIONAL_ROAD_COLOR, "line-width": width, "line-opacity": clamp01(op) },
    { "line-color": KR_NATIONAL_ROAD_COLOR, "line-width": width, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, ROAD_SOURCE, visible, () => [{
    id: KR_NATIONAL_ROADS_LINE_ID,
    layer: () => ({
      id: KR_NATIONAL_ROADS_LINE_ID, type: "line", source: ROAD_SOURCE.id, "source-layer": "kr_national_roads", minzoom: 5,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(KR_NATIONAL_ROADS_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any),
  }], [opacity, isDark]);
}

// ─────────────────────────── 鐵道線（OSM） ───────────────────────────

const RAIL_LINE_SOURCE: SourceSpec = {
  id: "kr-rail-lines", file: "kr_rail_lines.pmtiles", minzoom: 4, maxzoom: 13, attribution: KR_OSM_ATTRIBUTION, loading: "韓國鐵道線載入中",
};
const railClassPairs = (pick: (c: (typeof KR_RAIL_LINE_CLASSES)[number]) => unknown) =>
  KR_RAIL_LINE_CLASSES.flatMap((c) => c.raw.map((r) => [r, pick(c)] as const));
/** V-4：線別多選（`krRailLinesCatMask`；選項順序＝`KR_RAIL_LINE_CLASSES`，「其他」含 industrial／military 等原值）。 */
export const krRailClassFilter = (mask: number | undefined) =>
  krGroupFilter(krStringProp("line_class"), KR_RAIL_LINE_CLASSES.map((c) => ({ id: c.value, values: c.raw })), false, mask);
/** V-1：z<7 不畫側線／車庫線與其他（8,727 段細線會糊成一片），幹線、支線、地鐵、輕軌 z4 起畫。 */
const RAIL_MINOR_FROM = 7;
export function useKrRailLinesLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("krRailLines", 0.85);
  const filter = krRailClassFilter(catMask);
  const color = matchBy("line_class", railClassPairs((c) => c.color), KR_FALLBACK_COLOR);
  const opMul = (op: number): Expr => {
    const at = (minorToo: boolean): Expr => ["*", clamp01(op), matchBy("line_class", railClassPairs((c) => (!minorToo && (c.value === "yard_service" || c.value === "other") ? 0 : c.opacity)), minorToo ? 0.7 : 0)];
    return ["step", ["zoom"], at(false), RAIL_MINOR_FROM, at(true)];
  };
  const w = (f: number): Expr => matchBy("line_class", railClassPairs((c) => (c.width === "emphasis" ? 1.6 : c.width === "standard" ? 1 : 0.5) * f), 0.5);
  const width: Expr = ["interpolate", ["linear"], ["zoom"], 4, w(0.5), 5, w(0.6), 10, w(1), 14, w(1.8)];
  const paint = (op: number) => hookLinePaint("krRailLines", KR_RAIL_LINES_LINE_ID,
    { "line-color": color, "line-width": width, "line-opacity": opMul(op) }, { "line-color": color, "line-width": width, "line-opacity": opMul(def) }, isDark);
  useGbPmtilesLayers(mapRef, RAIL_LINE_SOURCE, visible, () => [{
    id: KR_RAIL_LINES_LINE_ID,
    layer: () => ({
      id: KR_RAIL_LINES_LINE_ID, type: "line", source: RAIL_LINE_SOURCE.id, "source-layer": "kr_rail_lines", minzoom: 4,
      ...(filter ? { filter } : {}), layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(KR_RAIL_LINES_LINE_ID, (filter ?? null) as any); map.setPaintProperty(KR_RAIL_LINES_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any); },
  }], [opacity, isDark, JSON.stringify(filter)]);
}
