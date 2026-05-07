/**
 * 垃圾車圖層 hook — Live trails polling（方案 A）
 *
 * 抓近 60 分鐘軌跡（含後端去噪 + stop snapping），每 60s refresh。
 * 前端 WasteTruckScene 用 timeStore.getTime() 在 trail 上時間插值。
 *
 * 多城市可復用：cities 陣列傳給 RPC。
 *
 * Replay 模式進 Backlog（status.md §2 P3）
 */

import { useEffect, useRef, useState } from "react";
import { fetchWasteTrails, type WasteTrailRow } from "../data/wasteLoader";

/** 載多久軌跡（分鐘） */
const TRAIL_WINDOW_MIN = 60;
/** 重抓間隔（ms） */
const POLL_INTERVAL = 60_000;

export function useWasteLayer(
  enabled: boolean,
  cities: string[] = ["高雄市"],
) {
  const trailsRef = useRef<WasteTrailRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled, cities.join(",")]);

  return { trailsRef, count, loading };
}
