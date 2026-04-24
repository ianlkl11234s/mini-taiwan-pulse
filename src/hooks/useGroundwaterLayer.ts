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
 * 地下水井圖層（Mapbox native circle）— Timeline 驅動
 *
 * 時間模型：subscribeDate 換資料 + subscribeThrottled(500ms) 切片重畫（CLAUDE.md 規則 6）
 * 視覺：藍圓，半徑 ∝ water_level_m 絕對值；色階不分正常/異常（地下水觀測無 check_result）
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
  readings: Array<{ t: number; level: number }>;
}

function radiusExpression(): ExpressionSpecification {
  // 水位 m 絕對值：-50 ~ 450m 映射到 3 ~ 11 px
  return [
    "interpolate",
    ["linear"],
    ["abs", ["coalesce", ["get", "water_level_m"], 0]],
    0, 3,
    5, 4,
    20, 5,
    50, 6,
    100, 7.5,
    300, 9.5,
    500, 11,
  ] as unknown as ExpressionSpecification;
}

function ensureLayers(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": radiusExpression(),
        "circle-color": "#0ea5e9",
        "circle-blur": 0.9,
        "circle-opacity": isDark ? 0.4 : 0.32,
      },
    } as CircleLayer);
  }
  if (!map.getLayer(LAYER_CIRCLE)) {
    map.addLayer({
      id: LAYER_CIRCLE,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": ["literal", 2.2] as unknown as ExpressionSpecification,
        "circle-color": "#38bdf8",
        "circle-opacity": isDark ? 0.95 : 0.85,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.5,
      },
    } as CircleLayer);
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
        readings: [],
      };
      map.set(r.station_id, entry);
    }
    entry.readings.push({
      t: Date.parse(r.observed_at) / 1000,
      level: r.water_level_m,
    });
  }
  for (const entry of map.values()) {
    entry.readings.sort((a, b) => a.t - b.t);
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
      console.log("[Groundwater] attaching layers");
      ensureLayers(map, isDark);
      setLayerVisibility(map, true);
      mountedRef.current = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) {
      ensureLayers(map, isDark);
      setLayerVisibility(map, true);
      mountedRef.current = true;
    } else {
      pollTimer = setInterval(tryAttach, 200);
      tryAttach();
    }

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
  }, [mapRef, visible, isDark]);
}
