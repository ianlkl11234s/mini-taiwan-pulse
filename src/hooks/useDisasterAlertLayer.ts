import { useEffect, useRef, useCallback } from "react";
import type {
  Map as MapboxMap,
  FillLayer,
  LineLayer,
  CircleLayer,
  FilterSpecification,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchDisasterAlertsDay,
  alertsToGeoJSON,
  type DisasterAlert,
} from "../data/disasterAlertLoader";

/**
 * NCDR 災害示警 timeline 圖層
 *
 * - 一次載入一整天的所有 alert（含 GeoJSON 幾何）
 * - 依 currentTime 過濾出當前 active（start <= now < end）
 * - 顏色依 severity（Extreme/Severe/Moderate/Minor/Unknown）
 * - 按日切換 + LRU 快取 7 天
 */

const SOURCE_ID = "disaster-alerts";
const LAYER_FILL = "disasterAlerts-fill";
const LAYER_LINE = "disasterAlerts-line";
const LAYER_POINT = "disasterAlerts-point"; // 給 Point geometry 的小範圍警報

const CACHE_MAX = 7;

interface CachedDay {
  data: DisasterAlert[];
  accessedAt: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function buildLayers(map: MapboxMap): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  // active 過濾條件：properties.active == 1
  const activeFilter = ["==", ["get", "active"], 1] as unknown as FilterSpecification;

  if (!map.getLayer(LAYER_FILL)) {
    map.addLayer({
      id: LAYER_FILL,
      type: "fill",
      source: SOURCE_ID,
      filter: activeFilter,
      paint: {
        "fill-color": ["get", "color"] as unknown as ExpressionSpecification,
        "fill-opacity": [
          "match",
          ["get", "severity"],
          "Extreme", 0.35,
          "Severe", 0.28,
          "Moderate", 0.22,
          "Minor", 0.15,
          0.18,
        ] as unknown as ExpressionSpecification,
      },
    } as FillLayer);
  }

  if (!map.getLayer(LAYER_LINE)) {
    map.addLayer({
      id: LAYER_LINE,
      type: "line",
      source: SOURCE_ID,
      filter: activeFilter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"] as unknown as ExpressionSpecification,
        "line-width": 1.5,
        "line-opacity": 0.9,
      },
    } as LineLayer);
  }

  if (!map.getLayer(LAYER_POINT)) {
    map.addLayer({
      id: LAYER_POINT,
      type: "circle",
      source: SOURCE_ID,
      filter: ["all", activeFilter, ["==", ["geometry-type"], "Point"]] as unknown as FilterSpecification,
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "color"] as unknown as ExpressionSpecification,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.85,
      },
    } as CircleLayer);
  }

  return true;
}

export function useDisasterAlertLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  currentTime: number,
  visible: boolean,
) {
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());
  const activeDayRef = useRef<DisasterAlert[] | null>(null);
  const activeDateRef = useRef<string>("");
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");
  const lastActiveSetRef = useRef<string>("");

  const writeCache = useCallback((dateStr: string, data: DisasterAlert[]) => {
    const cache = cacheRef.current;
    cache.set(dateStr, { data, accessedAt: Date.now() });
    if (cache.size > CACHE_MAX) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of cache) {
        if (v.accessedAt < oldestTime) {
          oldestTime = v.accessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
  }, []);

  const ensureLayers = useCallback((map: MapboxMap) => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!layersReadyRef.current || !map.getLayer(LAYER_FILL)) {
      layersReadyRef.current = buildLayers(map);
    }
    return layersReadyRef.current;
  }, []);

  const refreshSource = useCallback((map: MapboxMap, t: number) => {
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const day = activeDayRef.current ?? [];
    src.setData(alertsToGeoJSON(day, t));
  }, []);

  const loadDay = useCallback(
    (dateStr: string) => {
      if (dateStr === activeDateRef.current) return;
      if (dateStr === fetchingRef.current) return;

      const cached = cacheRef.current.get(dateStr);
      if (cached) {
        cached.accessedAt = Date.now();
        activeDayRef.current = cached.data;
        activeDateRef.current = dateStr;
        lastActiveSetRef.current = "";
        const map = mapRef.current;
        if (map && ensureLayers(map)) refreshSource(map, currentTime);
        return;
      }

      fetchingRef.current = dateStr;
      fetchDisasterAlertsDay(dateStr)
        .then((alerts) => {
          writeCache(dateStr, alerts);
          if (fetchingRef.current !== dateStr) return;
          activeDayRef.current = alerts;
          activeDateRef.current = dateStr;
          lastActiveSetRef.current = "";
          const map = mapRef.current;
          if (map && ensureLayers(map)) refreshSource(map, currentTime);
        })
        .catch((err) => {
          console.warn(`[DisasterAlerts] load ${dateStr} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === dateStr) fetchingRef.current = "";
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureLayers, refreshSource, writeCache],
  );

  // ── 依 timeline 當前日切換載入 ──
  useEffect(() => {
    if (!visible) return;
    if (currentTime <= 0) return;
    const dateStr = formatDate(currentTime);
    loadDay(dateStr);
  }, [visible, currentTime, loadDay]);

  // ── 依 currentTime 更新 active filter ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!visible) {
      for (const id of [LAYER_FILL, LAYER_LINE, LAYER_POINT]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
      return;
    }
    if (!ensureLayers(map)) return;
    for (const id of [LAYER_FILL, LAYER_LINE, LAYER_POINT]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }

    const day = activeDayRef.current;
    if (!day) return;

    // 計算當前 active 集合的 hash，沒變動就不重 setData
    let key = "";
    for (const a of day) {
      if (currentTime >= a.start_ts && currentTime < a.end_ts) {
        key += a.identifier + "|";
      }
    }
    if (key !== lastActiveSetRef.current) {
      lastActiveSetRef.current = key;
      refreshSource(map, currentTime);
    }
  }, [visible, currentTime, ensureLayers, refreshSource, mapRef]);
}
