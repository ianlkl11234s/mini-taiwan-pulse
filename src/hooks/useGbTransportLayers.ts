import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLinePaint } from "../map/lineFillSpec";
import { LINE_WIDTH, TRANSFER_STATION, heatmapMaxzoom, pointRadius, pointStrokePaint, transferRingColor } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_BIKEPOINT_COLOR, GB_CHARGING_ZONES, GB_HUB_FALLBACK_COLOR, GB_HUB_TYPES, GB_HUBS_ATTRIBUTION, GB_JAMCAM_COLOR, GB_JAMCAM_OFFLINE_COLOR,
  GB_LONDON_RAIL_FALLBACK_COLOR, GB_LONDON_RAIL_MODES, GB_LONDON_STATION_COLOR, GB_STATION_USAGE_BUCKETS, GB_STATION_USAGE_NO_DATA_COLOR,
  GB_TFL_MAP_ATTRIBUTION,
  GB_AADF_ALL_MINZOOM, GB_AADF_BUCKETS, GB_AADF_MAJOR_CLASSES, GB_AADF_MAJOR_MINZOOM, GB_AADF_METHOD_FILTERS,
  GB_DFT_ROAD_TRAFFIC_ATTRIBUTION, GB_ROAD_CLASSES, GB_ROAD_FALLBACK_COLOR, GB_ROADS_MAP_ATTRIBUTION,
} from "../data/gbTransportTypes";
import { gbHeatmapBuild, gbMaskFilter, gbWithFilter, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 4 波交通 7 層：樞紐（點）＋站客流（點，同檔）、倫敦軌道線＋車站（同檔）、BikePoint、JamCams、收費區（面）。
 * 第 10 波加主要路網（線）與 AADF 交通計數點（點）。
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
export const GB_MAJOR_ROADS_LINE_ID = "gb-major-roads-line";
export const GB_AADF_MAJOR_CIRCLE_ID = "gb-traffic-counts-aadf-major-circle";
export const GB_AADF_MINOR_CIRCLE_ID = "gb-traffic-counts-aadf-minor-circle";

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
  // §3.8 V-1：重切 z0 起的新檔（`_v2`；舊檔 z4 起已在 S3、不覆寫），任何縮放都看得到
  id: "gb-transport-hubs", file: "gb_transport_hubs_v2.pmtiles", minzoom: 0, maxzoom: 13, attribution: GB_HUBS_ATTRIBUTION, loading: "英國交通樞紐載入中",
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

export function useGbTransportHubsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, typeMask: number | undefined, isDark: boolean) {
  // §3.8 V-4：依樞紐類型多選
  const filter = gbMaskFilter("hub_type", typeMask, GB_HUB_TYPES.map((t) => t.value));
  useGbPmtilesLayers(mapRef, HUBS_SOURCE, visible, () => gbWithFilter([{
    id: GB_HUBS_CIRCLE_ID,
    layer: () => ({
      id: GB_HUBS_CIRCLE_ID, type: "circle", source: HUBS_SOURCE.id, "source-layer": "gb_transport_hubs", minzoom: HUBS_SOURCE.minzoom,
      layout: { visibility: "none", "circle-sort-key": ["case", ["==", ["get", "ferry_class"], "landing"], 0, 1] },
      paint: hubsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_HUBS_CIRCLE_ID, hubsPaint(isDark, opacity, scale)),
  }], filter), [opacity, scale, typeMask, isDark]);
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
      id: GB_STATION_USAGE_CIRCLE_ID, type: "circle", source: HUBS_SOURCE.id, "source-layer": "gb_transport_hubs", minzoom: HUBS_SOURCE.minzoom,
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
  id: "gb-london-rail", file: "gb_london_rail_v2.pmtiles", minzoom: 4, maxzoom: 15, // §3.8 V-1：z4 起重切檔（舊檔 z8 起不覆寫）
   attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦軌道載入中",
};

function railModeColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "mode"], ""]];
  for (const m of GB_LONDON_RAIL_MODES) expr.push(m.value, m.color);
  expr.push(GB_LONDON_RAIL_FALLBACK_COLOR);
  return expr;
}
const railWidth = (): Expr => ["interpolate", ["linear"], ["zoom"], 10, LINE_WIDTH.standard[0], 14, LINE_WIDTH.standard[1]];

export function useGbLondonRailLinesLayer(mapRef: MapRef, visible: boolean, opacity: number, modeMask: number | undefined, isDark: boolean) {
  // §3.8 V-4：依路網類型多選
  const filter = gbMaskFilter("mode", modeMask, GB_LONDON_RAIL_MODES.map((m) => m.value));
  const def = opacityDefault("gbLondonRailLines", 0.85);
  const paint = (op: number) => hookLinePaint("gbLondonRailLines", GB_LONDON_RAIL_LINE_ID,
    { "line-color": railModeColor(), "line-width": railWidth(), "line-opacity": clamp01(op) },
    { "line-color": railModeColor(), "line-width": railWidth(), "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, RAIL_SOURCE, visible, () => gbWithFilter([{
    id: GB_LONDON_RAIL_LINE_ID,
    layer: () => ({
      id: GB_LONDON_RAIL_LINE_ID, type: "line", source: RAIL_SOURCE.id, "source-layer": "gb_london_rail_lines", minzoom: RAIL_SOURCE.minzoom,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(GB_LONDON_RAIL_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any),
  }], filter), [opacity, modeMask, isDark]);
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
      id: GB_LONDON_STATIONS_CIRCLE_ID, type: "circle", source: RAIL_SOURCE.id, "source-layer": "gb_london_rail_stations", minzoom: RAIL_SOURCE.minzoom,
      layout: { visibility: "none" }, paint: stationsPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_LONDON_STATIONS_CIRCLE_ID, stationsPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── Santander Cycles BikePoint ───────────────────────────

const BIKE_SOURCE: SourceSpec = {
  id: "gb-london-bikepoints", file: "gb_london_bikepoints_v2.pmtiles", minzoom: 4, maxzoom: 15, // §3.8 V-1：z4 起重切檔
   attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦單車站載入中",
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
      id: GB_BIKEPOINTS_CIRCLE_ID, type: "circle", source: BIKE_SOURCE.id, "source-layer": "gb_london_bikepoints", minzoom: BIKE_SOURCE.minzoom,
      layout: { visibility: "none" }, paint: bikePaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_BIKEPOINTS_CIRCLE_ID, bikePaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── JamCams ───────────────────────────

const JAMCAM_SOURCE: SourceSpec = {
  // §3.8 V-1：重切 z5 起的新檔（`_v2`；舊檔 z9 起已在 S3、不覆寫）
  id: "gb-london-jamcams", file: "gb_london_jamcams_v2.pmtiles", minzoom: 5, maxzoom: 15, attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦道路攝影機載入中",
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
      id: GB_JAMCAMS_CIRCLE_ID, type: "circle", source: JAMCAM_SOURCE.id, "source-layer": "gb_london_jamcams", minzoom: JAMCAM_SOURCE.minzoom,
      layout: { visibility: "none" }, paint: jamcamPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_JAMCAMS_CIRCLE_ID, jamcamPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 收費區 ───────────────────────────

const CHARGING_SOURCE: SourceSpec = {
  id: "gb-london-charging-zones", file: "gb_london_charging_zones_v2.pmtiles", minzoom: 4, maxzoom: 14, // §3.8 V-1：z4 起重切檔
   attribution: GB_TFL_MAP_ATTRIBUTION, loading: "倫敦收費區載入中",
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
        id: GB_CHARGING_FILL_ID, type: "fill", source: CHARGING_SOURCE.id, "source-layer": "gb_london_charging_zones", minzoom: CHARGING_SOURCE.minzoom,
        layout: { visibility: "none", "fill-sort-key": ZONE_SORT }, paint: fillPaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_CHARGING_FILL_ID, "fill-opacity", fillPaint(opacity)["fill-opacity"] as any),
    },
    {
      id: GB_CHARGING_LINE_ID,
      layer: () => ({
        id: GB_CHARGING_LINE_ID, type: "line", source: CHARGING_SOURCE.id, "source-layer": "gb_london_charging_zones", minzoom: CHARGING_SOURCE.minzoom,
        layout: { visibility: "none", "line-cap": "round", "line-join": "round", "line-sort-key": ZONE_SORT }, paint: linePaint(opacity),
      } as unknown as AnyLayer),
      update: (map) => map.setPaintProperty(GB_CHARGING_LINE_ID, "line-opacity", linePaint(opacity)["line-opacity"] as any),
    },
  ], [opacity, isDark]);
}

// ─────────────────────────── 第 10 波：主要路網（gb_major_roads.pmtiles） ───────────────────────────

const ROADS_SOURCE: SourceSpec = {
  id: "gb-major-roads", file: "gb_major_roads.pmtiles", minzoom: 4, maxzoom: 12, attribution: GB_ROADS_MAP_ATTRIBUTION, loading: "英國主要路網載入中",
};

function roadClassMatch(pick: (c: (typeof GB_ROAD_CLASSES)[number]) => unknown, fallback: unknown): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "road_class"], ""]];
  for (const c of GB_ROAD_CLASSES) expr.push(c.value, pick(c));
  expr.push(fallback);
  return expr;
}
/** L-5：寬度依等級對應 L-1 三階（高速公路強調、A 級標準、B 級細），z10／z14 兩點插值。 */
export function gbMajorRoadsWidthExpr(): Expr {
  return ["interpolate", ["linear"], ["zoom"],
    10, roadClassMatch((c) => LINE_WIDTH[c.width][0], LINE_WIDTH.thin[0]),
    14, roadClassMatch((c) => LINE_WIDTH[c.width][1], LINE_WIDTH.thin[1])];
}
/** 高速公路畫在 A 級上、A 級畫在 B 級上。 */
const ROAD_SORT: Expr = ["match", ["get", "road_class"], "motorway", 2, "a_road", 1, 0];

export function useGbMajorRoadsLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbMajorRoads", 0.85);
  const color = roadClassMatch((c) => c.color, GB_ROAD_FALLBACK_COLOR);
  const paint = (op: number) => hookLinePaint("gbMajorRoads", GB_MAJOR_ROADS_LINE_ID,
    { "line-color": color, "line-width": gbMajorRoadsWidthExpr(), "line-opacity": clamp01(op) },
    { "line-color": color, "line-width": gbMajorRoadsWidthExpr(), "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, ROADS_SOURCE, visible, () => [{
    id: GB_MAJOR_ROADS_LINE_ID,
    layer: () => ({
      id: GB_MAJOR_ROADS_LINE_ID, type: "line", source: ROADS_SOURCE.id, "source-layer": "gb_major_roads", minzoom: 5,
      layout: { visibility: "none", "line-cap": "round", "line-join": "round", "line-sort-key": ROAD_SORT }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(GB_MAJOR_ROADS_LINE_ID, "line-opacity", paint(opacity)["line-opacity"] as any),
  }], [opacity, isDark]);
}

// ─────────────────────────── 第 10 波：交通計數點 AADF（gb_traffic_counts_aadf.pmtiles） ───────────────────────────

const AADF_SOURCE: SourceSpec = {
  id: "gb-traffic-counts-aadf", file: "gb_traffic_counts_aadf.pmtiles", minzoom: 5, maxzoom: 13, attribution: GB_DFT_ROAD_TRAFFIC_ATTRIBUTION, loading: "英國交通計數點載入中",
};
const IS_MAJOR_AADF: Expr = ["in", ["get", "road_class"], ["literal", [...GB_AADF_MAJOR_CLASSES]]];

function aadfStep(pick: (b: (typeof GB_AADF_BUCKETS)[number]) => unknown): Expr {
  const expr: unknown[] = ["step", ["get", "all_motor_vehicles"], pick(GB_AADF_BUCKETS[0]!)];
  for (const b of GB_AADF_BUCKETS.slice(1)) expr.push(b.min, pick(b));
  return expr;
}
/** 資料方式選單：0 全部、1 只看實測（Counted）、2 只看估算（Estimated）。 */
export function gbAadfFilter(major: boolean, methodIdx: number): Expr {
  const parts: unknown[] = ["all", ["has", "all_motor_vehicles"], major ? IS_MAJOR_AADF : ["!", IS_MAJOR_AADF]];
  const method = GB_AADF_METHOD_FILTERS[methodIdx] ?? "all";
  if (method === "counted") parts.push(["==", ["get", "estimation_method"], "Counted"]);
  if (method === "estimated") parts.push(["==", ["get", "estimation_method"], "Estimated"]);
  return parts;
}

function aadfPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const s = scale / scaleDefault("gbTrafficCountsAadf");
  return {
    "circle-radius": ["*", aadfStep((b) => b.radius), s],
    "circle-color": aadfStep((b) => b.color),
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault("gbTrafficCountsAadf", 0.75)),
  };
}

/** §3.8 V-1／P-4：2.2 萬計數點 → 全英視角畫熱區（同「資料方式」篩選），z8 起畫全部點；幹線點 z6 起照舊疊在熱區上。 */
export const GB_AADF_HEATMAP_ID = "gb-traffic-counts-aadf-heatmap";
const AADF_HEAT_INTENSITY = 1.5;

export function useGbTrafficCountsAadfLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, methodIdx: number, isDark: boolean) {
  const heatStyle = useHeatmapStyleSignature(["gbTrafficCountsAadf"]);
  const method = GB_AADF_METHOD_FILTERS[methodIdx] ?? "all";
  const heatFilter: Expr = method === "counted" ? ["==", ["get", "estimation_method"], "Counted"]
    : method === "estimated" ? ["==", ["get", "estimation_method"], "Estimated"] : ["has", "all_motor_vehicles"];
  const build = (id: string, major: boolean) => ({
    id,
    layer: () => ({
      id, type: "circle", source: AADF_SOURCE.id, "source-layer": "gb_traffic_counts_aadf",
      minzoom: major ? GB_AADF_MAJOR_MINZOOM : GB_AADF_ALL_MINZOOM,
      filter: gbAadfFilter(major, methodIdx),
      // 交通量大的點畫在上面
      layout: { visibility: "none", "circle-sort-key": ["get", "all_motor_vehicles"] },
      paint: aadfPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map: MapboxMap) => {
      map.setFilter(id, gbAadfFilter(major, methodIdx) as any);
      setPaint(map, id, aadfPaint(isDark, opacity, scale));
    },
  });
  useGbPmtilesLayers(mapRef, AADF_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: GB_AADF_HEATMAP_ID, key: "gbTrafficCountsAadf", sourceId: AADF_SOURCE.id, sourceLayer: "gb_traffic_counts_aadf",
      maxzoom: heatmapMaxzoom(GB_AADF_ALL_MINZOOM), filter: heatFilter,
      isDark, opacityScale: clamp01(opacity) / opacityDefault("gbTrafficCountsAadf", 0.75), intensity: AADF_HEAT_INTENSITY,
    }),
    build(GB_AADF_MINOR_CIRCLE_ID, false),
    build(GB_AADF_MAJOR_CIRCLE_ID, true),
  ], [opacity, scale, methodIdx, isDark, heatStyle]);
}
