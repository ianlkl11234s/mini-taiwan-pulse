/**
 * 垃圾車「表定」圖層 hook（Phase 3 prototype）
 *
 * 設計：
 *   - schedule 是 day-of-week 驅動，不是 specific-date
 *     → cache key = `${citiesSorted}:${dow}`，最多 8 個（5 城 × 7 dow 通常夠）
 *   - 訂閱 timeStore.subscribeDate 取得當日的 dow，dow 變化才重新 fetch
 *   - 不訂閱 currentTime（每幀位置插值是 Scene 的事，不走 React deps）
 *   - 跟 useWasteLayer (GPS) 並行存在、互不影響
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timeStore } from "../state/timeStore";
// AR-22 P4：城市清單改由本 hook 自己從 store 讀（per-key 訂閱）
import { useLayerParams } from "../state/layerParamsStore";
import { enabledWasteScheduleCitiesOf } from "../state/layerParamRefs";
import {
  fetchWasteScheduleDay,
  type WasteScheduleRoute,
} from "../data/wasteScheduleLoader";

const MAX_CACHE_ENTRIES = 8;

interface CachedDay {
  key: string;
  routes: WasteScheduleRoute[];
}

/** 把 timeStore date key 'YYYY-MM-DD' 轉 0-6 (Sun..Sat) */
function dowFromDateKey(dateKey: string): number {
  // dateKey 已是 Asia/Taipei 的 YYYY-MM-DD，直接 new Date 解析會被當 UTC，
  // 但因為只取 day-of-week，加 'T12:00:00Z' 確保跨時區也是同一天
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.getUTCDay();
}

export function useWasteScheduleLayer(
  enabled: boolean,
) {
  // 8 區分組 checkbox → 城市清單（同 useBusLayer）
  const scheduleParams = useLayerParams("wasteSchedule");
  const cities = useMemo(
    () => enabledWasteScheduleCitiesOf(scheduleParams),
    [scheduleParams],
  );
  const routesRef = useRef<WasteScheduleRoute[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const citiesKey = [...cities].sort().join(",");
  const cacheRef = useRef<CachedDay[]>([]);
  const loadedKeyRef = useRef("");
  const fetchingKeyRef = useRef("");

  const loadDow = useCallback(async (dow: number) => {
    const cacheKey = `${citiesKey}:${dow}`;
    if (loadedKeyRef.current === cacheKey) return;
    if (fetchingKeyRef.current === cacheKey) return;

    const cached = cacheRef.current.find((c) => c.key === cacheKey);
    if (cached) {
      loadedKeyRef.current = cacheKey;
      routesRef.current = cached.routes;
      setCount(cached.routes.length);
      return;
    }

    fetchingKeyRef.current = cacheKey;
    setLoading(true);
    try {
      const routes = await fetchWasteScheduleDay(cities, dow);
      cacheRef.current = [
        { key: cacheKey, routes },
        ...cacheRef.current.filter((c) => c.key !== cacheKey),
      ].slice(0, MAX_CACHE_ENTRIES);
      loadedKeyRef.current = cacheKey;
      routesRef.current = routes;
      setCount(routes.length);
    } catch (err) {
      console.error("[WasteSchedule] fetchWasteScheduleDay failed:", err);
    } finally {
      fetchingKeyRef.current = "";
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesKey]);

  // 啟用時：載入當前 dow + 訂閱日期變化
  useEffect(() => {
    if (!enabled) {
      routesRef.current = [];
      setCount(0);
      loadedKeyRef.current = "";
      return;
    }
    // 初次：用 timeStore 當前日期 → dow
    void loadDow(dowFromDateKey(timeStore.getDateKey()));
    // 訂閱跨日：dow 可能變
    return timeStore.subscribeDate((dateKey) => {
      void loadDow(dowFromDateKey(dateKey));
    });
  }, [enabled, loadDow]);

  // 城市切換時 reset loadedKey 強制 next loadDow 重新拉
  useEffect(() => {
    if (!enabled) return;
    loadedKeyRef.current = "";
    void loadDow(dowFromDateKey(timeStore.getDateKey()));
  }, [enabled, citiesKey, loadDow]);

  return { routesRef, count, loading };
}
