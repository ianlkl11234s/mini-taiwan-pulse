import { useEffect, useState } from "react";
import type { TimeRange } from "../types";

const API = "/api/v1";

/** calendar API source name → 前端 registry source id */
const SOURCE_MAP: Record<string, string> = {
  ship_ais: "ships",
  flight: "flights",
  temperature: "temperatureWave",
};

interface CalendarEntry {
  date: string;   // "2026-02-18"
  frames: number;
  records: number;
}

export interface CalendarSourceRanges {
  /** 前端 source id → 每日一個 TimeRange */
  [sourceId: string]: TimeRange[];
}

/** 把日期字串轉成當天 00:00~24:00 的 TimeRange (UTC+8) */
function dateToRange(dateStr: string): TimeRange {
  // dateStr = "2026-02-18", 需要轉成 UTC+8 的 unix timestamp
  const [y, m, d] = dateStr.split("-").map(Number);
  // 建立 UTC+8 的 00:00:00
  const dayStart = Date.UTC(y!, m! - 1, d!, 0, 0, 0) / 1000 - 8 * 3600;
  return { start: dayStart, end: dayStart + 86400 };
}

/**
 * 從 Pulse API `/api/v1/calendar` 取得所有資料源的可用日期
 * 回傳 mapping: 前端 sourceId → TimeRange[]
 */
export function useCalendarApi(): { calendarRanges: CalendarSourceRanges; loading: boolean } {
  const [calendarRanges, setCalendarRanges] = useState<CalendarSourceRanges>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/calendar`)
      .then((res) => {
        if (!res.ok) throw new Error(`calendar: ${res.status}`);
        return res.json();
      })
      .then((data: { sources: Record<string, CalendarEntry[]> }) => {
        if (cancelled) return;
        const result: CalendarSourceRanges = {};
        for (const [apiSource, entries] of Object.entries(data.sources)) {
          const frontendId = SOURCE_MAP[apiSource] ?? apiSource;
          result[frontendId] = entries.map((e) => dateToRange(e.date));
        }
        setCalendarRanges(result);
      })
      .catch((err) => {
        if (!cancelled) console.warn("[CalendarApi]", err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { calendarRanges, loading };
}
