import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  GeoJSONSource,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchGroundwaterDay,
  type GroundwaterDayRow,
} from "../data/groundwaterLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";

/**
 * 地下水井動態層（Mapbox native circle）— Timeline 驅動
 *
 * 與 useGroundwaterWellsLayer（靜態灰點 backdrop）分工：
 *   - 這層：彩色 glow，顏色 = 當前水位 − 當日 0 時水位（日內變化 delta_since_day_start）
 *   - 靜態層：永遠顯示站位
 *
 * 視覺邏輯：
 *   color：跨站可比的「當日累積變化」→ 紅（下降）/ 灰（穩定）/ 藍（上升）
 *     ±2cm 內視為雜訊（p50 hourly change 只有 4mm，但日累積會到 p90 27cm）
 *   radius：變化強度絕對值（|delta|），從 4px → 10px；0 變化時仍有基礎 4px
 *
 * 時間模型：subscribeDate 換資料 + subscribeThrottled(500ms) 切片重畫（CLAUDE.md 規則 6）
 */

const SOURCE_ID = "groundwater";
const LAYER_GLOW = "groundwater-glow";
const LAYER_CIRCLE = "groundwater-circle";

const THROTTLE_MS = 500;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface StationSeries {
  station_id: string;
  well_name: string;
  lng: number;
  lat: number;
  baseLevel: number;  // 該日第一筆水位（作為 delta 基準）
  readings: Array<{ t: number; level: number }>;
}

function colorExpression(): ExpressionSpecification {
  // delta_m（當前 − 當日起始水位）→ 色階
  // 紅(-)｜灰(0±2cm)｜藍(+)，覆蓋 p10~p90 的 ±30cm
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "delta_m"], 0],
    -0.30, "#b91c1c",  // 深紅：下降 >30cm
    -0.10, "#ef4444",  // 紅：下降 >10cm
    -0.02, "#fca5a5",  // 淡紅：-2~-10 cm
     0.00, "#94a3b8",  // 灰：穩定 ±2cm
     0.02, "#93c5fd",  // 淡藍：+2~+10 cm
     0.10, "#3b82f6",  // 藍：上升 >10cm
     0.30, "#1d4ed8",  // 深藍：上升 >30cm
  ] as unknown as ExpressionSpecification;
}

function radiusExpression(scale: number): ExpressionSpecification {
  // |delta_m| 絕對值：0cm → 4px，30cm+ → 10px；scale 從 UI 放大縮小
  return [
    "*",
    [
      "interpolate",
      ["linear"],
      ["abs", ["coalesce", ["get", "delta_m"], 0]],
      0.00, 4.0,
      0.05, 5.0,
      0.15, 7.0,
      0.30, 10.0,
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
          1.8,
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
      "*", radiusExpression(scale), 1.8,
    ] as unknown as ExpressionSpecification);
    map.setPaintProperty(LAYER_GLOW, "circle-opacity", (isDark ? 0.45 : 0.35) * opacity);
  }
  if (map.getLayer(LAYER_CIRCLE)) {
    map.setPaintProperty(LAYER_CIRCLE, "circle-radius", radiusExpression(scale));
    map.setPaintProperty(LAYER_CIRCLE, "circle-opacity", (isDark ? 0.95 : 0.85) * opacity);
    map.setPaintProperty(LAYER_CIRCLE, "circle-stroke-opacity", 0.5 * opacity);
  }
}

function setLayerVisibility(map: MapboxMap, visible: boolean) {
  for (const id of [LAYER_GLOW, LAYER_CIRCLE]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

function groupByStation(rows: GroundwaterDayRow[]): Map<string, StationSeries> {
  const map = new Map<string, StationSeries>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null || r.water_level_m == null) continue;
    let entry = map.get(r.station_id);
    if (!entry) {
      entry = {
        station_id: r.station_id,
        well_name: r.well_name ?? "",
        lng: r.lng,
        lat: r.lat,
        baseLevel: r.water_level_m, // 先放第一筆，底下排序後重算
        readings: [],
      };
      map.set(r.station_id, entry);
    }
    entry.readings.push({
      t: Date.parse(r.observed_at) / 1000,
      level: r.water_level_m,
    });
  }
  // 排序後以最早一筆作為當日 base（用來計算 delta_since_day_start）
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
        well_name: s.well_name,
        water_level_m: r.level,
        delta_m: r.level - s.baseLevel, // 當下水位 − 當日起始水位
        observed_at: new Date(r.t * 1000).toISOString(),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useGroundwaterLayer(
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
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
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
        console.log("[Groundwater] fetching day", dateKey);
        const rows = await fetchGroundwaterDay(dateKey);
        if (cancelled || currentDateRef.current !== dateKey) return;
        byStationRef.current = groupByStation(rows);
        console.log(`[Groundwater] loaded ${rows.length} rows, ${byStationRef.current.size} stations`);
        redraw();
        keepLoadingUntilMapIdle(map, "groundwater-render", "地下水井 渲染中", SOURCE_ID);
      } catch (err) {
        console.warn("[Groundwater] fetch failed:", err);
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
      if (map.getLayer(LAYER_GLOW) || map.getLayer(LAYER_CIRCLE)) {
        setLayerVisibility(map, false);
      }
    };
  }, [mapRef, visible, isDark, scale, opacity]);
}
