/**
 * useRailData — 軌道資料載入 Hook
 *
 * 靜態資料（軌道幾何、車站、stationProgress）只載入一次。
 * 時刻表可依 selectedDate 從 Supabase 動態切換（TRA / THSR）。
 *
 * 參考 mini-taipei-v3 的 useTraData.ts 模式。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RailData, RailSchedule, TraData, TraSchedule, TraDeparture, RailStationTime } from "../types";
import { loadAllRail } from "../data/railLoader";
import {
  fetchSupabaseDates,
  fetchTraDailySchedule,
  fetchThsrDailySchedule,
} from "../data/railScheduleLoader";

interface UseRailDataReturn {
  railData: RailData | null;
  loading: boolean;
  scheduleLoading: boolean;
  scheduleDate: string | null;
  availableDates: string[];
}

/** 解析 TRA master_schedule 格式為 TraSchedule Map */
function parseTraSchedules(masterData: { schedules?: unknown[] }): Map<string, TraSchedule> {
  const map = new Map<string, TraSchedule>();
  if (!masterData?.schedules) return map;

  const byTrack = new Map<string, TraDeparture[]>();
  for (const train of masterData.schedules as any[]) {
    const trackId = train.od_track_id;
    if (!trackId) continue;
    if (!byTrack.has(trackId)) byTrack.set(trackId, []);
    byTrack.get(trackId)!.push({
      departure_time: train.departure_time,
      train_id: train.train_id,
      train_no: train.train_no,
      train_type: train.train_type,
      train_type_code: train.train_type_code,
      total_travel_time: train.total_travel_time,
      origin_station: train.origin_station || "",
      destination_station: train.destination_station || "",
      od_track_id: trackId,
      stations: train.stations as RailStationTime[],
    });
  }

  for (const [trackId, departures] of byTrack) {
    map.set(trackId, { departures });
  }
  return map;
}

/** 解析 THSR 格式為 RailSchedule Map */
function parseThsrSchedules(data: Record<string, unknown>): Map<string, RailSchedule> {
  const map = new Map<string, RailSchedule>();
  for (const [trackId, schedule] of Object.entries(data)) {
    map.set(trackId, schedule as RailSchedule);
  }
  return map;
}

export function useRailData(selectedDate?: string): UseRailDataReturn {
  const [railData, setRailData] = useState<RailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // 保存初始（預設）時刻表，供 fallback
  const defaultTraSchedulesRef = useRef<Map<string, TraSchedule> | null>(null);
  const defaultThsrSchedulesRef = useRef<Map<string, RailSchedule> | null>(null);
  const railDataRef = useRef<RailData | null>(null);

  // ── 初始載入：靜態資料 + 預設時刻表 + 可用日期 ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await loadAllRail();
        if (cancelled) return;

        // 保存預設時刻表
        if (data.traData) {
          defaultTraSchedulesRef.current = new Map(data.traData.schedules);
        }
        const thsrSys = data.systems.find((s) => s.id === "thsr");
        if (thsrSys) {
          defaultThsrSchedulesRef.current = new Map(thsrSys.schedules);
        }

        railDataRef.current = data;
        setRailData(data);

        // 查詢可用日期（背景，不阻塞）
        fetchSupabaseDates("tra", 30).then((dates) => {
          if (!cancelled && dates.length > 0) {
            setAvailableDates(dates);
            console.log(`[Rail] Available TRA dates: ${dates.length} days (${dates[0]} ~ ${dates[dates.length - 1]})`);
          }
        });
      } catch (err) {
        if (!cancelled) console.warn("Rail data not available:", err);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // ── 日期切換：只重載時刻表（TRA + THSR） ──
  const loadScheduleForDate = useCallback(async (date: string) => {
    const data = railDataRef.current;
    if (!data) return;

    setScheduleLoading(true);
    const t0 = performance.now();

    try {
      // 平行載入 TRA + THSR
      const [traResult, thsrResult] = await Promise.all([
        fetchTraDailySchedule(date),
        fetchThsrDailySchedule(date),
      ]);

      // TRA
      let traSchedules: Map<string, TraSchedule>;
      if (traResult) {
        traSchedules = parseTraSchedules(traResult);
        console.log(`[Rail] TRA daily: ${traSchedules.size} tracks, ${date}`);
      } else {
        traSchedules = defaultTraSchedulesRef.current ?? new Map();
        console.log(`[Rail] TRA daily not found for ${date}, using default`);
      }

      // THSR
      let thsrSchedules: Map<string, RailSchedule>;
      if (thsrResult) {
        thsrSchedules = parseThsrSchedules(thsrResult);
        console.log(`[Rail] THSR daily: ${thsrSchedules.size} tracks, ${date}`);
      } else {
        thsrSchedules = defaultThsrSchedulesRef.current ?? new Map();
      }

      // 更新 railData（immutable update）
      const newTraData: TraData | null = data.traData
        ? { ...data.traData, schedules: traSchedules }
        : null;

      const newSystems = data.systems.map((sys) => {
        if (sys.id === "thsr") {
          return { ...sys, schedules: thsrSchedules };
        }
        return sys;
      });

      const newData: RailData = {
        ...data,
        systems: newSystems,
        traData: newTraData,
      };

      railDataRef.current = newData;
      setRailData(newData);
      setScheduleDate(date);
      console.log(`[Rail] Schedule updated for ${date} in ${(performance.now() - t0).toFixed(0)}ms`);
    } catch (err) {
      console.warn(`[Rail] Failed to load schedule for ${date}:`, err);
    }

    setScheduleLoading(false);
  }, []);

  // 當 selectedDate 改變時觸發載入
  const lastDateRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (loading) return;
    if (selectedDate === lastDateRef.current) return;
    lastDateRef.current = selectedDate;

    if (!selectedDate) {
      // 切回預設時刻表
      const data = railDataRef.current;
      if (!data) return;

      const newTraData: TraData | null = data.traData && defaultTraSchedulesRef.current
        ? { ...data.traData, schedules: defaultTraSchedulesRef.current }
        : data.traData;

      const newSystems = data.systems.map((sys) => {
        if (sys.id === "thsr" && defaultThsrSchedulesRef.current) {
          return { ...sys, schedules: defaultThsrSchedulesRef.current };
        }
        return sys;
      });

      const newData: RailData = { ...data, systems: newSystems, traData: newTraData };
      railDataRef.current = newData;
      setRailData(newData);
      setScheduleDate(null);
      return;
    }

    loadScheduleForDate(selectedDate);
  }, [selectedDate, loading, loadScheduleForDate]);

  return { railData, loading, scheduleLoading, scheduleDate, availableDates };
}
