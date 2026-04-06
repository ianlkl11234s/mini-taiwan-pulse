/**
 * OpenSky 空域快照 hook — LRU 快取 + 前景/背景載入
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Flight } from "../types";
import {
  fetchAirspaceDates,
  fetchAirspaceDayArrow,
  loadAirspaceWithDates,
} from "../data/airspaceLoader";
import type { AirspaceDateInfo } from "../data/airspaceLoader";

/** LRU 快取上限（天數） */
const CACHE_MAX = 7;

interface CachedDay {
  flights: Flight[];
  timeRange: { start: number; end: number };
  accessedAt: number;
}

interface UseAirspaceDataReturn {
  flights: Flight[];
  timeRange: { start: number; end: number };
  loading: boolean;
  dayLoading: boolean;
  availableDates: AirspaceDateInfo[];
  /** 前景載入（切換活躍日，顯示 overlay） */
  loadDay: (date: Date) => void;
  /** 背景預載（只寫快取，不影響當前顯示） */
  prefetch: (date: Date) => void;
  activeDate: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

export function useAirspaceData(): UseAirspaceDataReturn {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 0 });
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<AirspaceDateInfo[]>([]);
  const [activeDate, setActiveDate] = useState("");
  const availableDatesRef = useRef<AirspaceDateInfo[]>([]);
  const activeDateRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const apiAvailable = useRef(false);
  const fetchingRef = useRef<string>("");
  const prefetchingRef = useRef<Set<string>>(new Set());

  // LRU 快取
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());

  /** 寫入快取 + LRU 清理 */
  const writeCache = useCallback((dateStr: string, flights: Flight[], tr: { start: number; end: number }) => {
    const cache = cacheRef.current;
    cache.set(dateStr, { flights, timeRange: tr, accessedAt: Date.now() });
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

  /** 前景載入 */
  const loadDateData = useCallback((dateStr: string) => {
    if (dateStr === activeDateRef.current) return;
    if (dateStr === fetchingRef.current) return;

    const cached = cacheRef.current.get(dateStr);
    if (cached) {
      cached.accessedAt = Date.now();
      activeDateRef.current = dateStr;
      setActiveDate(dateStr);
      setFlights(cached.flights);
      setTimeRange(cached.timeRange);
      console.log(`[Airspace] Cache hit: ${dateStr} (${cached.flights.length} flights)`);
      return;
    }

    if (!isDateAvailable(dateStr)) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = dateStr;
    setDayLoading(true);
    const t0 = performance.now();

    fetchAirspaceDayArrow(dateStr)
      .then((data) => {
        if (controller.signal.aborted) return;
        const tr = { start: data.metadata.time_range[0], end: data.metadata.time_range[1] };
        writeCache(dateStr, data.flights, tr);
        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setFlights(data.flights);
        setTimeRange(tr);
        console.log(`[Airspace] Loaded ${data.flights.length} flights for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[Airspace] Failed to load ${dateStr}:`, err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDayLoading(false);
          fetchingRef.current = "";
        }
      });
  }, [writeCache, isDateAvailable]);

  /** 背景預載：只寫快取 */
  const prefetchDate = useCallback((dateStr: string) => {
    if (cacheRef.current.has(dateStr)) return;
    if (prefetchingRef.current.has(dateStr)) return;
    if (fetchingRef.current === dateStr) return;
    if (!isDateAvailable(dateStr)) return;

    prefetchingRef.current.add(dateStr);
    const t0 = performance.now();

    fetchAirspaceDayArrow(dateStr)
      .then((data) => {
        const tr = { start: data.metadata.time_range[0], end: data.metadata.time_range[1] };
        writeCache(dateStr, data.flights, tr);
        console.log(`[Airspace] Prefetched ${data.flights.length} flights for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        console.warn(`[Airspace] Prefetch failed ${dateStr}:`, err);
      })
      .finally(() => {
        prefetchingRef.current.delete(dateStr);
      });
  }, [writeCache, isDateAvailable]);

  // ── 初始載入 ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const dates = await fetchAirspaceDates();
        if (cancelled) return;
        setAvailableDates(dates);
        availableDatesRef.current = dates;

        const data = await loadAirspaceWithDates(dates);
        if (cancelled) return;
        apiAvailable.current = true;

        const dateStr = data.metadata.date;
        const tr = { start: data.metadata.time_range[0], end: data.metadata.time_range[1] };
        cacheRef.current.set(dateStr, { flights: data.flights, timeRange: tr, accessedAt: Date.now() });

        activeDateRef.current = dateStr;
        setActiveDate(dateStr);
        setFlights(data.flights);
        setTimeRange(tr);
        console.log(
          `[Airspace] Initial: ${data.flights.length} aircraft, date=${dateStr}, ` +
          `available=${dates.length} days (${dates[0]?.date} ~ ${dates[dates.length - 1]?.date})`
        );
      } catch (err) {
        if (!cancelled) console.warn("[Airspace] Pulse API unavailable:", err);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const loadDay = useCallback((date: Date) => {
    if (!apiAvailable.current) return;
    loadDateData(formatDate(date));
  }, [loadDateData]);

  const prefetch = useCallback((date: Date) => {
    if (!apiAvailable.current) return;
    prefetchDate(formatDate(date));
  }, [prefetchDate]);

  return { flights, timeRange, loading, dayLoading, availableDates, loadDay, prefetch, activeDate };
}
