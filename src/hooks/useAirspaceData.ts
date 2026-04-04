/**
 * OpenSky 空域快照 hook — 支援 currentTime 驅動活躍日 + LRU 快取
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
const CACHE_MAX = 5;

interface CachedDay {
  flights: Flight[];
  timeRange: { start: number; end: number };
  accessedAt: number;
}

interface UseAirspaceDataReturn {
  flights: Flight[];
  timeRange: { start: number; end: number };
  /** 初始載入中 */
  loading: boolean;
  /** 日期切換中 */
  dayLoading: boolean;
  /** 所有可用日期 */
  availableDates: AirspaceDateInfo[];
  /** 手動切換日期 */
  loadDay: (date: Date) => void;
  /** 當前活躍日 */
  activeDate: string;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  // LRU 快取
  const cacheRef = useRef<Map<string, CachedDay>>(new Map());

  /** 從快取取得或遠端載入 */
  const loadDateData = useCallback((dateStr: string) => {
    if (dateStr === activeDateRef.current) return;
    if (dateStr === fetchingRef.current) return;

    // 快取命中
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

    // 跳過沒有資料的日期
    if (availableDatesRef.current.length > 0 &&
        !availableDatesRef.current.some(d => d.date === dateStr)) {
      return;
    }

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

        // 寫入快取
        const cache = cacheRef.current;
        cache.set(dateStr, { flights: data.flights, timeRange: tr, accessedAt: Date.now() });

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
  }, []);

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

        // 初始資料寫入快取
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

  // ── 切換日期（由 App.tsx 的活躍日追蹤 effect 呼叫） ──
  const loadDay = useCallback((date: Date) => {
    if (!apiAvailable.current) return;
    const dateStr = formatDate(date);
    loadDateData(dateStr);
  }, [loadDateData]);

  return { flights, timeRange, loading, dayLoading, availableDates, loadDay, activeDate };
}
