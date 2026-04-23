import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  CircleLayer,
  HeatmapLayer,
  GeoJSONSource,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchRainGaugeDay,
  type RainGaugeDayRow,
} from "../data/rainGaugeLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";

/**
 * 即時雨量圖層（Mapbox native circle）— Timeline 驅動
 *
 * 視覺：
 *   - circle-radius：precipitation_10min（0 → 小, 多 → 大）
 *   - circle-color：precipitation_1hr 依 CWA 分級 step expression
 *   - 無雨的站點半徑極小，避免全台滿滿灰點
 *
 * 時間模型（遵守 CLAUDE.md 規則 6）：
 *   - visible=true 時首次 fetch 當日全時序
 *   - timeStore.subscribeDate → 跨日換資料
 *   - timeStore.subscribeThrottled(500ms) → 依 currentTime 切片重畫
 *   - currentTime 不進 useEffect deps，避免 re-render cascade
 */

const SOURCE_ID = "rain-gauge";
const LAYER_HEATMAP = "rain-gauge-heatmap";
const LAYER_GLOW = "rain-gauge-glow";
const LAYER_CIRCLE = "rain-gauge-circle";

/** zoom 漸變節點：小於 HEATMAP_HIDE_Z → heatmap 全透明；大於 CIRCLE_HIDE_Z → circle 全透明 */
const HEATMAP_HIDE_Z = 12;
const CIRCLE_HIDE_Z = 8;

const THROTTLE_MS = 500;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** 每站一筆 meta + 該站當日時序讀值（按 observed_at ASC 排序） */
interface StationSeries {
  station_id: string;
  station_name: string;
  county: string;
  town: string;
  lng: number;
  lat: number;
  readings: Array<{
    t: number; // observed_at 的 unix 秒
    p10: number;
    p1h: number;
    p3h: number;
    p24h: number;
  }>;
}

function rainColorExpression(): ExpressionSpecification {
  return [
    "step",
    ["coalesce", ["get", "precipitation_1hr"], 0],
    "#6b7280",
    0.1, "#93c5fd",
    2.5, "#3b82f6",
    15, "#22c55e",
    40, "#fbbf24",
    80, "#f97316",
    200, "#ef4444",
  ] as unknown as ExpressionSpecification;
}

function rainRadiusExpression(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "precipitation_10min"], 0],
    0, 2 * scale,
    2, 5 * scale,
    10, 10 * scale,
    30, 16 * scale,
    60, 22 * scale,
  ] as unknown as ExpressionSpecification;
}

/** heatmap-weight：用 precipitation_1hr 映射到 0~1（0 mm → 0；100+ mm → 1） */
function heatmapWeightExpression(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "precipitation_1hr"], 0],
    0, 0,
    0.1, 0.05,
    2.5, 0.2,
    15, 0.45,
    40, 0.7,
    80, 0.88,
    200, 1,
  ] as unknown as ExpressionSpecification;
}

/** heatmap-color：CWA 分級色階（density 0→1 映射到色帶，暴雨紅） */
function heatmapColorExpression(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,    "rgba(0,0,0,0)",
    0.05, "rgba(147,197,253,0.4)",   // 小雨 #93c5fd
    0.2,  "rgba(59,130,246,0.7)",    // 中雨 #3b82f6
    0.45, "rgba(34,197,94,0.85)",    // 大雨 #22c55e
    0.7,  "rgba(251,191,36,0.92)",   // 豪雨 #fbbf24
    0.88, "rgba(249,115,22,0.95)",   // 大豪雨 #f97316
    1,    "rgba(239,68,68,0.98)",    // 超大豪雨 #ef4444
  ] as unknown as ExpressionSpecification;
}

/** heatmap-radius：zoom 越大半徑越小（近景看細節；遠景看大範圍擴散） */
function heatmapRadiusExpression(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    5, 12,
    7, 20,
    9, 28,
    11, 38,
    13, 50,
  ] as unknown as ExpressionSpecification;
}

/** heatmap 在近景淡出（交給 circle 表達測站位置）*/
function heatmapOpacityExpression(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    CIRCLE_HIDE_Z - 1, 0.9,
    HEATMAP_HIDE_Z - 2, 0.75,
    HEATMAP_HIDE_Z, 0,
  ] as unknown as ExpressionSpecification;
}

/** circle 在遠景淡出（交給 heatmap 表達擴散）*/
function circleZoomOpacity(base: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    CIRCLE_HIDE_Z - 2, 0,
    CIRCLE_HIDE_Z, 0,
    CIRCLE_HIDE_Z + 2, base,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean, scale: number) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  // ① heatmap（遠景主打）
  if (!map.getLayer(LAYER_HEATMAP)) {
    map.addLayer({
      id: LAYER_HEATMAP,
      type: "heatmap",
      source: SOURCE_ID,
      maxzoom: HEATMAP_HIDE_Z,
      paint: {
        "heatmap-weight": heatmapWeightExpression(),
        "heatmap-intensity": [
          "interpolate", ["linear"], ["zoom"],
          5, 1,
          11, 2.5,
        ] as unknown as ExpressionSpecification,
        "heatmap-color": heatmapColorExpression(),
        "heatmap-radius": heatmapRadiusExpression(),
        "heatmap-opacity": heatmapOpacityExpression(),
      },
    } as HeatmapLayer);
  }
  // ② glow circle（近景輔助，站點位置光暈）
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": rainRadiusExpression(scale * 1.8),
        "circle-color": rainColorExpression(),
        "circle-blur": 0.8,
        "circle-opacity": circleZoomOpacity(isDark ? 0.25 : 0.2),
      },
    } as CircleLayer);
  }
  // ③ main circle（近景主打，精確測站位置）
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": rainRadiusExpression(scale),
        "circle-color": rainColorExpression(),
        "circle-opacity": circleZoomOpacity(isDark ? 0.85 : 0.75),
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": circleZoomOpacity(0.4),
      },
    } as CircleLayer);
  }
}

function setLayerVisibility(map: MapboxMap, visible: boolean) {
  for (const id of [LAYER_HEATMAP, LAYER_GLOW, LAYER_CIRCLE]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

function groupByStation(rows: RainGaugeDayRow[]): Map<string, StationSeries> {
  const map = new Map<string, StationSeries>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    let entry = map.get(r.station_id);
    if (!entry) {
      entry = {
        station_id: r.station_id,
        station_name: r.station_name ?? "",
        county: r.county ?? "",
        town: r.town ?? "",
        lng: r.lng,
        lat: r.lat,
        readings: [],
      };
      map.set(r.station_id, entry);
    }
    entry.readings.push({
      t: Date.parse(r.observed_at) / 1000,
      p10: r.precipitation_10min ?? 0,
      p1h: r.precipitation_1hr ?? 0,
      p3h: r.precipitation_3hr ?? 0,
      p24h: r.precipitation_24hr ?? 0,
    });
  }
  for (const entry of map.values()) {
    entry.readings.sort((a, b) => a.t - b.t);
  }
  return map;
}

/** 在排序好的 readings 裡找最後一筆 t ≤ targetT（線性掃，已足夠：每站 ≤ 24 筆） */
function findReadingAt(series: StationSeries, targetT: number) {
  const rs = series.readings;
  if (rs.length === 0) return null;
  // 從後往前找第一個 t ≤ target
  for (let i = rs.length - 1; i >= 0; i--) {
    if (rs[i]!.t <= targetT) return rs[i]!;
  }
  return null;
}

function buildFC(byStation: Map<string, StationSeries>, currentT: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const s of byStation.values()) {
    const r = findReadingAt(s, currentT);
    if (!r) continue; // 當下時刻該站尚無資料 → 不畫
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        station_id: s.station_id,
        station_name: s.station_name,
        county: s.county,
        town: s.town,
        precipitation_10min: r.p10,
        precipitation_1hr: r.p1h,
        precipitation_3hr: r.p3h,
        precipitation_24hr: r.p24h,
        observed_at: new Date(r.t * 1000).toISOString(),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function useRainGaugeLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  scale = 1,
) {
  const mountedRef = useRef(false);
  const byStationRef = useRef<Map<string, StationSeries>>(new Map());
  const currentDateRef = useRef<string>("");

  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const tryAttach = () => {
      if (cancelled || mountedRef.current) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      if (!map.isStyleLoaded()) return;
      console.log("[RainGauge] attaching layers");
      ensureLayers(map, isDark, scale);
      setLayerVisibility(map, true);
      mountedRef.current = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) {
      ensureLayers(map, isDark, scale);
      setLayerVisibility(map, true);
      mountedRef.current = true;
    } else {
      pollTimer = setInterval(tryAttach, 200);
      tryAttach();
    }

    /** 重畫當下切片 */
    const redraw = () => {
      if (cancelled) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      const t = timeStore.getTime();
      src.setData(buildFC(byStationRef.current, t));
    };

    /** 抓當天整日 + 首次 redraw */
    const loadDay = async (dateKey: string) => {
      if (cancelled) return;
      try {
        console.log("[RainGauge] fetching day", dateKey);
        const rows = await fetchRainGaugeDay(dateKey);
        if (cancelled || currentDateRef.current !== dateKey) return;
        byStationRef.current = groupByStation(rows);
        console.log(`[RainGauge] loaded ${rows.length} rows, ${byStationRef.current.size} stations`);
        redraw();
        keepLoadingUntilMapIdle(map, "rain-gauge-render", "即時雨量 渲染中", SOURCE_ID);
      } catch (err) {
        console.warn("[RainGauge] fetch failed:", err);
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
  }, [mapRef, visible, isDark, scale]);
}
