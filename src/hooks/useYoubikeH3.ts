import { useCallback, useEffect, useMemo, useState } from "react";
import type { YoubikeH3CellData, YoubikeH3DataSet } from "../data/youbikeH3Loader";
import { loadYoubikeH3 } from "../data/youbikeH3Loader";

/**
 * Convert unix timestamp to snapshot key like "2026-03-28T08:15"
 * using Asia/Taipei timezone (UTC+8), floored to 15-min intervals.
 */
function unixToSnapshotKey(unixSec: number): string {
  // UTC+8
  const d = new Date((unixSec + 8 * 3600) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(Math.floor(d.getUTCMinutes() / 15) * 15).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function useYoubikeH3(visible: boolean) {
  const [data, setData] = useState<YoubikeH3DataSet | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || data) return;
    setLoading(true);
    loadYoubikeH3().then((d) => {
      if (d.metadata.cell_count > 0) setData(d);
      setLoading(false);
    });
  }, [visible, data]);

  const timeKeys = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.snapshots).sort();
  }, [data]);

  /**
   * Get cells for a given unix timestamp.
   * Finds the closest hourly snapshot key.
   */
  const getCellsForTime = useCallback((unixSec: number): YoubikeH3CellData[] => {
    if (!data || timeKeys.length === 0) return [];
    const key = unixToSnapshotKey(unixSec);
    // Exact match first
    if (data.snapshots[key]) return data.snapshots[key];
    // Find closest key
    let closest = timeKeys[0]!;
    for (const k of timeKeys) {
      if (k <= key) closest = k;
      else break;
    }
    return data.snapshots[closest] ?? [];
  }, [data, timeKeys]);

  /**
   * Get the current snapshot key label for a unix timestamp.
   */
  const getTimeLabel = useCallback((unixSec: number): string => {
    const key = unixToSnapshotKey(unixSec);
    // "2026-03-28T08:00" → "03/28 08:00"
    return key.slice(5, 7) + "/" + key.slice(8, 10) + " " + key.slice(11, 16);
  }, []);

  return { data, loading, getCellsForTime, getTimeLabel, timeKeys };
}
