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
import {
  fetchWasteTrails,
  fetchWasteTrailsDay,
  fetchWasteTrailsMatchedDay,
  type WasteTrailRow,
} from "../data/wasteLoader";

/** 載多久軌跡（分鐘） */
const TRAIL_WINDOW_MIN = 60;
/** 重抓間隔（ms） */
const POLL_INTERVAL = 60_000;
/** Replay day cache 最大天數 */
const MAX_CACHED_DAYS = 3;
/** 預設啟用 matched replay；設 VITE_WASTE_MATCHED_TRAILS=0 可強制走 GPS fallback。 */
const USE_MATCHED_REPLAY = import.meta.env.VITE_WASTE_MATCHED_TRAILS !== "0";

interface CachedDay {
  key: string;
  date: string;
  trails: WasteTrailRow[];
}

function uniqueVehicleCount(rows: WasteTrailRow[]): number {
  return new Set(rows.map((r) => `${r.city}:${r.vehicle_no}`)).size;
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
        setCount(uniqueVehicleCount(rows));
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
      setCount(uniqueVehicleCount(cached.trails));
      return;
    }

    fetchingDayRef.current = fetchKey;
    setLoading(true);
    try {
      let rows: WasteTrailRow[] = [];

      if (USE_MATCHED_REPLAY) {
        try {
          rows = await fetchWasteTrailsMatchedDay(dateStr, cities);
          if (rows.length > 0) {
            console.log(`[Waste] matched trails loaded for ${dateStr}: ${rows.length} segments`);
          }
        } catch (err) {
          console.warn("[Waste] fetchWasteTrailsMatchedDay failed, fallback to GPS trails:", err);
        }
      }

      if (rows.length === 0) {
        rows = await fetchWasteTrailsDay(dateStr, cities);
      }

      cacheRef.current = [
        { key: fetchKey, date: dateStr, trails: rows },
        ...cacheRef.current.filter((c) => c.key !== fetchKey),
      ].slice(0, MAX_CACHED_DAYS);

      loadedDayRef.current = fetchKey;
      trailsRef.current = rows;
      setCount(uniqueVehicleCount(rows));
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
