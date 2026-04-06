import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { YoubikeH3CellData, YoubikeH3DataSet } from "../data/youbikeH3Loader";
import { loadYoubikeH3 } from "../data/youbikeH3Loader";
import { isSupabase, todayTaiwan } from "../lib/supabase";

/**
 * Convert unix timestamp to snapshot key like "2026-03-28T08:15"
 * using Asia/Taipei timezone (UTC+8), floored to 15-min intervals.
 */
function unixToSnapshotKey(unixSec: number): string {
  const d = new Date((unixSec + 8 * 3600) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(Math.floor(d.getUTCMinutes() / 15) * 15).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Extract date part "YYYY-MM-DD" from unix timestamp (Asia/Taipei) */
function unixToDateStr(unixSec: number): string {
  const d = new Date((unixSec + 8 * 3600) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useYoubikeH3(visible: boolean, resolution: number) {
  // key = "res7:2026-04-03" or "res7:local"
  const [dataMap, setDataMap] = useState<Map<string, YoubikeH3DataSet>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());

  // Supabase 模式下追蹤目前所需日期
  const [currentDate, setCurrentDate] = useState<string | undefined>(undefined);

  // 在 Supabase 模式下，初始化為今天
  useEffect(() => {
    if (isSupabase() && !currentDate) {
      setCurrentDate(todayTaiwan());
    }
  }, [currentDate]);

  const dataKey = isSupabase()
    ? `res${resolution}:${currentDate ?? todayTaiwan()}`
    : `res${resolution}:local`;

  // 載入指定解析度（+ 日期）的資料
  useEffect(() => {
    if (!visible) return;
    if (dataMap.has(dataKey) || loadingRef.current.has(dataKey)) return;

    loadingRef.current.add(dataKey);
    const date = isSupabase() ? (currentDate ?? todayTaiwan()) : undefined;

    loadYoubikeH3(resolution, date).then((d) => {
      loadingRef.current.delete(dataKey);
      if (d.metadata.cell_count > 0) {
        setDataMap((prev) => {
          const next = new Map(prev);
          next.set(dataKey, d);
          return next;
        });
      }
    });
  }, [visible, resolution, dataKey, currentDate, dataMap]);

  const data = dataMap.get(dataKey) ?? null;

  const timeKeys = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.snapshots).sort();
  }, [data]);

  const getCellsForTime = useCallback((unixSec: number): YoubikeH3CellData[] => {
    if (!data || timeKeys.length === 0) return [];

    // Supabase 模式：如果 timestamp 對應不同日期，觸發載入
    if (isSupabase()) {
      const dateStr = unixToDateStr(unixSec);
      if (dateStr !== currentDate) {
        setCurrentDate(dateStr);
      }
    }

    const key = unixToSnapshotKey(unixSec);
    if (data.snapshots[key]) return data.snapshots[key];
    let closest = timeKeys[0]!;
    for (const k of timeKeys) {
      if (k <= key) closest = k;
      else break;
    }
    return data.snapshots[closest] ?? [];
  }, [data, timeKeys, currentDate]);

  return { data, getCellsForTime, timeKeys };
}
