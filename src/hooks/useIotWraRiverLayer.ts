import { useEffect } from "react";
import { useMapReadyTick } from "./useMapReadyTick";
import type {
  Map as MapboxMap,
  CircleLayer,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchIotWraRiverDay,
  parseTimeline,
  type IotWraDayRow,
} from "../data/iotWraRiverLoader";
import {
  startTimelineSliceController,
  type TimelineSliceLayerConfig,
} from "./factories/timelineSliceLayer";

/**
 * IoT 河川水位（補強既有 riverLevel；migration 063 預聚合表）
 *
 * 視覺邏輯：跟 useRiverLevelLayer 一致 — delta_since_day_start 著色 + |delta| 加成 radius，
 * 但底色用 cyan 系跟既有 river 區隔（避免重疊看不出來）。
 */

const SOURCE_ID = "iot-wra-river";
const LAYER_GLOW = "iot-wra-river-glow";
const LAYER_CIRCLE = "iot-wra-river-circle";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface StationSeries {
  id: string;
  pq_id: string;
  name: string;
  measurement_name: string;
  si_unit: string;
  lng: number;
  lat: number;
  baseLevel: number;
  readings: Array<{ t: number; v: number }>;
}

function colorExpression(): ExpressionSpecification {
  return [
    "interpolate", ["linear"],
    ["coalesce", ["get", "delta_m"], 0],
    -1.0, "#7e22ce",   // 下降 >1m 深紫
    -0.30, "#a855f7",  // -30cm 紫
    -0.10, "#d8b4fe",  // -10cm 淡紫
    -0.02, "#94a3b8",
     0.02, "#94a3b8",
     0.10, "#67e8f9",  // +10cm 淡 cyan
     0.30, "#06b6d4",  // +30cm cyan
     1.0, "#0e7490",   // +1m 深 cyan
  ] as unknown as ExpressionSpecification;
}

function radiusExpression(scale: number): ExpressionSpecification {
  return [
    "*",
    [
      "interpolate", ["linear"],
      ["abs", ["coalesce", ["get", "delta_m"], 0]],
      0.00, 4.5,
      0.05, 5.5,
      0.20, 7.5,
      0.50, 9.5,
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
        "circle-radius": ["*", radiusExpression(scale), 1.9] as unknown as ExpressionSpecification,
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

function buildSeriesMap(
  rows: IotWraDayRow[],
  showMeasured: boolean,
  showForecast: boolean,
): Map<string, StationSeries> {
  // key = `${iow_station_id}:${physical_quantity_id}`，因一站可有多測項
  const m = new Map<string, StationSeries>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    const isForecast = (r.measurement_name ?? "").includes("預測");
    if (isForecast && !showForecast) continue;
    if (!isForecast && !showMeasured) continue;
    const readings = parseTimeline(r.timeline);
    if (readings.length === 0) continue;
    m.set(`${r.iow_station_id}:${r.physical_quantity_id}`, {
      id: r.iow_station_id,
      pq_id: r.physical_quantity_id,
      name: r.name,
      measurement_name: r.measurement_name ?? "",
      si_unit: r.si_unit ?? "",
      lng: r.lng,
      lat: r.lat,
      baseLevel: readings[0]!.v,
      readings,
    });
  }
  return m;
}

function findReadingAt(series: StationSeries, targetT: number) {
  const rs = series.readings;
  if (rs.length === 0) return null;
  for (let i = rs.length - 1; i >= 0; i--) {
    if (rs[i]!.t <= targetT) return rs[i]!;
  }
  return null;
}

function buildFC(byKey: Map<string, StationSeries>, currentT: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of byKey.values()) {
    const r = findReadingAt(s, currentT);
    if (!r) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        iow_station_id: s.id,
        physical_quantity_id: s.pq_id,
        name: s.name,
        measurement_name: s.measurement_name,
        si_unit: s.si_unit,
        value: r.v,
        delta_m: r.v - s.baseLevel,
        observed_at: new Date(r.t * 1000).toISOString(),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

const BASE_CONFIG: Omit<TimelineSliceLayerConfig<Map<string, StationSeries>>, "loadDay"> = {
  sourceId: SOURCE_ID,
  layerIds: [LAYER_GLOW, LAYER_CIRCLE],
  consoleTag: "[IotWraRiver]",
  loadingId: "iot-wra-river-render",
  loadingLabel: "IoT 河川 渲染中",
  emptyData: () => new Map(),
  buildFC,
  ensureLayers,
  updatePaint,
  describeData: (d) => `${d.size} series after filter`,
};

export function useIotWraRiverLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
  opacity = 1,
  showMeasured = true,
  showForecast = true,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  // showMeasured / showForecast 會進 loadDay 的 filter（且在 deps 內觸發重載），
  // CONFIG 無法是純模組常數 → 在 effect 內組 config，編排仍走 factory controller
  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;
    const config: TimelineSliceLayerConfig<Map<string, StationSeries>> = {
      ...BASE_CONFIG,
      loadDay: async (dateKey) =>
        buildSeriesMap(await fetchIotWraRiverDay(dateKey), showMeasured, showForecast),
    };
    return startTimelineSliceController(map, config, isDark, scale, opacity);
  }, [mapRef, visible, isDark, scale, opacity, showMeasured, showForecast, mapTick]);
}
