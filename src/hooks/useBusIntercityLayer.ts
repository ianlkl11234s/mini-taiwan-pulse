/**
 * 公路客運 (InterCity) 圖層 hook — Live + Replay
 *
 * 架構完全沿用 useBusLayer，差異：
 *   - 無 cities 切換參數（全國單一資料源）
 *   - Loader 用 loadBusIntercityRoutes / fetchBusIntercityCurrent / fetchBusIntercityTrails
 *   - Engine 內部用 "Intercity" 虛擬 city key 管理路線
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusVehicle, BusTrail, TimeMode } from "../types";
import { BusEngine } from "../engines/BusEngine";
import {
  loadBusIntercityRoutes,
  fetchBusIntercityCurrent,
  fetchBusIntercityTrails,
} from "../data/busLoader";
import { timeStore } from "../state/timeStore";
import { liveCountStore } from "../state/liveCountStore";
import { requestThreeRepaint } from "../state/threeRepaintSignal";

const POLL_INTERVAL = 30_000;
const MAX_CACHED_DAYS = 3;
const CITY_KEY = "Intercity";

interface CachedDay {
  date: string;
  trails: BusTrail[];
}

export function useBusIntercityLayer(
  enabled: boolean,
  timeMode: TimeMode,
) {
  const engineRef = useRef<BusEngine | null>(null);
  const activeBusesRef = useRef<BusVehicle[]>([]);
  /** 非 tick 灌入資料後立即重算一次位置並叫醒 3D —— 暫停中載入完成也看得到（PF-9） */
  const refreshActiveBuses = () => {
    if (!engineRef.current) return;
    activeBusesRef.current = engineRef.current.update(timeStore.getTime());
    requestThreeRepaint();
  };
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

    loadBusIntercityRoutes()
      .then((data) => {
        if (!cancelled) engine.addCityRoutes(CITY_KEY, data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[BusIntercity] Failed to load routes:", err);
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
        const positions = await fetchBusIntercityCurrent();
        if (!cancelled && engineRef.current) {
          engineRef.current.ingestPoll(positions, Date.now() / 1000);
          refreshActiveBuses();
          console.log(`[BusIntercity] Poll: ${positions.length} vehicles`);
        }
      } catch (err) {
        console.warn("[BusIntercity] Poll error:", err);
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
      refreshActiveBuses();
      return;
    }

    fetchingDayRef.current = dateStr;
    try {
      const trails = await fetchBusIntercityTrails(dateStr);
      if (trails.length === 0) {
        console.log(`[BusIntercity] No trail data for ${dateStr}`);
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
      refreshActiveBuses();
    } catch (err) {
      console.warn("[BusIntercity] loadDay error:", err);
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
        liveCountStore.set("busesIntercity", activeBusesRef.current.length);
      }
    };

    update(timeStore.getTime()); // 初始化
    requestThreeRepaint(); // 非 tick 換了資料 ref（PF-9）
    return timeStore.subscribe(update);
  }, [enabled, engineRef.current !== null]);

  useEffect(() => {
    if (!enabled) {
      activeBusesRef.current = [];
      liveCountStore.set("busesIntercity", 0);
      requestThreeRepaint();
    }
  }, [enabled]);

  return { activeBusesRef, loading, loadDay };
}
