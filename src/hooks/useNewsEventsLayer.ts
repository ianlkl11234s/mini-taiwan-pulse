import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { fetchNewsEventsDay, DEFAULT_NEWS_FILTER, type NewsFilter } from "../data/newsEventsLoader";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 新聞事件資料載入（Supabase 按日）
 *
 * - 只負責「資料側」：跨日切換時抓當日事件，餵進 overlayRegistry 建好的
 *   `news-events` source（glow/circle 樣式、時間過濾與 ripple 動畫仍由
 *   overlayRegistry + useNewsTimeline 處理，完全不動）
 * - 跨日切換訂閱 timeStore.subscribeDate（currentTime 不進 React deps）
 * - 快取在 loader 層（cachedByKey 10min TTL + LRU），重回日期不重抓
 * - style 切換後 source 會被重建為空 FeatureCollection，監聽 style.load 重餵
 */

const SOURCE_ID = "news-events";
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function filterKey(f: NewsFilter): string {
  return `${f.minRelevance}|${f.eventsOnly ? 1 : 0}|${f.minSeverity}`;
}

export function useNewsEventsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  filter: NewsFilter = DEFAULT_NEWS_FILTER,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const activeFcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const activeKeyRef = useRef<string>(""); // "date|gr|ev|sv" 組合 key
  const fetchingRef = useRef<string>("");

  const feed = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(activeFcRef.current ?? EMPTY_FC);
  }, [mapRef, mapTick]);

  const loadDay = useCallback(
    (dateStr: string, f: NewsFilter) => {
      const key = `${dateStr}|${filterKey(f)}`;
      if (key === activeKeyRef.current) return;
      if (key === fetchingRef.current) return;

      fetchingRef.current = key;
      fetchNewsEventsDay(dateStr, f)
        .then((fc) => {
          if (fetchingRef.current !== key) return; // 已切到別的 date/filter，丟棄舊回應
          activeFcRef.current = fc;
          activeKeyRef.current = key;
          feed();
          const map = mapRef.current;
          if (map && map.getSource(SOURCE_ID)) {
            keepLoadingUntilMapIdle(map, `news-render:${key}`, "新聞事件 渲染中", SOURCE_ID);
          }
        })
        .catch((err) => {
          console.warn(`[NewsEvents] load ${key} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === key) fetchingRef.current = "";
        });
    },
    [feed, mapRef],
  );

  // ── 訂閱 timeStore 日期變化 + 監聽 filter 變化 ──
  const fKey = filterKey(filter);
  useEffect(() => {
    if (!visible) return;
    const handler = (dateStr: string) => {
      if (dateStr) loadDay(dateStr, filter);
    };
    handler(timeStore.getDateKey()); // 初始化（toggle 開啟瞬間補載 / filter 切換立即重載）
    return timeStore.subscribeDate(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fKey, loadDay]);

  // ── style 切換後 source 重建為空 → 重餵已載入資料 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const onStyleLoad = () => feed();
    map.on("style.load", onStyleLoad);
    feed(); // 立即補餵（map 已就緒、資料已在手的情境）
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [visible, feed, mapRef, mapTick]);
}
