import { useEffect, useRef, useCallback } from "react";
import type {
  Map as MapboxMap,
  FillLayer,
  LineLayer,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchPlaTracksDay,
  fetchPlaDailyStats,
  tracksToGeoJSON,
  type PlaTrack,
  type PlaDailyStat,
} from "../data/plaTracksLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * 共機活動區 timeline 圖層（依日期回放）
 *
 * - 資料：spatial.pla_tracks（國防部每日航跡示意圖向量化產物，migration 330）
 * - fill / line 兩層共用單一 GeoJSON source，依 shape_kind 分色
 * - 按日切換 + LRU 快取 7 天
 * - ⚠️ **只訂閱 subscribeDate，不掛 subscribeThrottled**：
 *   共機資料一天一組形狀、無 intraday 變化，不需要依 currentTime 切片
 *   （對照 useDisasterAlertLayer 需要 active 時間窗過濾）
 * - ⚠️ 依鐵則不得把 currentTime 放進 deps，一律走 timeStore 訂閱
 */

const SOURCE_ID = "pla-activity";
const FILL_ID = "pla-activity-fill";
const LINE_ID = "pla-activity-line";
const CACHE_MAX = 7;

/** 給 useMapInteraction 的可點擊 layer 清單（fill + line 兩層都要納入） */
export const PLA_ACTIVITY_CLICK_LAYERS = [FILL_ID, LINE_ID];

const BASE_FILL_OPACITY = 0.22;
const BASE_LINE_OPACITY = 0.95;

/** 未核實的形狀用虛線框 + 更低透明度，視覺上就與已核實區分 */
const LINE_DASH: ExpressionSpecification = [
  "case",
  ["==", ["get", "needs_review"], 1],
  ["literal", [2, 2]],
  ["literal", [1, 0]],
] as unknown as ExpressionSpecification;

const fillOpacityExpr = (o: number): ExpressionSpecification =>
  [
    "*",
    o,
    ["case", ["==", ["get", "needs_review"], 1], BASE_FILL_OPACITY * 0.5, BASE_FILL_OPACITY],
  ] as unknown as ExpressionSpecification;

interface CachedDay {
  data: PlaTrack[];
  accessedAt: number;
}

function buildLayers(map: MapboxMap): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  if (!map.getLayer(FILL_ID)) {
    map.addLayer({
      id: FILL_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["get", "kind_color"] as unknown as ExpressionSpecification,
        "fill-opacity": fillOpacityExpr(1),
      },
    } as FillLayer);
  }

  if (!map.getLayer(LINE_ID)) {
    map.addLayer({
      id: LINE_ID,
      type: "line",
      source: SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "kind_color"] as unknown as ExpressionSpecification,
        "line-width": 1.6,
        "line-opacity": BASE_LINE_OPACITY,
        "line-dasharray": LINE_DASH,
      },
    } as LineLayer);
  }

  return true;
}

export function usePlaActivityLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 1,
  includeReview: boolean = false,
) {
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());
  const activeDayRef = useRef<PlaTrack[] | null>(null);
  const activeDateRef = useRef<string>("");
  const statsRef = useRef<Map<string, PlaDailyStat> | null>(null);
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");

  const writeCache = useCallback((key: string, data: PlaTrack[]) => {
    const cache = cacheRef.current;
    cache.set(key, { data, accessedAt: Date.now() });
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
    if (!layersReadyRef.current || !map.getLayer(FILL_ID)) {
      layersReadyRef.current = buildLayers(map);
    }
    return layersReadyRef.current;
  }, []);

  const refreshSource = useCallback((map: MapboxMap) => {
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const date = activeDateRef.current;
    src.setData(
      tracksToGeoJSON(activeDayRef.current ?? [], date, statsRef.current?.get(date)),
    );
  }, []);

  const loadDay = useCallback(
    (dateStr: string) => {
      const key = `${dateStr}|${includeReview ? "all" : "ok"}`;
      if (key === fetchingRef.current) return;

      const cached = cacheRef.current.get(key);
      if (cached) {
        cached.accessedAt = Date.now();
        activeDayRef.current = cached.data;
        activeDateRef.current = dateStr;
        const map = mapRef.current;
        if (map && ensureLayers(map)) refreshSource(map);
        return;
      }

      fetchingRef.current = key;
      Promise.all([
        fetchPlaTracksDay(dateStr, includeReview),
        statsRef.current ? Promise.resolve(statsRef.current) : fetchPlaDailyStats(),
      ])
        .then(([tracks, stats]) => {
          statsRef.current = stats;
          writeCache(key, tracks);
          // 換日競態：只有仍在等這一天時才落地
          if (fetchingRef.current !== key) return;
          activeDayRef.current = tracks;
          activeDateRef.current = dateStr;
          const map = mapRef.current;
          if (map && ensureLayers(map)) {
            refreshSource(map);
            keepLoadingUntilMapIdle(
              map,
              `pla-activity-render:${dateStr}`,
              "共機活動區 渲染中",
              SOURCE_ID,
            );
          }
        })
        .catch((err) => {
          console.warn(`[PlaActivity] load ${dateStr} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === key) fetchingRef.current = "";
        });
    },
    [ensureLayers, refreshSource, writeCache, mapRef, includeReview],
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

  // ── 可見性 + style.load 後重建圖層 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const vis = visible ? "visible" : "none";
      for (const id of [FILL_ID, LINE_ID]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
      }
    };

    if (!visible) {
      apply();
      return;
    }
    if (!ensureLayers(map)) return;
    refreshSource(map);
    apply();

    // 換底圖會清掉 source/layer，重餵一次
    const onStyleLoad = () => {
      layersReadyRef.current = false;
      if (!ensureLayers(map)) return;
      refreshSource(map);
      apply();
    };
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [visible, ensureLayers, refreshSource, mapRef]);

  // ── 透明度 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (map.getLayer(FILL_ID)) {
      map.setPaintProperty(FILL_ID, "fill-opacity", fillOpacityExpr(o));
    }
    if (map.getLayer(LINE_ID)) {
      map.setPaintProperty(LINE_ID, "line-opacity", BASE_LINE_OPACITY * o);
    }
  }, [opacity, visible, mapRef]);
}
