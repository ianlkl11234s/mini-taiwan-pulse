import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, TRANSFER_STATION, pointRadius, pointStrokePaint, transferRingColor } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BIKEPOINT_COLOR, GB_CHARGING_ZONES, GB_HUB_FALLBACK_COLOR, GB_HUB_TYPES, GB_HUBS_ATTRIBUTION, GB_JAMCAM_COLOR, GB_JAMCAM_OFFLINE_COLOR,
  GB_LONDON_RAIL_FALLBACK_COLOR, GB_LONDON_RAIL_MODES, GB_LONDON_STATION_COLOR, GB_STATION_USAGE_BUCKETS, GB_STATION_USAGE_NO_DATA_COLOR,
  GB_TFL_MAP_ATTRIBUTION,
} from "../data/gbTransportTypes";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 4 波交通 7 層：樞紐（點）＋站客流（點，同檔）、倫敦軌道線＋車站（同檔）、BikePoint、JamCams、收費區（面）。
 * 同檔兩個 key 各自呼叫 useGbPmtilesLayers（共用 source，隱藏只關自己的 layer）；靜態資料、不訂閱時間。
 */
export const GB_HUBS_CIRCLE_ID = "gb-transport-hubs-circle";
export const GB_STATION_USAGE_CIRCLE_ID = "gb-station-usage-circle";
export const GB_LONDON_RAIL_LINE_ID = "gb-london-rail-lines-line";
export const GB_LONDON_STATIONS_CIRCLE_ID = "gb-london-stations-circle";
export const GB_BIKEPOINTS_CIRCLE_ID = "gb-london-bikepoints-circle";
export const GB_JAMCAMS_CIRCLE_ID = "gb-london-jamcams-circle";
export const GB_CHARGING_FILL_ID = "gb-london-charging-zones-fill";
export const GB_CHARGING_LINE_ID = "gb-london-charging-zones-line";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};

// ─────────────────────────── 樞紐＋站客流（gb_transport_hubs.pmtiles） ───────────────────────────

const HUBS_SOURCE: SourceSpec = {
  id: "gb-transport-hubs", file: "gb_transport_hubs.pmtiles", minzoom: 4, maxzoom: 13, attribution: GB_HUBS_ATTRIBUTION, loading: "英國交通樞紐載入中",
};

function hubColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "hub_type"], ""]];
  for (const t of GB_HUB_TYPES) expr.push(t.value, t.color);
  expr.push(GB_HUB_FALLBACK_COLOR);
  return expr;
}

/** 渡輪碼頭／棧橋（ferry_class=landing，含河川、湖泊碼頭）用 S 階，其餘 M 階。 */
function hubsPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const s = scale / scaleDefault("gbTransportHubs");
  return {
    "circle-radius": ["case", ["==", ["get", "ferry_class"], "landing"], pointRadius("S", s), pointRadius("M", s)],
    "circle-color": hubColor(),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbTransportHubs", 0.85)),
  };
}

export function useGbTransportHubsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, HUBS_SOURCE, visible, () => [{
    id: GB_HUBS_CIRCLE_ID,
    layer: () => ({
      id: GB_HUBS_CIRCLE_ID, type: "circle", source: HUBS_SOURCE.id, "source-layer": "gb_transport_hubs", minzoom: 5,
      layout: { visibility: "none", "circle-sort-key": ["case", ["==", ["get", "ferry_class"], "landing"], 0, 1] },
      paint: hubsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_HUBS_CIRCLE_ID, hubsPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

const HAS_USAGE: Expr = ["!=", ["get", "entries_exits"], null];
/** 只畫大不列顛國鐵站；北愛（ORR 未涵蓋）不畫，圖例標「未涵蓋」。 */
export const GB_STATION_USAGE_FILTER: Expr = ["all", ["==", ["get", "hub_type"], "rail"], ["!=", ["get", "nation"], "Northern Ireland"]];

function usageStep(pick: (b: (typeof GB_STATION_USAGE_BUCKETS)[number]) => unknown): Expr {
  const expr: unknown[] = ["step", ["coalesce", ["get", "entries_exits"], 0], pick(GB_STATION_USAGE_BUCKETS[0]!)];
  for (const b of GB_STATION_USAGE_BUCKETS.slice(1)) expr.push(b.min, pick(b));
  return expr;
}

/** 有客流：依年進出站人次分級（色＋半徑）；null：空心灰框（資料編碼描邊，不畫成 0）。 */
function usagePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const s = scale / scaleDefault("gbStationUsage");
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbStationUsage", 0.85));
  return {
    "circle-radius": ["case", HAS_USAGE, ["*", usageStep((b) => b.radius), s], pointRadius("S", s)],
    "circle-color": usageStep((b) => b.color),
    "circle-opacity": ["case", HAS_USAGE, op, 0],
    "circle-stroke-color": ["case", HAS_USAGE, seam["circle-stroke-color"], GB_STATION_USAGE_NO_DATA_COLOR],
    "circle-stroke-width": ["case", HAS_USAGE, seam["circle-stroke-width"], 1.5],
    "circle-stroke-opacity": ["case", HAS_USAGE, seam["circle-stroke-opacity"], op],
  };
}

export function useGbStationUsageLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, HUBS_SOURCE, visible, () => [{
    id: GB_STATION_USAGE_CIRCLE_ID,
    layer: () => ({
      id: GB_STATION_USAGE_CIRCLE_ID, type: "circle", source: HUBS_SOURCE.id, "source-layer": "gb_transport_hubs", minzoom: 5,
      filter: GB_STATION_USAGE_FILTER,
      // 大站畫在上面
      layout: { visibility: "none", "circle-sort-key": ["coalesce", ["get", "entries_exits"], -1] },
      paint: usagePaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_STATION_USAGE_CIRCLE_ID, usagePaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 倫敦軌道線＋車站（gb_london_rail.pmtiles） ───────────────────────────

const RAIL_SOURCE: SourceSpec = {
  id: "gb-london-rail", file: "gb_london_rail.pmtiles", minzoom: 8, maxzoom: 15, attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦軌道載入中",
};

function railModeColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "mode"], ""]];
  for (const m of GB_LONDON_RAIL_MODES) expr.push(m.value, m.color);
  expr.push(GB_LONDON_RAIL_FALLBACK_COLOR);
  return expr;
}
const railWidth = (): Expr => ["interpolate", ["linear"], ["zoom"], 10, LINE_WIDTH.standard[0], 14, LINE_WIDTH.standard[1]];

export function useGbLondonRailLinesLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbLondonRailLines", 0.85);
  const paint = (op: number) => hookLinePaint("gbLondonRailLines", GB_LONDON_RAIL_LINE_ID,
    { "line-color": railModeColor(), "line-width": railWidth(), "line-opacity": clamp01(op) },
    { "line-color": railModeColor(), "line-width": railWidth(), "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, RAIL_SOURCE, visible, () => [{
    id: GB_LONDON_RAIL_LINE_ID,
    layer: () => ({
      id: GB_LONDON_RAIL_LINE_ID, type: "line", source: RAIL_SOURCE.id, "source-layer": "gb_london_rail_lines", minzoom: 8,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(GB_LONDON_RAIL_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any),
  }], [opacity, isDark]);
}

const IS_INTERCHANGE: Expr = ["any", [">=", ["coalesce", ["get", "line_count"], 0], 2], ["==", ["get", "stop_type"], "TransportInterchange"]];

/** 一般站：捷運站色實心；轉乘站：白底＋深色環（同台灣捷運站 TRANSFER_STATION）。 */
function stationsPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const s = scale / scaleDefault("gbLondonStations");
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbLondonStations", 0.85));
  return {
    "circle-radius": pointRadius("M", s),
    "circle-color": ["case", IS_INTERCHANGE, TRANSFER_STATION.fill, GB_LONDON_STATION_COLOR],
    "circle-opacity": op,
    "circle-stroke-color": ["case", IS_INTERCHANGE, transferRingColor(isDark), seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_INTERCHANGE, TRANSFER_STATION.ringWidth, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_INTERCHANGE, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbLondonStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, RAIL_SOURCE, visible, () => [{
    id: GB_LONDON_STATIONS_CIRCLE_ID,
    layer: () => ({
      id: GB_LONDON_STATIONS_CIRCLE_ID, type: "circle", source: RAIL_SOURCE.id, "source-layer": "gb_london_rail_stations", minzoom: 10,
      layout: { visibility: "none" }, paint: stationsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_LONDON_STATIONS_CIRCLE_ID, stationsPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── Santander Cycles BikePoint ───────────────────────────

const BIKE_SOURCE: SourceSpec = {
  id: "gb-london-bikepoints", file: "gb_london_bikepoints.pmtiles", minzoom: 9, maxzoom: 15, attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦單車站載入中",
};

function bikePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("S", scale / scaleDefault("gbLondonBikePoints")),
    "circle-color": GB_BIKEPOINT_COLOR,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbLondonBikePoints", 0.85)),
  };
}

export function useGbLondonBikePointsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, BIKE_SOURCE, visible, () => [{
    id: GB_BIKEPOINTS_CIRCLE_ID,
    layer: () => ({
      id: GB_BIKEPOINTS_CIRCLE_ID, type: "circle", source: BIKE_SOURCE.id, "source-layer": "gb_london_bikepoints", minzoom: 11,
      layout: { visibility: "none" }, paint: bikePaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_BIKEPOINTS_CIRCLE_ID, bikePaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── JamCams ───────────────────────────

const JAMCAM_SOURCE: SourceSpec = {
  id: "gb-london-jamcams", file: "gb_london_jamcams.pmtiles", minzoom: 9, maxzoom: 15, attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦道路攝影機載入中",
};
const IS_OFFLINE_AT_FETCH: Expr = ["==", ["get", "available_at_fetch"], false];

/** 取得時離線（available_at_fetch=false）→ 空心灰框（資料編碼描邊）；不是即時狀態。 */
function jamcamPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbLondonJamCams", 0.85));
  return {
    "circle-radius": pointRadius("S", scale / scaleDefault("gbLondonJamCams")),
    "circle-color": GB_JAMCAM_COLOR,
    "circle-opacity": ["case", IS_OFFLINE_AT_FETCH, 0, op],
    "circle-stroke-color": ["case", IS_OFFLINE_AT_FETCH, GB_JAMCAM_OFFLINE_COLOR, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_OFFLINE_AT_FETCH, 1.5, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_OFFLINE_AT_FETCH, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbLondonJamCamsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, JAMCAM_SOURCE, visible, () => [{
    id: GB_JAMCAMS_CIRCLE_ID,
    layer: () => ({
      id: GB_JAMCAMS_CIRCLE_ID, type: "circle", source: JAMCAM_SOURCE.id, "source-layer": "gb_london_jamcams", minzoom: 11,
      layout: { visibility: "none" }, paint: jamcamPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_JAMCAMS_CIRCLE_ID, jamcamPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 收費區 ───────────────────────────

const CHARGING_SOURCE: SourceSpec = {
  id: "gb-london-charging-zones", file: "gb_london_charging_zones.pmtiles", minzoom: 6, maxzoom: 14, attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦收費區載入中",
};

function zoneColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "zone"], ""]];
  for (const z of GB_CHARGING_ZONES) expr.push(z.value, z.color);
  expr.push(GB_HUB_FALLBACK_COLOR);
  return expr;
}
/** 塞車費區畫在 ULEZ／LEZ 上面。 */
const ZONE_SORT: Expr = ["match", ["get", "zone"], "congestion_charge", 1, 0];

export function useGbLondonChargingZonesLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbLondonChargingZones", 0.7);
  const fillPaint = (op: number) => hookFillPaint("gbLondonChargingZones", GB_CHARGING_FILL_ID,
    { "fill-color": zoneColor(), "fill-opacity": clamp01(op) }, { "fill-color": zoneColor(), "fill-opacity": def }, isDark);
  const linePaint = (op: number) => hookLinePaint("gbLondonChargingZones", GB_CHARGING_LINE_ID,
    { "line-color": zoneColor(), "line-width": railWidth(), "line-opacity": clamp01(op) },
    { "line-color": zoneColor(), "line-width": railWidth(), "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, CHARGING_SOURCE, visible, () => [
    {
      id: GB_CHARGING_FILL_ID,
      layer: () => ({
        id: GB_CHARGING_FILL_ID, type: "fill", source: CHARGING_SOURCE.id, "source-layer": "gb_london_charging_zones", minzoom: 8,
        layout: { visibility: "none", "fill-sort-key": ZONE_SORT }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_CHARGING_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: GB_CHARGING_LINE_ID,
      layer: () => ({
        id: GB_CHARGING_LINE_ID, type: "line", source: CHARGING_SOURCE.id, "source-layer": "gb_london_charging_zones", minzoom: 8,
        layout: { visibility: "none", "line-cap": "round", "line-join": "round", "line-sort-key": ZONE_SORT }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_CHARGING_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}
