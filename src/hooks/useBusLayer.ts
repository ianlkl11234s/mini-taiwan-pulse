/**
 * 公車圖層 hook — Live (GPS polling) + Replay (歷史軌跡)
 *
 * 單一 toggle，依 timeMode 自動切換：
 *   live   → 30s poll bus_current，用 Date.now()
 *   replay → 載入 bus_trails_daily，用 timeRef.current
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusVehicle, BusTrail, TimeMode, BusCity } from "../types";
import { BusEngine } from "../engines/BusEngine";
import { loadBusRoutesForCity, fetchBusCurrent, fetchBusTrails } from "../data/busLoader";

/** Supabase polling 間隔 (ms) */
const POLL_INTERVAL = 30_000;
/** LRU cache 最大天數 */
const MAX_CACHED_DAYS = 3;

interface CachedDay {
  date: string;
  trails: BusTrail[];
}

export function useBusLayer(
  enabled: boolean,
  timeRef: React.RefObject<number>,
  timeMode: TimeMode,
  cities: BusCity[] = ["Taipei"],
) {
  const engineRef = useRef<BusEngine | null>(null);
  const activeBusesRef = useRef<BusVehicle[]>([]);
  const [busCount, setBusCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Replay LRU cache
  const cacheRef = useRef<CachedDay[]>([]);
  const loadedDayRef = useRef<string>("");
  const fetchingDayRef = useRef<string>("");

  const isLive = timeMode === "live";

  // 載入靜態路線（lazy，cities 變化時重新載入）
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);

    const engine = engineRef.current ?? new BusEngine();
    engineRef.current = engine;

    Promise.all(
      cities.map((city) =>
        loadBusRoutesForCity(city).then((data) => {
          if (!cancelled) engine.addCityRoutes(city, data);
        }),
      ),
    )
      .catch((err) => {
        if (cancelled) return;
        console.error("[Bus] Failed to load routes:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cities.join(",")]);

  // ── Live: Polling bus_current ──
  useEffect(() => {
    if (!enabled || !isLive || !engineRef.current) return;

    // 切到 live 時清空 replay 資料
    engineRef.current.clearReplay();

    let isFetching = false;
    let cancelled = false;

    const poll = async () => {
      if (isFetching || cancelled) return;
      isFetching = true;
      try {
        const positions = await fetchBusCurrent(cities);
        if (!cancelled && engineRef.current) {
          engineRef.current.ingestPoll(positions, Date.now() / 1000);
          console.log(`[Bus] Poll: ${positions.length} vehicles`);
        }
      } catch (err) {
        console.warn("[Bus] Poll error:", err);
      } finally {
        isFetching = false;
      }
    };

    poll();
    let interval = setInterval(poll, POLL_INTERVAL);

    // 背景分頁時暫停 polling，回到前景時恢復
    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        poll();
        interval = setInterval(poll, POLL_INTERVAL);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, isLive, engineRef.current !== null]);

  // ── Replay: loadDay callback ──
  const loadDay = useCallback(async (dateStr: string) => {
    if (!engineRef.current || !enabled || isLive) return;
    if (loadedDayRef.current === dateStr) return;
    if (fetchingDayRef.current === dateStr) return; // 防重複 fetch

    // 檢查 cache
    const cached = cacheRef.current.find((c) => c.date === dateStr);
    if (cached) {
      loadedDayRef.current = dateStr;
      engineRef.current.ingestTrails(cached.trails);
      return;
    }

    // Fetch from Supabase
    fetchingDayRef.current = dateStr;
    try {
      const trails = await fetchBusTrails(dateStr, cities);
      if (trails.length === 0) {
        console.log(`[Bus] No trail data for ${dateStr}`);
        engineRef.current.clearReplay();
        loadedDayRef.current = dateStr;
        return;
      }

      // LRU cache
      cacheRef.current = [
        { date: dateStr, trails },
        ...cacheRef.current.filter((c) => c.date !== dateStr),
      ].slice(0, MAX_CACHED_DAYS);

      loadedDayRef.current = dateStr;
      engineRef.current.ingestTrails(trails);
    } catch (err) {
      console.warn("[Bus] loadDay error:", err);
    } finally {
      fetchingDayRef.current = "";
    }
  }, [enabled, isLive]);

  // 切到 replay 時清空 live 資料，讓 loadDay 可以接手
  useEffect(() => {
    if (!enabled || isLive || !engineRef.current) return;
    loadedDayRef.current = ""; // 強制下次 loadDay 觸發
  }, [enabled, isLive]);

  // ── Per-frame animation loop ──
  useEffect(() => {
    if (!enabled || !engineRef.current) return;

    let animId: number;
    let lastCountUpdate = 0;

    const tick = () => {
      const now = isLive ? Date.now() / 1000 : timeRef.current;
      if (engineRef.current) {
        activeBusesRef.current = engineRef.current.update(now);
      }

      const ts = performance.now();
      if (ts - lastCountUpdate > 500) {
        lastCountUpdate = ts;
        setBusCount(activeBusesRef.current.length);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [enabled, isLive, engineRef.current !== null, timeRef]);

  // 停用時清空
  useEffect(() => {
    if (!enabled) {
      activeBusesRef.current = [];
      setBusCount(0);
    }
  }, [enabled]);

  return { busCount, activeBusesRef, loading, loadDay };
}
