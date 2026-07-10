/**
 * 台灣好行 (Tourist Shuttle) 圖層 hook — Live + Replay
 *
 * 架構完全沿用 useBusIntercityLayer：
 *   - 全國單一資料源，無 cities 切換參數
 *   - Loader 用 loadTouristShuttleRoutes / fetchTouristShuttleCurrent / fetchTouristShuttleTrails
 *   - Engine 內部用 "TouristShuttle" 虛擬 city key 管理路線
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusVehicle, BusTrail, TimeMode } from "../types";
import { BusEngine } from "../engines/BusEngine";
import {
  loadTouristShuttleRoutes,
  fetchTouristShuttleCurrent,
  fetchTouristShuttleTrails,
} from "../data/touristShuttleLoader";
import { timeStore } from "../state/timeStore";

const POLL_INTERVAL = 30_000;
const MAX_CACHED_DAYS = 3;
const CITY_KEY = "TouristShuttle";

interface CachedDay {
  date: string;
  trails: BusTrail[];
}

export function useTouristShuttleLayer(
  enabled: boolean,
  timeMode: TimeMode,
) {
  const engineRef = useRef<BusEngine | null>(null);
  const activeBusesRef = useRef<BusVehicle[]>([]);
  const [busCount, setBusCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const cacheRef = useRef<CachedDay[]>([]);
  const loadedDayRef = useRef<string>("");
  const fetchingDayRef = useRef<string>("");

  const isLive = timeMode === "live";

  // 載入靜態路線
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    const engine = engineRef.current ?? new BusEngine();
    engineRef.current = engine;

    loadTouristShuttleRoutes()
      .then((data) => {
        if (!cancelled) engine.addCityRoutes(CITY_KEY, data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[TouristShuttle] Failed to load routes:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled]);

  // Live polling
  useEffect(() => {
    if (!enabled || !isLive || !engineRef.current) return;

    engineRef.current.clearReplay();

    let isFetching = false;
    let cancelled = false;

    const poll = async () => {
      if (isFetching || cancelled) return;
      isFetching = true;
      try {
        const positions = await fetchTouristShuttleCurrent();
        if (!cancelled && engineRef.current) {
          engineRef.current.ingestPoll(positions, Date.now() / 1000);
          console.log(`[TouristShuttle] Poll: ${positions.length} vehicles`);
        }
      } catch (err) {
        console.warn("[TouristShuttle] Poll error:", err);
      } finally {
        isFetching = false;
      }
    };

    poll();
    let interval = setInterval(poll, POLL_INTERVAL);

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

  // Replay: loadDay callback
  const loadDay = useCallback(async (dateStr: string) => {
    if (!engineRef.current || !enabled || isLive) return;
    if (loadedDayRef.current === dateStr) return;
    if (fetchingDayRef.current === dateStr) return;

    const cached = cacheRef.current.find((c) => c.date === dateStr);
    if (cached) {
      loadedDayRef.current = dateStr;
      engineRef.current.ingestTrails(cached.trails);
      return;
    }

    fetchingDayRef.current = dateStr;
    try {
      const trails = await fetchTouristShuttleTrails(dateStr);
      if (trails.length === 0) {
        console.log(`[TouristShuttle] No trail data for ${dateStr}`);
        engineRef.current.clearReplay();
        loadedDayRef.current = dateStr;
        return;
      }

      cacheRef.current = [
        { date: dateStr, trails },
        ...cacheRef.current.filter((c) => c.date !== dateStr),
      ].slice(0, MAX_CACHED_DAYS);

      loadedDayRef.current = dateStr;
      engineRef.current.ingestTrails(trails);
    } catch (err) {
      console.warn("[TouristShuttle] loadDay error:", err);
    } finally {
      fetchingDayRef.current = "";
    }
  }, [enabled, isLive]);

  // 切到 replay 時清掉 loadedDayRef 讓 loadDay 重跑
  useEffect(() => {
    if (!enabled || isLive || !engineRef.current) return;
    loadedDayRef.current = "";
  }, [enabled, isLive]);

  // 訂閱 timeStore 計算公車位置（不開獨立 RAF）
  useEffect(() => {
    if (!enabled || !engineRef.current) return;

    let lastCountUpdate = 0;

    const update = (now: number) => {
      if (engineRef.current) {
        activeBusesRef.current = engineRef.current.update(now);
      }

      const ts = performance.now();
      if (ts - lastCountUpdate > 500) {
        lastCountUpdate = ts;
        setBusCount(activeBusesRef.current.length);
      }
    };

    update(timeStore.getTime()); // 初始化
    return timeStore.subscribe(update);
  }, [enabled, engineRef.current !== null]);

  useEffect(() => {
    if (!enabled) {
      activeBusesRef.current = [];
      setBusCount(0);
    }
  }, [enabled]);

  return { busCount, activeBusesRef, loading, loadDay };
}
