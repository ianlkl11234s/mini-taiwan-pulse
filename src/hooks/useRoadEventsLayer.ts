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
  fetchRoadEventsDay,
  roadEventsToGeoJSON,
  type RoadEvent,
} from "../data/roadEventsLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * TDX 即時路況事件 timeline 圖層
 *
 * - 一次載入一整天的路況事件（含 GeoJSON 幾何）
 * - 依 currentTime 過濾出當前 active（start_ts <= now < end_ts）
 * - 顏色依 event_type（事故/施工/壅塞/活動/災害）
 * - 混合幾何：fill（面） + line（線） + circle（點）
 * - 按日切換 + LRU 快取 7 天
 */

const SOURCE_ID = "road-events";
const LAYER_FILL  = "roadEvents-fill";
const LAYER_LINE  = "roadEvents-line";
const LAYER_POINT = "roadEvents-point";

const CACHE_MAX = 7;

interface CachedDay {
  data: RoadEvent[];
  accessedAt: number;
}

function buildLayers(map: MapboxMap): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  const activeFilter = ["==", ["get", "active"], 1] as unknown as FilterSpecification;

  if (!map.getLayer(LAYER_FILL)) {
    map.addLayer({
      id: LAYER_FILL,
      type: "fill",
      source: SOURCE_ID,
      filter: ["all",
        activeFilter,
        ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      ] as unknown as FilterSpecification,
      paint: {
        "fill-color": ["get", "color"] as unknown as ExpressionSpecification,
        "fill-opacity": 0.22,
      },
    } as FillLayer);
  }

  if (!map.getLayer(LAYER_LINE)) {
    map.addLayer({
      id: LAYER_LINE,
      type: "line",
      source: SOURCE_ID,
      filter: ["all",
        activeFilter,
        ["match", ["geometry-type"], ["LineString", "MultiLineString", "Polygon", "MultiPolygon"], true, false],
      ] as unknown as FilterSpecification,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"] as unknown as ExpressionSpecification,
        "line-width": 2,
        "line-opacity": 0.9,
      },
    } as LineLayer);
  }

  if (!map.getLayer(LAYER_POINT)) {
    map.addLayer({
      id: LAYER_POINT,
      type: "circle",
      source: SOURCE_ID,
      filter: ["all",
        activeFilter,
        ["==", ["geometry-type"], "Point"],
      ] as unknown as FilterSpecification,
      paint: {
        "circle-radius": [
          "case",
          // severity 1-3 freeway events 較大
          [">=", ["get", "severity"], 1], 7,
          // event_city 預告較小
          ["==", ["get", "source"], "event_city"], 5,
          6,
        ] as unknown as ExpressionSpecification,
        "circle-color": ["get", "color"] as unknown as ExpressionSpecification,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.9,
      },
    } as CircleLayer);
  }

  return true;
}

export function useRoadEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 1,
) {
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());
  const activeDayRef = useRef<RoadEvent[] | null>(null);
  const activeDateRef = useRef<string>("");
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");
  const lastActiveSetRef = useRef<string>("");

  const writeCache = useCallback((dateStr: string, data: RoadEvent[]) => {
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
    src.setData(roadEventsToGeoJSON(day, t));
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
        if (map && ensureLayers(map)) refreshSource(map, timeStore.getTime());
        return;
      }

      fetchingRef.current = dateStr;
      fetchRoadEventsDay(dateStr)
        .then((events) => {
          writeCache(dateStr, events);
          if (fetchingRef.current !== dateStr) return;
          activeDayRef.current = events;
          activeDateRef.current = dateStr;
          lastActiveSetRef.current = "";
          const map = mapRef.current;
          if (map && ensureLayers(map)) {
            refreshSource(map, timeStore.getTime());
            keepLoadingUntilMapIdle(map, `road-events-render:${dateStr}`, "即時路況 渲染中", SOURCE_ID);
          }
        })
        .catch((err) => {
          console.warn(`[RoadEvents] load ${dateStr} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === dateStr) fetchingRef.current = "";
        });
    },
    [ensureLayers, refreshSource, writeCache, mapRef],
  );

  // ── 訂閱 timeStore 日期變化載入當日資料 ──
  useEffect(() => {
    if (!visible) return;
    const handler = (dateStr: string) => {
      if (dateStr) loadDay(dateStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [visible, loadDay]);

  // ── 訂閱 timeStore 節流更新 active filter ──
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

    const tick = (currentTime: number) => {
      const m = mapRef.current;
      if (!m) return;
      const day = activeDayRef.current;
      if (!day) return;

      let key = "";
      for (const e of day) {
        const isActive =
          (e.start_ts === 0 || currentTime >= e.start_ts) &&
          (e.end_ts == null || currentTime < e.end_ts);
        if (isActive) key += e.event_id + e.source + "|";
      }
      if (key !== lastActiveSetRef.current) {
        lastActiveSetRef.current = key;
        refreshSource(m, currentTime);
      }
    };

    tick(timeStore.getTime());
    return timeStore.subscribeThrottled(500, tick);
  }, [visible, ensureLayers, refreshSource, mapRef]);

  // ── 套用 opacity ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(LAYER_FILL)) {
      map.setPaintProperty(LAYER_FILL, "fill-opacity", 0.22 * o);
    }
    if (map.getLayer(LAYER_LINE)) {
      map.setPaintProperty(LAYER_LINE, "line-opacity", 0.9 * o);
    }
    if (map.getLayer(LAYER_POINT)) {
      map.setPaintProperty(LAYER_POINT, "circle-opacity", 0.9 * o);
      map.setPaintProperty(LAYER_POINT, "circle-stroke-opacity", o);
    }
  }, [opacity, visible, mapRef]);
}
