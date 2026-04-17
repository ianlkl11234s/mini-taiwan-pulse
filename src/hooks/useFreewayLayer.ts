import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, LineLayer, FilterSpecification } from "mapbox-gl";
import {
  fetchFreewayDay,
  buildFreewayGeoJSON,
  type FreewayDayData,
} from "../data/freewayLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * 國道壅塞動態圖層
 *
 * - 一次載入一整天所有路段 timeline（每 10 分鐘一個快照）
 * - 依 currentTime 找最近 snapshot，更新 feature properties.level + color
 * - LRU 快取 7 天；依 timeline 日切換自動載入
 * - 仿 useEarthquakeLayer 自行管理 Mapbox source + layers
 */

const SOURCE_ID = "freeway-congestion";
const LAYER_GLOW = "freewayCongestion-glow";
const LAYER_LINE = "freewayCongestion-line";

const CACHE_MAX = 7;

interface CachedDay {
  data: FreewayDayData;
  accessedAt: number;
}

function buildLayers(map: MapboxMap, width: number, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) return false;

  if (!map.getLayer(LAYER_GLOW)) {
    map.addLayer({
      id: LAYER_GLOW,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": 8 * width,
        "line-blur": 6,
        "line-opacity": isDark ? 0.08 : 0.12,
      },
      filter: ["!=", ["get", "level"], 0] as unknown as FilterSpecification,
    } as LineLayer);
  }

  if (!map.getLayer(LAYER_LINE)) {
    map.addLayer({
      id: LAYER_LINE,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6, 0.5 * width,
          10, 1.5 * width,
          13, 3 * width,
          16, 5 * width,
        ],
        "line-opacity": isDark ? 0.75 : 0.65,
      },
    } as LineLayer);
  }
  return true;
}

export function useFreewayLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  width: number,
  isDark: boolean,
) {
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());
  const activeDayRef = useRef<FreewayDayData | null>(null);
  const activeDateRef = useRef<string>("");
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");
  const lastSnapshotTsRef = useRef<number>(-1);

  /** 寫快取 + LRU */
  const writeCache = useCallback((dateStr: string, data: FreewayDayData) => {
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

  /** 確保 source + layers 存在 */
  const ensureLayers = useCallback(
    (map: MapboxMap) => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!layersReadyRef.current || !map.getLayer(LAYER_LINE)) {
        layersReadyRef.current = buildLayers(map, width, isDark);
      }
      return layersReadyRef.current;
    },
    [width, isDark],
  );

  /**
   * 更新 source 資料（依 currentTime）
   * 每秒觸發，只寫 setData，不延續 loading 指示器（否則 timeline 回放期間會一直亮）。
   * 載入新日資料後的 **首次** refresh 才延續 loading（見 loadDay 的成功 callback）。
   */
  const refreshSource = useCallback((map: MapboxMap, t: number) => {
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const fc = buildFreewayGeoJSON(activeDayRef.current, t);
    src.setData(fc);
  }, []);

  /** 切換日期 */
  const loadDay = useCallback(
    (dateStr: string) => {
      if (dateStr === activeDateRef.current) return;
      if (dateStr === fetchingRef.current) return;

      const cached = cacheRef.current.get(dateStr);
      if (cached) {
        cached.accessedAt = Date.now();
        activeDayRef.current = cached.data;
        activeDateRef.current = dateStr;
        lastSnapshotTsRef.current = -1; // 強制下一次 refresh
        const map = mapRef.current;
        if (map && ensureLayers(map)) refreshSource(map, timeStore.getTime());
        return;
      }

      fetchingRef.current = dateStr;
      fetchFreewayDay(dateStr)
        .then((day) => {
          writeCache(dateStr, day);
          // 若期間使用者又切到更新的日期就放棄
          if (fetchingRef.current !== dateStr) return;
          activeDayRef.current = day;
          activeDateRef.current = dateStr;
          lastSnapshotTsRef.current = -1;
          const map = mapRef.current;
          if (map && ensureLayers(map)) {
            refreshSource(map, timeStore.getTime());
            // 新日資料載入後，延續 loading 到 Mapbox 真的畫完
            keepLoadingUntilMapIdle(map, `freeway-render:${dateStr}`, `國道壅塞 渲染中`, SOURCE_ID);
          }
        })
        .catch((err) => {
          console.warn(`[Freeway] load ${dateStr} failed:`, err);
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

  // ── 訂閱 timeStore 節流更新 source data（只在 snapshot 改變時） ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of [LAYER_GLOW, LAYER_LINE]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
      return;
    }
    if (!ensureLayers(map)) return;
    for (const id of [LAYER_GLOW, LAYER_LINE]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
    }

    const tick = (currentTime: number) => {
      const m = mapRef.current;
      if (!m) return;
      const day = activeDayRef.current;
      if (!day) return;

      // 找當前時間對應的 snapshot 時間，避免每幀都 setData
      let snapTs = -1;
      const firstTimeline = day.sections[0]?.timeline;
      if (firstTimeline && firstTimeline.length > 0) {
        let lo = 0;
        let hi = firstTimeline.length - 1;
        if (currentTime >= firstTimeline[0]!.ts) {
          while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (firstTimeline[mid]!.ts <= currentTime) lo = mid;
            else hi = mid - 1;
          }
          snapTs = firstTimeline[lo]!.ts;
        }
      }
      if (snapTs !== lastSnapshotTsRef.current) {
        lastSnapshotTsRef.current = snapTs;
        refreshSource(m, currentTime);
      }
    };

    tick(timeStore.getTime()); // 初始化
    // 1s 節流足夠（資料本身 10min 粒度）
    return timeStore.subscribeThrottled(1000, tick);
  }, [visible, ensureLayers, refreshSource, mapRef]);

  // ── 寬度 / 主題變更時重建 paint ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (map.getLayer(LAYER_GLOW)) {
      map.setPaintProperty(LAYER_GLOW, "line-width", 8 * width);
      map.setPaintProperty(LAYER_GLOW, "line-opacity", isDark ? 0.08 : 0.12);
    }
    if (map.getLayer(LAYER_LINE)) {
      map.setPaintProperty(LAYER_LINE, "line-width", [
        "interpolate",
        ["linear"],
        ["zoom"],
        6, 0.5 * width,
        10, 1.5 * width,
        13, 3 * width,
        16, 5 * width,
      ] as unknown as mapboxgl.ExpressionSpecification);
      map.setPaintProperty(LAYER_LINE, "line-opacity", isDark ? 0.75 : 0.65);
    }
  }, [width, isDark, mapRef]);
}
