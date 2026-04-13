import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { YoubikeH3CellData, YoubikeH3DataSet } from "../data/youbikeH3Loader";
import { loadYoubikeH3 } from "../data/youbikeH3Loader";
import { todayTaiwan } from "../lib/supabase";

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

/** Snapshot key "2026-04-13T08:15" → unix seconds (Asia/Taipei → UTC) */
function snapshotKeyToUnix(key: string): number {
  // key = "YYYY-MM-DDTHH:MM" in Asia/Taipei
  const [datePart, timePart] = key.split("T");
  const [y, m, d] = datePart!.split("-").map(Number);
  const [h, min] = timePart!.split(":").map(Number);
  // 建 UTC Date 再減 8 小時（Asia/Taipei = UTC+8）
  const utcMs = Date.UTC(y!, m! - 1, d!, h!, min!) - 8 * 3600 * 1000;
  return utcMs / 1000;
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
  const [dataMap, setDataMap] = useState<Map<string, YoubikeH3DataSet>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState<string>(todayTaiwan());

  const dataKey = `res${resolution}:${currentDate}`;

  // 載入指定解析度 + 日期的資料
  useEffect(() => {
    if (!visible) return;
    if (dataMap.has(dataKey) || loadingRef.current.has(dataKey)) return;

    loadingRef.current.add(dataKey);

    loadYoubikeH3(resolution, currentDate).then((d) => {
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

  // 快取 hiMap，避免每次 lerp 都重建
  const hiMapCache = useRef<{ loIdx: number; hiIdx: number; map: Map<string, YoubikeH3CellData> }>({ loIdx: -1, hiIdx: -1, map: new Map() });

  const getCellsForTime = useCallback((unixSec: number): YoubikeH3CellData[] => {
    if (!data || timeKeys.length === 0) return [];

    // 如果 timestamp 對應不同日期，觸發載入該日資料
    const dateStr = unixToDateStr(unixSec);
    if (dateStr !== currentDate) {
      setCurrentDate(dateStr);
    }

    // 找到前後兩個快照做插值
    const key = unixToSnapshotKey(unixSec);
    let loIdx = 0;
    for (let i = 0; i < timeKeys.length; i++) {
      if (timeKeys[i]! <= key) loIdx = i;
      else break;
    }
    const hiIdx = Math.min(loIdx + 1, timeKeys.length - 1);
    const loCells = data.snapshots[timeKeys[loIdx]!];
    const hiCells = data.snapshots[timeKeys[hiIdx]!];

    if (!loCells) return [];
    if (loIdx === hiIdx || !hiCells) return loCells;

    // 計算 t ∈ [0,1]
    const loUnix = snapshotKeyToUnix(timeKeys[loIdx]!);
    const hiUnix = snapshotKeyToUnix(timeKeys[hiIdx]!);
    const span = hiUnix - loUnix;
    const t = span > 0 ? Math.max(0, Math.min(1, (unixSec - loUnix) / span)) : 0;

    if (t < 0.01) return loCells;
    if (t > 0.99) return hiCells;

    // 快取 hiMap（只在 loIdx/hiIdx 改變時重建）
    const cache = hiMapCache.current;
    if (cache.loIdx !== loIdx || cache.hiIdx !== hiIdx) {
      cache.map.clear();
      for (const c of hiCells) cache.map.set(c.h, c);
      cache.loIdx = loIdx;
      cache.hiIdx = hiIdx;
    }

    // lerp 每個 cell 的 fr 和 sc
    return loCells.map((lo) => {
      const hi = cache.map.get(lo.h);
      if (!hi) return lo;
      return {
        h: lo.h,
        fr: lo.fr + (hi.fr - lo.fr) * t,
        sc: lo.sc + (hi.sc - lo.sc) * t,
      };
    });
  }, [data, timeKeys, currentDate]);

  return { data, getCellsForTime, timeKeys };
}
