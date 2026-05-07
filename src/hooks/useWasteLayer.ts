/**
 * 垃圾車圖層 hook — Live trails polling + Replay day trails
 *
 * live   → 抓近 60 分鐘軌跡，每 60s refresh。
 * replay → 載入指定台灣日期整日軌跡，讓 timeline 可拖到昨天 / 今日較早時段。
 *
 * 多城市可復用：cities 陣列傳給 RPC。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeMode } from "../types";
import { fetchWasteTrails, fetchWasteTrailsDay, type WasteTrailRow } from "../data/wasteLoader";

/** 載多久軌跡（分鐘） */
const TRAIL_WINDOW_MIN = 60;
/** 重抓間隔（ms） */
const POLL_INTERVAL = 60_000;
/** Replay day cache 最大天數 */
const MAX_CACHED_DAYS = 3;

interface CachedDay {
  key: string;
  date: string;
  trails: WasteTrailRow[];
}

export function useWasteLayer(
  enabled: boolean,
  timeMode: TimeMode,
  cities: string[] = ["高雄市"],
) {
  const trailsRef = useRef<WasteTrailRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const isLive = timeMode === "live";
  const citiesKey = [...cities].sort().join(",");
  const cacheRef = useRef<CachedDay[]>([]);
  const loadedDayRef = useRef("");
  const fetchingDayRef = useRef("");

  useEffect(() => {
    if (!enabled || !isLive) {
      trailsRef.current = [];
      setCount(0);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let isFetching = false;

    const tick = async () => {
      if (isFetching || cancelled) return;
      isFetching = true;
      if (trailsRef.current.length === 0) setLoading(true);
      try {
        const rows = await fetchWasteTrails(cities, TRAIL_WINDOW_MIN);
        if (cancelled) return;
        trailsRef.current = rows;
        setCount(rows.length);
      } catch (err) {
        if (!cancelled) console.error("[Waste] fetchWasteTrails failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
        isFetching = false;
      }
    };

    void tick();
    timer = window.setInterval(tick, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isLive, citiesKey]);

  const loadDay = useCallback(async (dateStr: string) => {
    if (!enabled || isLive || !dateStr) return;
    const fetchKey = `${dateStr}:${citiesKey}`;
    if (loadedDayRef.current === fetchKey) return;
    if (fetchingDayRef.current === fetchKey) return;

    const cached = cacheRef.current.find((c) => c.key === fetchKey);
    if (cached) {
      loadedDayRef.current = fetchKey;
      trailsRef.current = cached.trails;
      setCount(cached.trails.length);
      return;
    }

    fetchingDayRef.current = fetchKey;
    setLoading(true);
    try {
      const rows = await fetchWasteTrailsDay(dateStr, cities);
      cacheRef.current = [
        { key: fetchKey, date: dateStr, trails: rows },
        ...cacheRef.current.filter((c) => c.key !== fetchKey),
      ].slice(0, MAX_CACHED_DAYS);

      loadedDayRef.current = fetchKey;
      trailsRef.current = rows;
      setCount(rows.length);
      if (rows.length === 0) {
        console.log(`[Waste] No trail data for ${dateStr} (${citiesKey})`);
      }
    } catch (err) {
      console.error("[Waste] fetchWasteTrailsDay failed:", err);
    } finally {
      fetchingDayRef.current = "";
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isLive, citiesKey]);

  // 切到 replay 或城市變化時強制下一次 date subscription 重新載入。
  useEffect(() => {
    if (!enabled || isLive) return;
    loadedDayRef.current = "";
  }, [enabled, isLive, citiesKey]);

  return { trailsRef, count, loading, loadDay };
}
