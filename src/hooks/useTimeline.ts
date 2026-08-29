import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TimeMode } from "../types";
import { timeStore } from "../state/timeStore";

/** 從 Date 提取台灣時區的日期 [year, month(0-based), day] */
export function taiwanDateParts(d: Date): [number, number, number] {
  const s = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const [y, m, day] = s.split("-").map(Number);
  return [y!, m! - 1, day!];
}

/** 將 Date 轉為台灣時區當天 00:00:00 的 unix timestamp */
export function dayStartUnix(d: Date): number {
  const [y, m, day] = taiwanDateParts(d);
  // Taiwan midnight = UTC midnight - 8h
  return Date.UTC(y, m, day, 0, 0, 0) / 1000 - 8 * 3600;
}

/** 將 Date 轉為台灣時區當天 23:59:59 的 unix timestamp */
export function dayEndUnix(d: Date): number {
  const [y, m, day] = taiwanDateParts(d);
  return Date.UTC(y, m, day, 23, 59, 59) / 1000 - 8 * 3600;
}

/** 加減天數（台灣無 DST，直接加 86400 秒） */
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400 * 1000);
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
  /** 顯式跳至指定時間，並把台北日曆視窗移到該時間所在日。 */
  jumpToTime: (time: number) => void;
  seekByProgress: (p: number) => void;
  setTimeMode: (mode: TimeMode) => void;
  /** 切換日期（絕對） */
  setSelectedDate: (d: Date) => void;
  /** 日期前後移動 */
  shiftDate: (days: number) => void;
  /** 設定視窗天數 */
  setRangeDays: (n: number) => void;
}

// UI 用的時間訂閱節流：4Hz，肉眼幾乎無感。
// 動態圖層不該透過這個值，應直接讀 timeStore.getTime()。
const UI_TIME_THROTTLE_MS = 250;

const subscribeUiTime = (cb: () => void) =>
  timeStore.subscribeThrottled(UI_TIME_THROTTLE_MS, cb);
const getTimeSnapshot = () => timeStore.getTime();

export interface ReplayFrameAdvance {
  time: number;
  reachedEnd: boolean;
}

/** Replay 沒有 loop mode；抵達視窗尾端時停在尾端。 */
export function advanceReplayFrame(
  current: number,
  elapsedSeconds: number,
  speed: number,
  windowEnd: number,
): ReplayFrameAdvance {
  const next = current + elapsedSeconds * speed;
  return next >= windowEnd
    ? { time: windowEnd, reachedEnd: true }
    : { time: next, reachedEnd: false };
}

export function useTimeline({
  dataStartTime,
  dataEndTime: _dataEndTime,
  timeMode: initialTimeMode = "replay",
}: UseTimelineOptions): UseTimelineReturn {
  void _dataEndTime; // 保留 interface 相容，實際用 dataStartTime 初始化
  // 預設選定日期 = 台灣時間的今天（不依賴資料範圍，避免不同資料源日期不一致）
  const [selectedDate, setSelectedDateRaw] = useState<Date>(() => {
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
    return new Date(todayStr + "T00:00:00+08:00");
  });
  const [rangeDays, setRangeDays] = useState<number>(1);
  // rangeDays 同步進 timeStore — 給 time-aware loader 訂閱 prefetch 視窗
  useEffect(() => {
    timeStore.setRangeDays(rangeDays);
  }, [rangeDays]);

  // 視窗起止
  const windowStart = dayStartUnix(selectedDate);
  const windowEnd = dayEndUnix(addDays(selectedDate, rangeDays - 1));

  // 視窗內每一天的 dateKey（YYYY-MM-DD, Asia/Taipei）→ 寫入 timeStore SSOT，
  // time-aware loader 訂閱 subscribeWindowDateKeys 後嚴格只預載這份；視窗外不打 RPC。
  useEffect(() => {
    const keys: string[] = [];
    for (let i = 0; i < rangeDays; i++) {
      keys.push(addDays(selectedDate, i).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }));
    }
    timeStore.setWindowDateKeys(keys);
  }, [selectedDate, rangeDays]);

  // 首次掛載寫入 timeStore 初始值（從「現在 - 1 小時」開始；過去日期從午夜開始）。
  // ⚠️ 必走 effect 不可放 render body：本 hook 下方以 useSyncExternalStore 訂閱 timeStore
  // （currentTime），若在 App render 期間直接 timeStore.setTime() 會同步通知該訂閱者，觸發
  // React「Cannot update a component (App) while rendering a different component (App)」警告。
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const startUnix = Date.now() / 1000 - 3600;
    const initial =
      startUnix >= windowStart && startUnix <= windowEnd ? startUnix : windowStart;
    timeStore.setTime(initial);
    // 僅初始化一次，刻意使用首次掛載的視窗界限
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);
  const [timeMode, setTimeMode] = useState<TimeMode>(initialTimeMode);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  // UI 取用的 currentTime：節流訂閱，不隨每幀 re-render。
  // 動畫迴圈請直接 timeStore.getTime()，不要經過這個值。
  const currentTime = useSyncExternalStore(subscribeUiTime, getTimeSnapshot);

  const duration = windowEnd - windowStart;
  const progress = duration > 0 ? (currentTime - windowStart) / duration : 0;

  // 日期切換時重置 currentTime
  const setSelectedDate = useCallback((d: Date) => {
    setSelectedDateRaw(d);
    timeStore.setTime(dayStartUnix(d));
    setPlaying(false);
  }, []);

  // ⚠️ 副作用不可放進 useState updater：updater 由 React 在 **render 期間** 執行
  // （basicStateReducer），此時 timeStore.setTime() 會經 scheduleThrottled 的 leading
  // edge **同步**通知本 hook 下方的 useSyncExternalStore 訂閱者 → forceStoreRerender(App)
  // → React「Cannot update a component (App) while rendering a different component (App)」。
  // 改為在 handler 內用當前 selectedDate 算出 next（與上方 setSelectedDate 同模式）。
  const shiftDate = useCallback((days: number) => {
    const next = addDays(selectedDate, days);
    setSelectedDateRaw(next);
    timeStore.setTime(dayStartUnix(next));
    setPlaying(false);
  }, [selectedDate]);

  // dataStartTime/dataEndTime 保留給未來日期 clamp 用，初始化不依賴它們
  void dataStartTime;

  // Live mode: RAF 每幀同步到 Date.now()
  // 用 RAF 而非 setInterval 讓 timeStore 在 Live/Replay 兩種模式下都是 60Hz 節拍，
  // 下游 engines（rail/bus）可以用單一的 timeStore.subscribe 機制拿到時間，
  // 不需要自己開 RAF。
  useEffect(() => {
    if (timeMode !== "live") return;
    setPlaying(false);

    // Live 模式下，selectedDate 跟著 today
    setSelectedDateRaw(new Date());

    let raf = 0;
    const tick = () => {
      timeStore.setTime(Date.now() / 1000);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [timeMode]);

  // Replay mode: RAF 迴圈直接寫 store，不走 React state
  useEffect(() => {
    if (timeMode !== "replay" || !playing) return;

    const animate = (now: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      const frame = advanceReplayFrame(timeStore.getTime(), dt, speed, windowEnd);
      timeStore.setTime(frame.time);
      if (frame.reachedEnd) {
        setPlaying(false);
        return;
      }

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
        timeStore.setTime(Math.max(windowStart, Math.min(windowEnd, time)));
      }
    },
    [timeMode, windowStart, windowEnd],
  );

  const jumpToTime = useCallback((time: number) => {
    if (!Number.isFinite(time)) return;
    // Date 保留絕對時間；dayStartUnix 會從中取 Asia/Taipei 日曆日。
    setSelectedDateRaw(new Date(time * 1000));
    setTimeMode("replay");
    setPlaying(false);
    timeStore.setTime(time);
  }, []);

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
    jumpToTime,
    seekByProgress,
    setTimeMode: handleSetTimeMode,
    setSelectedDate,
    shiftDate,
    setRangeDays,
  };
}
