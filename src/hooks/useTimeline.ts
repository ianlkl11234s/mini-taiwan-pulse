import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeMode } from "../types";

/** 將 Date 轉為當天 00:00:00 的 unix timestamp（台灣時區） */
function dayStartUnix(d: Date): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  return local.getTime() / 1000;
}

/** 將 Date 轉為當天 23:59:59 的 unix timestamp（台灣時區） */
function dayEndUnix(d: Date): number {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return local.getTime() / 1000;
}

/** 加減天數 */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

interface UseTimelineOptions {
  /** 資料整體範圍（用於 clamp 日期選擇） */
  dataStartTime: number;
  dataEndTime: number;
  timeMode?: TimeMode;
}

interface UseTimelineReturn {
  currentTime: number;
  playing: boolean;
  speed: number;
  progress: number;
  timeMode: TimeMode;
  /** 目前選定的日期 */
  selectedDate: Date;
  /** 目前視窗天數（1 = 單日, >1 = 多日） */
  rangeDays: number;
  /** 視窗起始 unix timestamp */
  windowStart: number;
  /** 視窗結束 unix timestamp */
  windowEnd: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  seek: (time: number) => void;
  seekByProgress: (p: number) => void;
  setTimeMode: (mode: TimeMode) => void;
  /** 切換日期（絕對） */
  setSelectedDate: (d: Date) => void;
  /** 日期前後移動 */
  shiftDate: (days: number) => void;
  /** 設定視窗天數 */
  setRangeDays: (n: number) => void;
}

export function useTimeline({
  dataStartTime,
  dataEndTime,
  timeMode: initialTimeMode = "replay",
}: UseTimelineOptions): UseTimelineReturn {
  // dataStartTime 用於未來日期 clamp，目前保留
  void dataStartTime;

  // 預設選定日期 = 資料最後一天（或今天）
  const [selectedDate, setSelectedDateRaw] = useState<Date>(() => {
    if (dataEndTime > 0) return new Date(dataEndTime * 1000);
    return new Date();
  });
  const [rangeDays, setRangeDays] = useState(1);

  // 視窗起止
  const windowStart = dayStartUnix(selectedDate);
  const windowEnd = dayEndUnix(addDays(selectedDate, rangeDays - 1));

  const [currentTime, setCurrentTime] = useState(windowStart);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [timeMode, setTimeMode] = useState<TimeMode>(initialTimeMode);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const duration = windowEnd - windowStart;
  const progress = duration > 0 ? (currentTime - windowStart) / duration : 0;

  // 日期切換時重置 currentTime
  const setSelectedDate = useCallback((d: Date) => {
    setSelectedDateRaw(d);
    setCurrentTime(dayStartUnix(d));
    setPlaying(false);
  }, []);

  const shiftDate = useCallback((days: number) => {
    setSelectedDateRaw((prev) => {
      const next = addDays(prev, days);
      setCurrentTime(dayStartUnix(next));
      setPlaying(false);
      return next;
    });
  }, []);

  // 當 dataEndTime 首次載入（從 0 變成有效值），更新 selectedDate
  useEffect(() => {
    if (dataEndTime > 0) {
      const d = new Date(dataEndTime * 1000);
      setSelectedDateRaw(d);
      setCurrentTime(dayStartUnix(d));
    }
  }, [dataEndTime]);

  // Live mode: tick currentTime = Date.now()/1000
  useEffect(() => {
    if (timeMode !== "live") return;
    setPlaying(false);

    // Live 模式下，selectedDate 跟著 today
    setSelectedDateRaw(new Date());

    const tick = () => {
      setCurrentTime(Date.now() / 1000);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timeMode]);

  // Replay mode: animation loop
  useEffect(() => {
    if (timeMode !== "replay" || !playing) return;

    const animate = (now: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + dt * speed;
        if (next >= windowEnd) {
          setPlaying(false);
          return windowStart; // loop back
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [timeMode, playing, speed, windowStart, windowEnd]);

  const play = useCallback(() => {
    if (timeMode === "replay") setPlaying(true);
  }, [timeMode]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    if (timeMode === "replay") setPlaying((p) => !p);
  }, [timeMode]);

  const seek = useCallback(
    (time: number) => {
      if (timeMode === "replay") {
        setCurrentTime(Math.max(windowStart, Math.min(windowEnd, time)));
      }
    },
    [timeMode, windowStart, windowEnd],
  );

  const seekByProgress = useCallback(
    (p: number) => {
      seek(windowStart + p * duration);
    },
    [seek, windowStart, duration],
  );

  const handleSetTimeMode = useCallback((mode: TimeMode) => {
    setTimeMode(mode);
    if (mode === "replay") {
      setPlaying(false);
    }
    if (mode === "live") {
      setSelectedDateRaw(new Date());
    }
  }, []);

  return {
    currentTime,
    playing,
    speed,
    progress,
    timeMode,
    selectedDate,
    rangeDays,
    windowStart,
    windowEnd,
    play,
    pause,
    toggle,
    setSpeed,
    seek,
    seekByProgress,
    setTimeMode: handleSetTimeMode,
    setSelectedDate,
    shiftDate,
    setRangeDays,
  };
}
