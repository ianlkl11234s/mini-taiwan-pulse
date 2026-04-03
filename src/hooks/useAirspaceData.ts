/**
 * OpenSky 空域快照 hook — 類似 useShipData，支援逐日切換
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Flight } from "../types";
import {
  fetchAirspaceDates,
  fetchAirspaceDayArrow,
  loadAirspaceWithDates,
} from "../data/airspaceLoader";
import type { AirspaceDateInfo } from "../data/airspaceLoader";

interface UseAirspaceDataReturn {
  flights: Flight[];
  timeRange: { start: number; end: number };
  /** 初始載入中 */
  loading: boolean;
  /** 日期切換中 */
  dayLoading: boolean;
  /** 所有可用日期 */
  availableDates: AirspaceDateInfo[];
  /** 切換日期載入 */
  loadDay: (date: Date) => void;
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
  const availableDatesRef = useRef<AirspaceDateInfo[]>([]);
  const loadedDateRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const apiAvailable = useRef(false);

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
        setFlights(data.flights);
        setTimeRange({ start: data.metadata.time_range[0], end: data.metadata.time_range[1] });
        loadedDateRef.current = data.metadata.date;
        console.log(
          `[Airspace] Initial load: ${data.flights.length} aircraft, ` +
          `date=${data.metadata.date}, ` +
          `available=${dates.length} days (${dates[0]?.date} ~ ${dates[dates.length - 1]?.date})`
        );
      } catch (err) {
        if (!cancelled) console.warn("[Airspace] Pulse API unavailable:", err);
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

    // 跳過沒有資料的日期
    if (availableDatesRef.current.length > 0 &&
        !availableDatesRef.current.some(d => d.date === dateStr)) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDayLoading(true);
    const t0 = performance.now();

    fetchAirspaceDayArrow(dateStr)
      .then((data) => {
        if (controller.signal.aborted) return;
        setFlights(data.flights);
        setTimeRange({ start: data.metadata.time_range[0], end: data.metadata.time_range[1] });
        loadedDateRef.current = dateStr;
        console.log(`[Airspace] Loaded ${data.flights.length} aircraft for ${dateStr} in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn(`[Airspace] Failed to load ${dateStr}:`, err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDayLoading(false);
      });
  }, []);

  return { flights, timeRange, loading, dayLoading, availableDates, loadDay };
}
