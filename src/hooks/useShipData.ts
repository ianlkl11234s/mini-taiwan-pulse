import { useCallback, useEffect, useRef, useState } from "react";
import type { Ship } from "../types";
import { fetchShipDates, fetchShipDayArrow, loadShipsWithDates, loadShipsLegacy } from "../data/shipLoader";
import type { ShipDateInfo } from "../data/shipLoader";

/** LRU 快取上限（天數） */
const CACHE_MAX = 5;

interface CachedDay {
  ships: Ship[];
  timeRange: { start: number; end: number };
  accessedAt: number;
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
  /** 手動切換日期（相容舊介面） */
  loadDay: (date: Date) => void;
  /** 當前活躍日 */
  activeDate: string;
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
  const [activeDate, setActiveDate] = useState("");
  const availableDatesRef = useRef<ShipDateInfo[]>([]);
  const activeDateRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const apiAvailable = useRef(false);
  const fetchingRef = useRef<string>("");

  // LRU 快取
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());

  /** 從快取取得或遠端載入 */
  const loadDateData = useCallback((dateStr: string) => {
    if (dateStr === activeDateRef.current) return;
    if (dateStr === fetchingRef.current) return;

    // 快取命中 → 直接切換
    const cached = cacheRef.current.get(dateStr);
    if (cached) {
      cached.accessedAt = Date.now();
      activeDateRef.current = dateStr;
      setActiveDate(dateStr);
      setShips(cached.ships);
      setTimeRange(cached.timeRange);
      console.log(`[Ship] Cache hit: ${dateStr} (${cached.ships.length} ships)`);
      return;
    }

    // 跳過沒有資料的日期
    if (availableDatesRef.current.length > 0 &&
        !availableDatesRef.current.some(d => d.date === dateStr)) {
      return;
    }

    // 取消前一次 fetch
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = dateStr;
    setDayLoading(true);
    const t0 = performance.now();

    fetchShipDayArrow(dateStr)
      .then((data) => {
        if (controller.signal.aborted) return;
        const tr = { start: data.metadata.time_range[0], end: data.metadata.time_range[1] };

        // 寫入快取
        const cache = cacheRef.current;
        cache.set(dateStr, { ships: data.ships, timeRange: tr, accessedAt: Date.now() });

        // LRU 清理
        if (cache.size > CACHE_MAX) {
          let oldestKey = "";
          let oldestTime = Infinity;
          for (const [k, v] of cache) {
            if (v.accessedAt < oldestTime) { oldestTime = v.accessedAt; oldestKey = k; }
          }
          if (oldestKey) cache.delete(oldestKey);
        }

        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setShips(data.ships);
        setTimeRange(tr);
        console.log(`[Ship] Loaded ${data.ships.length} ships for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[Ship] Failed to load ${dateStr}:`, err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDayLoading(false);
          fetchingRef.current = "";
        }
      });
  }, []);

  // ── 初始載入 ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dates = await fetchShipDates();
        if (cancelled) return;
        setAvailableDates(dates);
        availableDatesRef.current = dates;

        const data = await loadShipsWithDates(dates);
        if (cancelled) return;
        apiAvailable.current = true;

        const dateStr = data.metadata.date ?? "";
        const tr = { start: data.metadata.time_range[0], end: data.metadata.time_range[1] };

        // 初始資料也寫入快取
        cacheRef.current.set(dateStr, { ships: data.ships, timeRange: tr, accessedAt: Date.now() });

        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setShips(data.ships);
        setTimeRange(tr);
        console.log(`[Ship] Initial: ${data.ships.length} ships, date=${dateStr}`);
      } catch {
        if (cancelled) return;
        console.warn("[Ship] Pulse API unavailable, falling back to legacy");
        try {
          const data = await loadShipsLegacy();
          if (cancelled) return;
          setShips(data.ships);
          setTimeRange({ start: data.metadata.time_range[0], end: data.metadata.time_range[1] });
          activeDateRef.current = "legacy";
          setActiveDate("legacy");
        } catch (err) {
          console.warn("[Ship] Legacy also failed:", err);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // ── 切換日期（由 App.tsx 的活躍日追蹤 effect 呼叫） ──
  const loadDay = useCallback((date: Date) => {
    if (!apiAvailable.current) return;
    const dateStr = formatDate(date);
    loadDateData(dateStr);
  }, [loadDateData]);

  return { ships, timeRange, loading, dayLoading, availableDates, loadDay, activeDate };
}
