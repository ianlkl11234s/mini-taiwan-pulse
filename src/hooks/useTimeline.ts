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

export interface TimelineModeSnapshot {
  /** 離開歷史模式前的 timeMode（live / replay）。 */
  timeMode: TimeMode;
  /** 離開歷史模式前的共用 timeStore 時間（unix 秒）。 */
  currentTime: number;
}

/**
 * 離開歷史模式時，把共用 timeStore 還原成進入歷史模式前的狀態。
 * live 直接切回 live（setTimeMode 內部會把 selectedDate 設回今天並讓 RAF 重新同步
 * Date.now()）；replay 用 jumpToTime 精確還原 selectedDate/windowDateKeys/currentTime
 *（前提：rangeDays 沒有在歷史模式期間被改動，這在目前的呼叫路徑下成立）。
 * 抽成純函數＋依賴注入方便測試；實際的 setTimeMode / jumpToTime 由呼叫端（App.tsx 的
 * useTimeline() 回傳值）提供。
 */
export function restoreTimelineSnapshot(
  snapshot: TimelineModeSnapshot,
  actions: {
    setTimeMode: (mode: TimeMode) => void;
    jumpToTime: (time: number) => void;
  },
): void {
  if (snapshot.timeMode === "live") {
    actions.setTimeMode("live");
  } else {
    actions.jumpToTime(snapshot.currentTime);
  }
}

export interface HistoricalPeriodSnapshot {
  /** 所選期間結束前 1ms；只代表回放游標，不是事件的結束時間。 */
  cursorTime: number;
  /** 游標所在的台北日曆日。 */
  dateKey: string;
  /** RPC 查詢用的單日 half-open window。 */
  windowStart: string;
  windowEnd: string;
}

/**
 * HistoricalTimeline 的年／月／日都是「該期間結束前的快照」。
 * 台灣沒有 DST，因此可安全用固定 +08:00 日界；不替事件製造 valid_to。
 */
export function historicalPeriodSnapshot(
  rocYear: number,
  month: number,
  day: number,
  granularity: "year" | "month" | "day",
): HistoricalPeriodSnapshot {
  const adYear = Math.trunc(rocYear) + 1911;
  const safeMonth = Math.max(1, Math.min(12, Math.trunc(month)));
  const daysInSelectedMonth = new Date(Date.UTC(adYear, safeMonth, 0)).getUTCDate();
  const safeDay = Math.max(1, Math.min(daysInSelectedMonth, Math.trunc(day)));
  const taipeiOffsetMs = 8 * 3_600_000;
  const nextBoundaryMs = granularity === "year"
    ? Date.UTC(adYear + 1, 0, 1) - taipeiOffsetMs
    : granularity === "month"
      ? Date.UTC(adYear, safeMonth, 1) - taipeiOffsetMs
      : Date.UTC(adYear, safeMonth - 1, safeDay + 1) - taipeiOffsetMs;
  const cursorMs = nextBoundaryMs - 1;
  const dateKey = new Date(cursorMs).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
  const windowStartMs = new Date(`${dateKey}T00:00:00+08:00`).getTime();
  return {
    cursorTime: cursorMs / 1000,
    dateKey,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowStartMs + 86_400_000).toISOString(),
  };
}

/** 加減天數（台灣無 DST，直接加 86400 秒） */
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400 * 1000);
}

function windowDateKeysFor(selectedDate: Date, rangeDays: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < rangeDays; i++) {
    keys.push(addDays(selectedDate, i).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }));
  }
  return keys;
}

interface UseTimelineOptions {
  /** 資料整體範圍（用於 clamp 日期選擇） */
  dataStartTime: number;
  dataEndTime: number;
  timeMode?: TimeMode;
}

// ⚠️ 不回傳 currentTime / progress：useTimeline 由 App 呼叫，若在這裡訂閱 4Hz 時間，
// 播放中整個 App（含所有 LayerHost）會每 250ms 重渲一次（PF-6）。需要顯示時間的
// 元件自己呼叫 `useUiTime()`；邏輯要時間就在 effect 內 timeStore.subscribe*。
interface UseTimelineReturn {
  playing: boolean;
  speed: number;
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
  /** 資料載入完成時呼叫；使用者暫停過則不播放 */
  autoPlay: () => void;
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

/**
 * 顯示用的目前時間（4Hz 節流訂閱 timeStore）。只給「真的要把時間畫出來」的葉元件用
 * （TimelineControls 包裝、時鐘文字）；呼叫它的元件播放中會 4Hz 重渲，勿在 App 層呼叫。
 */
export function useUiTime(): number {
  return useSyncExternalStore(subscribeUiTime, getTimeSnapshot);
}

export interface ReplayFrameAdvance {
  time: number;
  reachedEnd: boolean;
}

/** Replay 沒有 loop mode；抵達尾端時停在尾端。已經在尾端之後（使用者拖進未來）就原地停，不往回跳。 */
export function advanceReplayFrame(
  current: number,
  elapsedSeconds: number,
  speed: number,
  end: number,
): ReplayFrameAdvance {
  if (current >= end) return { time: current, reachedEnd: true };
  const next = current + elapsedSeconds * speed;
  return next >= end
    ? { time: end, reachedEnd: true }
    : { time: next, reachedEnd: false };
}

/** 播放終點：視窗結尾與「現在」取較早者——不播進還沒發生的未來。 */
export function replayPlaybackEnd(windowEnd: number, nowUnix: number): number {
  return Math.min(windowEnd, nowUnix);
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
    timeStore.setWindowDateKeys(windowDateKeysFor(selectedDate, rangeDays));
  }, [selectedDate, rangeDays]);

  // 首次掛載寫入 timeStore 初始值（從「現在 - 1 小時」開始；過去日期從午夜開始）。
  // ⚠️ 必走 effect 不可放 render body：`useUiTime()` 的訂閱者（TimelineControls、時鐘等）
  // 以 useSyncExternalStore 訂閱 timeStore，若在 App render 期間直接 timeStore.setTime()
  // 會同步通知這些訂閱者，觸發 React「Cannot update a component (X) while rendering a
  // different component (App)」警告。
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

  // 顯示用時間改由葉元件 `useUiTime()` 自己訂閱（見 UseTimelineReturn 上方註解）。
  // 動畫迴圈請直接 timeStore.getTime()。
  const duration = windowEnd - windowStart;

  // 日期切換時重置 currentTime
  const setSelectedDate = useCallback((d: Date) => {
    setSelectedDateRaw(d);
    timeStore.setTime(dayStartUnix(d));
    setPlaying(false);
  }, []);

  // ⚠️ 副作用不可放進 useState updater：updater 由 React 在 **render 期間** 執行
  // （basicStateReducer），此時 timeStore.setTime() 會經 scheduleThrottled 的 leading
  // edge **同步**通知 `useUiTime()` 的 useSyncExternalStore 訂閱者 → forceStoreRerender
  // → React「Cannot update a component (X) while rendering a different component (App)」。
  // 改為在 handler 內用當前 selectedDate 算出 next（與上方 setSelectedDate 同模式）。
  const shiftDate = useCallback((days: number) => {
    const next = addDays(selectedDate, days);
    setSelectedDateRaw(next);
    timeStore.setTime(dayStartUnix(next));
    setPlaying(false);
  }, [selectedDate]);

  // dataStartTime/dataEndTime 保留給未來日期 clamp 用，初始化不依賴它們
  void dataStartTime;

  // Live mode: 每秒同步一次 Date.now()（1Hz，不是每幀）
  // 即時資料本身是秒～分鐘級更新，60Hz setTime 只會讓所有時間驅動圖層每幀重算＋重畫。
  // 下游 engines（rail/bus）與 3D custom layer 仍走單一的 timeStore.subscribe 拿時間；
  // 位置每秒更新一次（使用者已同意）。對齊到整秒，讓畫面上的時鐘跳動一致。
  useEffect(() => {
    if (timeMode !== "live") return;
    setPlaying(false);

    // Live 模式下，selectedDate 跟著 today
    setSelectedDateRaw(new Date());

    const tick = () => timeStore.setTime(Date.now() / 1000);
    tick();
    let interval = 0;
    const align = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 1000);
    }, 1000 - (Date.now() % 1000));
    return () => {
      window.clearTimeout(align);
      window.clearInterval(interval);
    };
  }, [timeMode]);

  // Replay mode: RAF 迴圈直接寫 store，不走 React state
  useEffect(() => {
    if (timeMode !== "replay" || !playing) return;

    const animate = (now: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      const frame = advanceReplayFrame(timeStore.getTime(), dt, speed, replayPlaybackEnd(windowEnd, Date.now() / 1000));
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

  // 使用者（或場景）主動暫停過 → 資料重載後的自動播放不可把它重新啟動；按播放才清掉。
  const userPausedRef = useRef(false);
  const play = useCallback(() => {
    userPausedRef.current = false;
    if (timeMode === "replay") setPlaying(true);
  }, [timeMode]);
  const pause = useCallback(() => {
    userPausedRef.current = true;
    setPlaying(false);
  }, []);
  const toggle = useCallback(() => {
    if (timeMode !== "replay") return;
    userPausedRef.current = playing;
    setPlaying(!playing);
  }, [timeMode, playing]);
  /** 資料載入完成時的自動播放：使用者暫停過就不動。 */
  const autoPlay = useCallback(() => {
    if (userPausedRef.current) return;
    if (timeMode === "replay") setPlaying(true);
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
    const selected = new Date(time * 1000);
    setSelectedDateRaw(selected);
    setTimeMode("replay");
    setPlaying(false);
    // 先同步 window，再推進 cursor：跨日 loader 才能保留舊 cursor，判斷向前
    // 跨過 display_from 的 new_event / version_update pulse。
    timeStore.setWindowDateKeys(windowDateKeysFor(selected, rangeDays));
    timeStore.setTime(time);
  }, [rangeDays]);

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
      userPausedRef.current = true; // live → replay 就是使用者按下暫停，autoPlay 不可在載入完成後又開始播
    }
    if (mode === "live") {
      setSelectedDateRaw(new Date());
    }
  }, []);

  return {
    playing,
    speed,
    timeMode,
    selectedDate,
    rangeDays,
    windowStart,
    windowEnd,
    play,
    pause,
    toggle,
    autoPlay,
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
