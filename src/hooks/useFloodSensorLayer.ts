import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  GeoJSONSource,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchFloodSensorDay,
  type FloodSensorDayRow,
} from "../data/floodSensorLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";

/**
 * USWG 都市淹水感測器 — Timeline-driven 點圖層
 *
 * 4 層繪製（同一 source）：
 *   ① buffer-1km   — 1km 影響範圍同心圓（淡）
 *   ② buffer-500m  — 500m 影響範圍同心圓（中）
 *   ③ glow         — 站點外暈
 *   ④ dot          — 站點主圓（半徑 + 顏色依 depth_cm）
 *
 * 時間模型（遵守 CLAUDE.md 規則 6 動態圖層）：
 *   - visible=true 時首次 fetch 當日全時序 (get_uswg_day)
 *   - timeStore.subscribeDate → 跨日換資料
 *   - timeStore.subscribeThrottled(500ms) → 依 currentTime 切片重畫
 *   - currentTime 不進 useEffect deps，避免 re-render cascade
 *
 * Buffer 半徑用 mapbox `interpolate exponential 2 by zoom` 近似 lat≈24°N 公尺比例尺。
 *
 * 著色：
 *   - 0 cm:     #404040 (灰)
 *   - 0~5 cm:   #fde047 (黃)
 *   - 5~15 cm:  #fb923c (橘)
 *   - 15~30 cm: #ef4444 (紅)
 *   - 30+ cm:   #7f1d1d (暗紅)
 */

const SOURCE_ID = "flood-sensor";
const LAYER_BUFFER_1K = "flood-sensor-buffer-1k";
const LAYER_BUFFER_500 = "flood-sensor-buffer-500";
const LAYER_GLOW = "flood-sensor-glow";
const LAYER_DOT = "flood-sensor-dot";

const THROTTLE_MS = 500;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** 每站一筆 meta + 該站當日時序讀值（按 observed_at ASC 排序） */
interface StationSeries {
  iow_station_id: string;
  name: string;
  county_name: string;
  town_name: string;
  lng: number;
  lat: number;
  si_unit: string;
  readings: Array<{ t: number; v: number }>;
}

function depthColorExpression(): ExpressionSpecification {
  return [
    "step",
    ["coalesce", ["get", "depth_cm"], 0],
    "#404040",
    0.5, "#fde047",
    5,   "#fb923c",
    15,  "#ef4444",
    30,  "#7f1d1d",
  ] as unknown as ExpressionSpecification;
}

function dotRadiusExpression(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "depth_cm"], 0],
    0,   2 * scale,
    0.5, 4 * scale,
    5,   7 * scale,
    15,  10 * scale,
    30,  14 * scale,
  ] as unknown as ExpressionSpecification;
}

function bufferRadiusExpression(meters: number): ExpressionSpecification {
  // 基準 z=11 → meters / 38.2 px (lat ≈ 24°N)
  const r11 = meters / 38.2;
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    7,  r11 / 16,
    11, r11,
    15, r11 * 16,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }

  const wetFilter = [">", ["coalesce", ["get", "depth_cm"], 0], 0] as unknown as ExpressionSpecification;

  if (!map.getLayer(LAYER_BUFFER_1K)) {
    map.addLayer({
      id: LAYER_BUFFER_1K,
      type: "circle",
      source: SOURCE_ID,
      filter: wetFilter,
      paint: {
        "circle-radius": bufferRadiusExpression(1000),
        "circle-color": depthColorExpression(),
        "circle-opacity": 0.06 * opacity,
        "circle-stroke-width": 1,
        "circle-stroke-color": depthColorExpression(),
        "circle-stroke-opacity": 0.25 * opacity,
        "circle-pitch-alignment": "map",
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_BUFFER_500)) {
    map.addLayer({
      id: LAYER_BUFFER_500,
      type: "circle",
      source: SOURCE_ID,
      filter: wetFilter,
      paint: {
        "circle-radius": bufferRadiusExpression(500),
        "circle-color": depthColorExpression(),
        "circle-opacity": 0.12 * opacity,
        "circle-stroke-width": 1,
        "circle-stroke-color": depthColorExpression(),
        "circle-stroke-opacity": 0.4 * opacity,
        "circle-pitch-alignment": "map",
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": dotRadiusExpression(scale * 1.8),
        "circle-color": depthColorExpression(),
        "circle-blur": 0.7,
        "circle-opacity": (isDark ? 0.4 : 0.3) * opacity,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_DOT)) {
    map.addLayer({
      id: LAYER_DOT,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": dotRadiusExpression(scale),
        "circle-color": depthColorExpression(),
        "circle-opacity": 0.9 * opacity,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.5 * opacity,
      },
    } as CircleLayer);
  }
}

function updatePaint(map: MapboxMap, isDark: boolean, scale: number, opacity: number) {
  if (map.getLayer(LAYER_BUFFER_1K)) {
    map.setPaintProperty(LAYER_BUFFER_1K, "circle-opacity", 0.06 * opacity);
    map.setPaintProperty(LAYER_BUFFER_1K, "circle-stroke-opacity", 0.25 * opacity);
  }
  if (map.getLayer(LAYER_BUFFER_500)) {
    map.setPaintProperty(LAYER_BUFFER_500, "circle-opacity", 0.12 * opacity);
    map.setPaintProperty(LAYER_BUFFER_500, "circle-stroke-opacity", 0.4 * opacity);
  }
  if (map.getLayer(LAYER_GLOW)) {
    map.setPaintProperty(LAYER_GLOW, "circle-radius", dotRadiusExpression(scale * 1.8));
    map.setPaintProperty(LAYER_GLOW, "circle-opacity", (isDark ? 0.4 : 0.3) * opacity);
  }
  if (map.getLayer(LAYER_DOT)) {
    map.setPaintProperty(LAYER_DOT, "circle-radius", dotRadiusExpression(scale));
    map.setPaintProperty(LAYER_DOT, "circle-opacity", 0.9 * opacity);
    map.setPaintProperty(LAYER_DOT, "circle-stroke-opacity", 0.5 * opacity);
  }
}

function setLayerVisibility(map: MapboxMap, visible: boolean) {
  for (const id of [LAYER_BUFFER_1K, LAYER_BUFFER_500, LAYER_GLOW, LAYER_DOT]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

function groupByStation(rows: FloodSensorDayRow[]): Map<string, StationSeries> {
  const map = new Map<string, StationSeries>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    let entry = map.get(r.iow_station_id);
    if (!entry) {
      entry = {
        iow_station_id: r.iow_station_id,
        name: r.name ?? "",
        county_name: r.county_name ?? "",
        town_name: r.town_name ?? "",
        lng: r.lng,
        lat: r.lat,
        si_unit: r.si_unit ?? "cm",
        readings: [],
      };
      map.set(r.iow_station_id, entry);
    }
    entry.readings.push({
      t: Date.parse(r.observed_at) / 1000,
      v: r.value ?? 0,
    });
  }
  for (const entry of map.values()) {
    entry.readings.sort((a, b) => a.t - b.t);
  }
  return map;
}

/** 在排序好的 readings 裡找最後一筆 t ≤ targetT */
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
        iow_station_id: s.iow_station_id,
        name: s.name,
        county_name: s.county_name,
        town_name: s.town_name,
        depth_cm: r.v,
        si_unit: s.si_unit,
        observed_at: new Date(r.t * 1000).toISOString(),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useFloodSensorLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
  opacity = 1,
) {
  const byStationRef = useRef<Map<string, StationSeries>>(new Map());
  const currentDateRef = useRef<string>("");

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const attach = () => {
      if (cancelled) return;
      if (!map.isStyleLoaded()) return;
      ensureLayers(map, isDark, scale, opacity);
      updatePaint(map, isDark, scale, opacity);
      setLayerVisibility(map, true);
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    if (map.isStyleLoaded()) attach();
    else pollTimer = setInterval(attach, 200);

    const redraw = () => {
      if (cancelled) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      const t = timeStore.getTime();
      src.setData(buildFC(byStationRef.current, t));
    };

    const loadDay = async (dateKey: string) => {
      if (cancelled) return;
      try {
        console.log("[FloodSensor] fetching day", dateKey);
        const rows = await fetchFloodSensorDay(dateKey);
        if (cancelled || currentDateRef.current !== dateKey) return;
        byStationRef.current = groupByStation(rows);
        console.log(`[FloodSensor] loaded ${rows.length} rows, ${byStationRef.current.size} stations`);
        redraw();
        keepLoadingUntilMapIdle(map, "flood-sensor-render", "淹水感測器 渲染中", SOURCE_ID);
      } catch (err) {
        console.warn("[FloodSensor] fetch failed:", err);
      }
    };

    currentDateRef.current = timeStore.getDateKey();
    loadDay(currentDateRef.current);

    const unsubDate = timeStore.subscribeDate((key) => {
      currentDateRef.current = key;
      byStationRef.current = new Map();
      loadDay(key);
    });
    const unsubTime = timeStore.subscribeThrottled(THROTTLE_MS, redraw);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      unsubDate();
      unsubTime();
      if (map.getLayer(LAYER_DOT)) setLayerVisibility(map, false);
    };
  }, [mapRef, visible, isDark, scale, opacity]);
}
