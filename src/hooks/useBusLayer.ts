/**
 * 公車即時圖層 hook — 管理路線載入、GPS polling、per-frame 插值
 */

import { useEffect, useRef, useState } from "react";
import type { BusVehicle, BusRouteData } from "../types";
import { BusEngine } from "../engines/BusEngine";
import { loadBusRoutes, fetchBusCurrent } from "../data/busLoader";

/** Supabase polling 間隔 (ms) */
const POLL_INTERVAL = 30_000;

export function useBusLayer(enabled: boolean) {
  const routeDataRef = useRef<BusRouteData | null>(null);
  const engineRef = useRef<BusEngine | null>(null);
  const activeBusesRef = useRef<BusVehicle[]>([]);
  const [busCount, setBusCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 載入靜態路線（lazy，首次啟用時）
  useEffect(() => {
    if (!enabled) return;
    if (routeDataRef.current) return; // 已載入

    let cancelled = false;
    setLoading(true);

    loadBusRoutes()
      .then((data) => {
        if (cancelled) return;
        routeDataRef.current = data;
        engineRef.current = new BusEngine(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Bus] Failed to load routes:", err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled]);

  // Polling bus_current
  useEffect(() => {
    if (!enabled || !engineRef.current) return;

    let isFetching = false;
    let cancelled = false;

    const poll = async () => {
      if (isFetching || cancelled) return;
      isFetching = true;
      try {
        const positions = await fetchBusCurrent();
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

    // 首次立即 poll
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, engineRef.current !== null]);

  // Per-frame animation loop
  // 公車即時模式永遠用真實時間（不受 timeline replay 影響）
  useEffect(() => {
    if (!enabled || !engineRef.current) return;

    let animId: number;
    let lastCountUpdate = 0;

    const tick = () => {
      const now = Date.now() / 1000; // 永遠用真實時間
      if (engineRef.current) {
        activeBusesRef.current = engineRef.current.update(now);
      }

      // 每 500ms 更新 UI 計數
      const ts = performance.now();
      if (ts - lastCountUpdate > 500) {
        lastCountUpdate = ts;
        setBusCount(activeBusesRef.current.length);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [enabled, engineRef.current !== null]);

  // 停用時清空
  useEffect(() => {
    if (!enabled) {
      activeBusesRef.current = [];
      setBusCount(0);
    }
  }, [enabled]);

  return { busCount, activeBusesRef, loading };
}
