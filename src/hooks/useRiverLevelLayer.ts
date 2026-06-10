import type {
  Map as MapboxMap,
  CircleLayer,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchRiverLevelDay,
  type RiverLevelDayRow,
} from "../data/riverLevelLoader";
import {
  useTimelineSliceLayer,
  type TimelineSliceLayerConfig,
} from "./factories/timelineSliceLayer";

/**
 * 河川水位圖層（Mapbox native circle）— Timeline 驅動
 *
 * 視覺邏輯：
 *   - color = delta_since_day_start（當前水位 − 當日起始水位）
 *     跨站可比（避開各站 water_level_m 絕對值不可比的問題），
 *     紅＝下降、灰＝穩定、藍＝上升；check_result=0 的異常強制紅邊框
 *   - radius = 基礎 5px + |delta| 加成，實測中位 p50 變化僅 8.5cm，
 *     所以基礎 radius 拉大才看得出站位
 *   - scale / opacity 從 UI 滑桿動態調
 */

const SOURCE_ID = "river-level";
const LAYER_GLOW = "river-level-glow";
const LAYER_CIRCLE = "river-level-circle";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface StationSeries {
  station_id: string;
  station_name: string;
  lng: number;
  lat: number;
  baseLevel: number;  // 該日第一筆水位（作為 delta 基準）
  readings: Array<{ t: number; level: number; check: number }>;
}

function colorExpression(): ExpressionSpecification {
  // delta_m 著色；check_result=0 異常時覆寫為橙
  return [
    "case",
    ["==", ["coalesce", ["get", "check_result"], 1], 0],
    "#f97316", // 異常：橙
    [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "delta_m"], 0],
      -1.0, "#b91c1c",  // 下降 >1m 深紅
      -0.30, "#ef4444",  // -30cm 紅
      -0.10, "#fca5a5",  // -10cm 淡紅
      -0.02, "#94a3b8",  // -2cm 灰
       0.02, "#94a3b8",  // +2cm 灰
       0.10, "#93c5fd",  // +10cm 淡藍
       0.30, "#3b82f6",  // +30cm 藍
       1.0, "#1d4ed8",   // +1m 深藍
    ],
  ] as unknown as ExpressionSpecification;
}

function radiusExpression(scale: number): ExpressionSpecification {
  // 基礎 5px，|delta| 加成至 12px；scale 從 UI 放大縮小
  return [
    "*",
    [
      "interpolate",
      ["linear"],
      ["abs", ["coalesce", ["get", "delta_m"], 0]],
      0.00, 5.0,
      0.05, 6.0,
      0.20, 8.0,
      0.50, 10.0,
      1.00, 12.0,
    ],
    ["literal", scale],
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "*",
          radiusExpression(scale),
          1.9,
        ] as unknown as ExpressionSpecification,
        "circle-color": colorExpression(),
        "circle-blur": 0.9,
        "circle-opacity": (isDark ? 0.45 : 0.35) * opacity,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": radiusExpression(scale),
        "circle-color": colorExpression(),
        "circle-opacity": (isDark ? 0.95 : 0.85) * opacity,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.5 * opacity,
      },
    } as CircleLayer);
  }
}

function updatePaint(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (map.getLayer(LAYER_GLOW)) {
    map.setPaintProperty(LAYER_GLOW, "circle-radius", [
      "*", radiusExpression(scale), 1.9,
    ] as unknown as ExpressionSpecification);
    map.setPaintProperty(LAYER_GLOW, "circle-opacity", (isDark ? 0.45 : 0.35) * opacity);
  }
  if (map.getLayer(LAYER_CIRCLE)) {
    map.setPaintProperty(LAYER_CIRCLE, "circle-radius", radiusExpression(scale));
    map.setPaintProperty(LAYER_CIRCLE, "circle-opacity", (isDark ? 0.95 : 0.85) * opacity);
    map.setPaintProperty(LAYER_CIRCLE, "circle-stroke-opacity", 0.5 * opacity);
  }
}

function groupByStation(rows: RiverLevelDayRow[]): Map<string, StationSeries> {
  const map = new Map<string, StationSeries>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    let entry = map.get(r.station_id);
    if (!entry) {
      entry = {
        station_id: r.station_id,
        station_name: r.station_name ?? "",
        lng: r.lng,
        lat: r.lat,
        baseLevel: r.water_level_m ?? 0,
        readings: [],
      };
      map.set(r.station_id, entry);
    }
    entry.readings.push({
      t: Date.parse(r.observed_at) / 1000,
      level: r.water_level_m ?? 0,
      check: r.check_result ?? 1,
    });
  }
  for (const entry of map.values()) {
    entry.readings.sort((a, b) => a.t - b.t);
    if (entry.readings.length > 0) entry.baseLevel = entry.readings[0]!.level;
  }
  return map;
}

function findReadingAt(series: StationSeries, targetT: number) {
  const rs = series.readings;
  if (rs.length === 0) return null;
  for (let i = rs.length - 1; i >= 0; i--) {
    if (rs[i]!.t <= targetT) return rs[i]!;
  }
  return null;
}

function buildFC(byStation: Map<string, StationSeries>, currentT: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of byStation.values()) {
    const r = findReadingAt(s, currentT);
    if (!r) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        station_id: s.station_id,
        station_name: s.station_name,
        water_level_m: r.level,
        delta_m: r.level - s.baseLevel, // 當下水位 − 當日起始水位
        check_result: r.check,
        observed_at: new Date(r.t * 1000).toISOString(),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

const CONFIG: TimelineSliceLayerConfig<Map<string, StationSeries>> = {
  sourceId: SOURCE_ID,
  layerIds: [LAYER_GLOW, LAYER_CIRCLE],
  consoleTag: "[RiverLevel]",
  loadingId: "river-level-render",
  loadingLabel: "河川水位 渲染中",
  loadDay: async (dateKey) => groupByStation(await fetchRiverLevelDay(dateKey)),
  emptyData: () => new Map(),
  buildFC,
  ensureLayers,
  updatePaint,
  describeData: (d) => `${d.size} stations`,
};

export function useRiverLevelLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
  opacity = 1,
) {
  useTimelineSliceLayer(CONFIG, mapRef, visible, isDark, scale, opacity);
}
