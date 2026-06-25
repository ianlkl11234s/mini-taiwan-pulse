import { useCallback, useEffect, useRef, useState } from "react";
import type { Ship } from "../types";
import { fetchShipDates, fetchShipDayArrow, loadShipsWithDates } from "../data/shipLoader";
import type { ShipDateInfo } from "../data/shipLoader";

/** LRU 快取上限（天數） */
const CACHE_MAX = 7;

interface CachedDay {
  ships: Ship[];
  timeRange: { start: number; end: number };
  accessedAt: number;
}

interface UseShipDataReturn {
  ships: Ship[];
  timeRange: { start: number; end: number };
  loading: boolean;
  dayLoading: boolean;
  availableDates: ShipDateInfo[];
  /** 前景載入（切換活躍日，顯示 overlay） */
  loadDay: (date: Date) => void;
  /** 背景預載（只寫快取，不影響當前顯示） */
  prefetch: (date: Date) => void;
  activeDate: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function useShipData(enabled: boolean): UseShipDataReturn {
  const [ships, setShips] = useState<Ship[]>([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(enabled);  // boot lazy：關閉時初始即非 loading
  const [dayLoading, setDayLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<ShipDateInfo[]>([]);
  const [activeDate, setActiveDate] = useState("");
  const availableDatesRef = useRef<ShipDateInfo[]>([]);
  const activeDateRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const apiAvailable = useRef(false);
  const fetchingRef = useRef<string>("");
  const prefetchingRef = useRef<Set<string>>(new Set());

  // LRU 快取
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());

  /** 寫入快取 + LRU 清理 */
  const writeCache = useCallback((dateStr: string, ships: Ship[], tr: { start: number; end: number }) => {
    const cache = cacheRef.current;
    cache.set(dateStr, { ships, timeRange: tr, accessedAt: Date.now() });
    if (cache.size > CACHE_MAX) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of cache) {
        if (v.accessedAt < oldestTime) { oldestTime = v.accessedAt; oldestKey = k; }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
  }, []);

  /** 檢查日期是否在可用清單中 */
  const isDateAvailable = useCallback((dateStr: string) => {
    if (availableDatesRef.current.length === 0) return true;
    return availableDatesRef.current.some(d => d.date === dateStr);
  }, []);

  /** 前景載入：切換活躍日，abort 前一次，設定 state + overlay */
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

    // 不再阻擋前景載入（materialized view 可能延遲，直接讓 RPC 決定）

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
        writeCache(dateStr, data.ships, tr);
        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setShips(data.ships);
        setTimeRange(tr);
        console.log(`[Ship] Loaded ${data.ships.length} ships for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[Ship] Failed to load ${dateStr}:`, err);
        // 清除舊日期資料，避免顯示錯誤日期的船舶
        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setShips([]);
        setTimeRange({ start: 0, end: 0 });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDayLoading(false);
          fetchingRef.current = "";
        }
      });
  }, [writeCache]);

  /** 背景預載：只寫快取，不 abort 前景、不設 state */
  const prefetchDate = useCallback((dateStr: string) => {
    if (cacheRef.current.has(dateStr)) return;
    if (prefetchingRef.current.has(dateStr)) return;
    if (fetchingRef.current === dateStr) return;
    if (!isDateAvailable(dateStr)) return;

    prefetchingRef.current.add(dateStr);
    const t0 = performance.now();

    fetchShipDayArrow(dateStr)
      .then((data) => {
        const tr = { start: data.metadata.time_range[0], end: data.metadata.time_range[1] };
        writeCache(dateStr, data.ships, tr);
        console.log(`[Ship] Prefetched ${data.ships.length} ships for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        console.warn(`[Ship] Prefetch failed ${dateStr}:`, err);
      })
      .finally(() => {
        prefetchingRef.current.delete(dateStr);
      });
  }, [writeCache, isDateAvailable]);

  // ── 初始載入 ──
  useEffect(() => {
    if (!enabled) return;  // boot lazy：圖層關閉不抓
    let cancelled = false;
    setLoading(true);

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
        cacheRef.current.set(dateStr, { ships: data.ships, timeRange: tr, accessedAt: Date.now() });

        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setShips(data.ships);
        setTimeRange(tr);
        console.log(`[Ship] Initial: ${data.ships.length} ships, date=${dateStr}`);
      } catch (err) {
        if (cancelled) return;
        console.warn("[Ship] Failed to load ship data:", err);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  const loadDay = useCallback((date: Date) => {
    if (!apiAvailable.current) return;
    loadDateData(formatDate(date));
  }, [loadDateData]);

  const prefetch = useCallback((date: Date) => {
    if (!apiAvailable.current) return;
    prefetchDate(formatDate(date));
  }, [prefetchDate]);

  return { ships, timeRange, loading, dayLoading, availableDates, loadDay, prefetch, activeDate };
}
