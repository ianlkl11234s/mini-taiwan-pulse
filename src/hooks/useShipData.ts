import { useCallback, useEffect, useRef, useState } from "react";
import type { Ship } from "../types";
import { fetchShipDates, fetchShipDayArrow, loadShipsFromApi, loadShipsLegacy } from "../data/shipLoader";

interface ShipDateInfo {
  date: string;
  frames: number;
  records: number;
}

interface UseShipDataReturn {
  ships: Ship[];
  timeRange: { start: number; end: number };
  /** 初始載入中（給 LoadingScreen 用） */
  loading: boolean;
  /** 日期切換中（給 overlay 用） */
  dayLoading: boolean;
  /** 所有可用日期 */
  availableDates: ShipDateInfo[];
  /** 切換日期載入 */
  loadDay: (date: Date) => void;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useShipData(): UseShipDataReturn {
  const [ships, setShips] = useState<Ship[]>([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<ShipDateInfo[]>([]);
  const loadedDateRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const apiAvailable = useRef(false);

  // ── 初始載入 ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 先取日期清單
        const dates = await fetchShipDates();
        if (cancelled) return;
        setAvailableDates(dates);

        // 取最新一天的船舶資料（Arrow IPC）
        const data = await loadShipsFromApi();
        if (cancelled) return;
        apiAvailable.current = true;
        setShips(data.ships);
        setTimeRange({ start: data.metadata.time_range[0], end: data.metadata.time_range[1] });
        loadedDateRef.current = data.metadata.date ?? "";
        console.log(`[Ship] Loaded ${data.ships.length} ships via Arrow IPC`);
      } catch {
        if (cancelled) return;
        console.warn("[Ship] Pulse API unavailable, falling back to legacy");
        try {
          const data = await loadShipsLegacy();
          if (cancelled) return;
          setShips(data.ships);
          setTimeRange({ start: data.metadata.time_range[0], end: data.metadata.time_range[1] });
          loadedDateRef.current = "legacy";
        } catch (err) {
          console.warn("[Ship] Legacy also failed:", err);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // ── 日期切換 ──
  const loadDay = useCallback((date: Date) => {
    if (!apiAvailable.current) return;

    const dateStr = formatDate(date);
    if (dateStr === loadedDateRef.current) return;

    // 取消前一次
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDayLoading(true);
    const t0 = performance.now();

    fetchShipDayArrow(dateStr)
      .then((data) => {
        if (controller.signal.aborted) return;
        setShips(data.ships);
        setTimeRange({ start: data.metadata.time_range[0], end: data.metadata.time_range[1] });
        loadedDateRef.current = dateStr;
        console.log(`[Ship] Loaded ${data.ships.length} ships for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[Ship] Failed to load ${dateStr}:`, err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDayLoading(false);
      });
  }, []);

  return { ships, timeRange, loading, dayLoading, availableDates, loadDay };
}
