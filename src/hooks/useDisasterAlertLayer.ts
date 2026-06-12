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
import { ALERT_GROUP_KEYS, type AlertGroupKey } from "../data/disasterAlertTypes";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * NCDR 災害示警 timeline 圖層（5 主題群組）
 *
 * - 一次載入一整天的所有 alert，共用單一 GeoJSON source
 * - 5 群組（民生中斷/水文防汛/氣象特報/交通阻斷/安全環境）各自
 *   fill/line/point 三層，filter 在 properties.group 上，可獨立 toggle
 * - 顏色依 event_term（tcolor），fill 透明度依 severity 分級
 * - 依 currentTime 過濾出當前 active（start <= now < end）
 * - 按日切換 + LRU 快取 7 天
 */

const SOURCE_ID = "disaster-alerts";
const CACHE_MAX = 7;

const layerIds = (group: AlertGroupKey) => ({
  fill: `${group}-fill`,
  line: `${group}-line`,
  point: `${group}-point`,
});

/** 給 useMapInteraction 的可點擊 layer 清單 */
export const DISASTER_ALERT_CLICK_LAYERS = ALERT_GROUP_KEYS.flatMap((g) => {
  const ids = layerIds(g);
  return [ids.fill, ids.line, ids.point];
});

const SEVERITY_FILL_OPACITY: ExpressionSpecification = [
  "match",
  ["get", "severity"],
  "Extreme", 0.35,
  "Severe", 0.28,
  "Moderate", 0.22,
  "Minor", 0.15,
  0.18,
] as unknown as ExpressionSpecification;

interface CachedDay {
  data: DisasterAlert[];
  accessedAt: number;
}

function buildLayers(map: MapboxMap): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  for (const group of ALERT_GROUP_KEYS) {
    const ids = layerIds(group);
    // active + 群組 + polygon/point 區分
    const baseFilter = [
      "all",
      ["==", ["get", "active"], 1],
      ["==", ["get", "group"], group],
    ];
    const polyFilter = [...baseFilter, ["==", ["get", "is_pt"], 0]] as unknown as FilterSpecification;
    const ptFilter = [...baseFilter, ["==", ["get", "is_pt"], 1]] as unknown as FilterSpecification;

    if (!map.getLayer(ids.fill)) {
      map.addLayer({
        id: ids.fill,
        type: "fill",
        source: SOURCE_ID,
        filter: polyFilter,
        paint: {
          "fill-color": ["get", "tcolor"] as unknown as ExpressionSpecification,
          "fill-opacity": SEVERITY_FILL_OPACITY,
        },
      } as FillLayer);
    }

    if (!map.getLayer(ids.line)) {
      map.addLayer({
        id: ids.line,
        type: "line",
        source: SOURCE_ID,
        filter: polyFilter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "tcolor"] as unknown as ExpressionSpecification,
          "line-width": 1.5,
          "line-opacity": 0.9,
        },
      } as LineLayer);
    }

    if (!map.getLayer(ids.point)) {
      map.addLayer({
        id: ids.point,
        type: "circle",
        source: SOURCE_ID,
        filter: ptFilter,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, 3.5,
            10, 5.5,
            14, 7,
          ] as unknown as ExpressionSpecification,
          "circle-color": ["get", "tcolor"] as unknown as ExpressionSpecification,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.85,
        },
      } as CircleLayer);
    }
  }

  return true;
}

export function useDisasterAlertLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: Record<AlertGroupKey, boolean>,
  opacity: number = 1,
) {
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());
  const activeDayRef = useRef<DisasterAlert[] | null>(null);
  const activeDateRef = useRef<string>("");
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");
  const lastActiveSetRef = useRef<string>("");

  const anyVisible = ALERT_GROUP_KEYS.some((k) => visibility[k]);
  // effect dep 用的穩定 key（避免物件 identity 每 render 變動）
  const visKey = ALERT_GROUP_KEYS.map((k) => (visibility[k] ? "1" : "0")).join("");
  const visRef = useRef(visibility);
  visRef.current = visibility;

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
    const probe = layerIds(ALERT_GROUP_KEYS[0]!).fill;
    if (!layersReadyRef.current || !map.getLayer(probe)) {
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
        if (map && ensureLayers(map)) refreshSource(map, timeStore.getTime());
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
          if (map && ensureLayers(map)) {
            refreshSource(map, timeStore.getTime());
            keepLoadingUntilMapIdle(map, `disaster-render:${dateStr}`, "災害示警 渲染中", SOURCE_ID);
          }
        })
        .catch((err) => {
          console.warn(`[DisasterAlerts] load ${dateStr} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === dateStr) fetchingRef.current = "";
        });
    },
    [ensureLayers, refreshSource, writeCache, mapRef],
  );

  // ── 訂閱 timeStore 日期變化載入當日資料 ──
  useEffect(() => {
    if (!anyVisible) return;
    const handler = (dateStr: string) => {
      if (dateStr) loadDay(dateStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [anyVisible, loadDay]);

  // ── 群組可見性 + 訂閱 timeStore 節流更新 active filter ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      for (const group of ALERT_GROUP_KEYS) {
        const ids = layerIds(group);
        const vis = visRef.current[group] ? "visible" : "none";
        for (const id of [ids.fill, ids.line, ids.point]) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
        }
      }
    };

    if (!anyVisible) {
      applyVisibility();
      return;
    }
    if (!ensureLayers(map)) return;
    applyVisibility();

    const tick = (currentTime: number) => {
      const m = mapRef.current;
      if (!m) return;
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
        refreshSource(m, currentTime);
      }
    };

    tick(timeStore.getTime()); // 初始化
    return timeStore.subscribeThrottled(500, tick);
  }, [anyVisible, visKey, ensureLayers, refreshSource, mapRef]);

  // 套用 opacity（乘以各 layer 的 base opacity，5 群組共用）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    for (const group of ALERT_GROUP_KEYS) {
      const ids = layerIds(group);
      if (map.getLayer(ids.fill)) {
        map.setPaintProperty(ids.fill, "fill-opacity", [
          "*",
          o,
          SEVERITY_FILL_OPACITY,
        ] as unknown as ExpressionSpecification);
      }
      if (map.getLayer(ids.line)) {
        map.setPaintProperty(ids.line, "line-opacity", 0.9 * o);
      }
      if (map.getLayer(ids.point)) {
        map.setPaintProperty(ids.point, "circle-opacity", 0.85 * o);
        map.setPaintProperty(ids.point, "circle-stroke-opacity", o);
      }
    }
  }, [opacity, visKey, mapRef]);
}
