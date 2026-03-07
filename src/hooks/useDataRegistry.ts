import { useCallback, useMemo, useRef, useState } from "react";
import type { DataSourceMeta, TimeRange } from "../types";

/** 時間軸上的一段有資料的區間 + 哪些資料源涵蓋 */
export interface TimelineSegment {
  start: number;
  end: number;
  sources: string[];
}

export interface DataRegistry {
  /** 所有已註冊的資料源 */
  sources: Map<string, DataSourceMeta>;
  /** 註冊或更新一個資料源的時間資訊 */
  register: (meta: DataSourceMeta) => void;
  /** 計算所有 enabled 資料源的時間軸聯集範圍 */
  getTimelineRange: (enabledIds: string[]) => TimeRange;
  /** 取得各資料源在時間軸上的分佈（用於密度條繪製） */
  getSegments: (enabledIds: string[]) => TimelineSegment[];
  /** 取得特定資料源的元資料 */
  getSource: (id: string) => DataSourceMeta | undefined;
  /** 取得特定資料源的時間範圍摘要文字 */
  getTimeLabel: (id: string) => string;
  /** 判斷某資料源在指定日期是否有資料 */
  hasDataOnDate: (id: string, date: Date) => boolean;
}

function mergeTimeRanges(ranges: TimeRange[]): TimeRange {
  if (ranges.length === 0) return { start: 0, end: 0 };
  const finite = ranges.filter((r) => isFinite(r.start) && isFinite(r.end));
  if (finite.length === 0) return { start: 0, end: 0 };
  return {
    start: Math.min(...finite.map((r) => r.start)),
    end: Math.max(...finite.map((r) => r.end)),
  };
}

function formatTimeLabel(meta: DataSourceMeta): string {
  if (meta.timeType === "static") return "";
  if (meta.timeType === "cyclic") return "daily";
  if (meta.supportsLive && meta.timeRanges.length === 0) return "live";

  const range = mergeTimeRanges(meta.timeRanges);
  if (range.start === 0 && range.end === 0) return "";

  const fmt = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const now = Date.now() / 1000;
  const endLabel = meta.supportsLive || Math.abs(range.end - now) < 3600
    ? "now"
    : fmt(range.end);

  return `${fmt(range.start)}-${endLabel}`;
}

export function useDataRegistry(): DataRegistry {
  const [version, setVersion] = useState(0);
  const sourcesRef = useRef(new Map<string, DataSourceMeta>());

  const register = useCallback((meta: DataSourceMeta) => {
    sourcesRef.current.set(meta.id, meta);
    setVersion((v) => v + 1);
  }, []);

  const getSource = useCallback((id: string) => {
    return sourcesRef.current.get(id);
  }, []);

  const getTimelineRange = useCallback((enabledIds: string[]): TimeRange => {
    const allRanges: TimeRange[] = [];
    for (const id of enabledIds) {
      const src = sourcesRef.current.get(id);
      if (!src) continue;
      // cyclic 和 static 不影響時間軸範圍
      if (src.timeType === "cyclic" || src.timeType === "static") continue;
      allRanges.push(...src.timeRanges);
    }
    return mergeTimeRanges(allRanges);
  }, []);

  const getSegments = useCallback((enabledIds: string[]): TimelineSegment[] => {
    const segments: TimelineSegment[] = [];
    for (const id of enabledIds) {
      const src = sourcesRef.current.get(id);
      if (!src || src.timeType === "cyclic" || src.timeType === "static") continue;
      for (const range of src.timeRanges) {
        if (!isFinite(range.start) || !isFinite(range.end)) continue;
        segments.push({ start: range.start, end: range.end, sources: [id] });
      }
    }
    return segments.sort((a, b) => a.start - b.start);
  }, []);

  const getTimeLabel = useCallback((id: string): string => {
    const src = sourcesRef.current.get(id);
    if (!src) return "";
    return formatTimeLabel(src);
  }, []);

  const hasDataOnDate = useCallback((id: string, date: Date): boolean => {
    const src = sourcesRef.current.get(id);
    if (!src) return false;
    if (src.timeType === "cyclic") return true;
    if (src.timeType === "static") return true;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).getTime() / 1000;
    const dayEnd = dayStart + 86400;
    return src.timeRanges.some((r) => r.start < dayEnd && r.end > dayStart);
  }, []);

  // useMemo with version to force consumers to re-render on register
  const sources = useMemo(() => {
    void version;
    return new Map(sourcesRef.current);
  }, [version]);

  return { sources, register, getTimelineRange, getSegments, getSource, getTimeLabel, hasDataOnDate };
}
