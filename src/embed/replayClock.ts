/**
 * `/embed` 回放時鐘（EM-16）—— scoped external store，**零 React 依賴**。
 *
 * 樣板：`src/state/earthquakeReplayClock.ts`（不掛全域 timeStore 的回放時鐘先例）。
 * 相同處：寫入永遠即時（`get()` 同步讀），**通知**節流 10Hz，只讓訂閱的小面板重繪。
 * 新增：play / pause / setSpeed / 在 `[t0, t1]` 區間 loop。
 *
 * ⚠️ **與主站不同的設計選擇：RAF 由時鐘自持。**
 * 主站的時間推進主人是 `timeStore` + App 那條既有的 RAF；embed 沒有任何其他 RAF 主人
 * （地圖的重繪由 CustomLayer 的 `triggerRepaint()` 驅動，那是「畫」不是「走時間」）。
 * 讓時鐘自己持有 RAF → 消費端只要 `clock.get()`，不必再接一條迴圈；pause 時直接
 * 取消 RAF，不空轉。
 *
 * RAF 以參數注入（`createReplayClock({ now, raf, caf })`），時間推進邏輯因此與
 * 瀏覽器解耦、可單元測試。
 */

const NOTIFY_INTERVAL_MS = 100;
/**
 * 單幀最大牆鐘 dt（秒）。分頁切走時 RAF 會被凍結，切回來的第一幀 dt 可能是好幾秒，
 * 乘上 ~960x 倍速會讓畫面瞬間跳過大半天。夾住上限＝寧可「慢一點」也不要暴衝。
 */
const MAX_FRAME_DT_S = 0.25;

export interface ReplayClockSnapshot {
  /** 目前回放時刻（unix 秒） */
  time: number;
  /** 回放區間起點（unix 秒） */
  t0: number;
  /** 回放區間終點（unix 秒） */
  t1: number;
  /** 倍速（回放秒 / 牆鐘秒） */
  speed: number;
  playing: boolean;
  /** 是否已設定過有效區間 */
  ready: boolean;
}

export interface ReplayClockDeps {
  /** 牆鐘毫秒（預設 performance.now） */
  now?: () => number;
  raf?: (cb: (t: number) => void) => number;
  caf?: (handle: number) => void;
}

export interface ReplayClock {
  get(): number;
  getSnapshot(): ReplayClockSnapshot;
  subscribe(cb: () => void): () => void;
  /** 設定回放區間與倍速；`startAt` 落在區間外時退回 `t0`。會重置為未播放。 */
  setRange(t0: number, t1: number, speed: number, startAt?: number): void;
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: number): void;
  /** 直接跳到某時刻（夾在區間內；scrubber 用，目前 UI 尚未提供） */
  seek(time: number): void;
  /** 停止 RAF 並清空狀態（圖層卸載時呼叫） */
  clear(): void;
}

export function createReplayClock(deps: ReplayClockDeps = {}): ReplayClock {
  const now = deps.now ?? (() => performance.now());
  const raf =
    deps.raf ??
    ((cb: (t: number) => void) =>
      typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : 0);
  const caf =
    deps.caf ??
    ((h: number) => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(h);
    });

  let snapshot: ReplayClockSnapshot = {
    time: 0, t0: 0, t1: 0, speed: 1, playing: false, ready: false,
  };
  let lastNotifyMs = 0;
  let lastFrameMs = 0;
  let rafHandle: number | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    lastNotifyMs = now();
    for (const l of listeners) l();
  }

  function notifyThrottled(): void {
    if (now() - lastNotifyMs >= NOTIFY_INTERVAL_MS) notify();
  }

  /** 把時間 wrap 進 [t0, t1]（modulo，超出尾端就從頭接續，不是硬跳 t0）。 */
  function wrap(time: number): number {
    const span = snapshot.t1 - snapshot.t0;
    if (span <= 0) return snapshot.t0;
    const rel = (((time - snapshot.t0) % span) + span) % span;
    return snapshot.t0 + rel;
  }

  function stopRaf(): void {
    if (rafHandle != null) {
      caf(rafHandle);
      rafHandle = null;
    }
  }

  function frame(): void {
    rafHandle = null;
    if (!snapshot.playing) return;

    const t = now();
    const dt = Math.min(Math.max((t - lastFrameMs) / 1000, 0), MAX_FRAME_DT_S);
    lastFrameMs = t;

    snapshot = { ...snapshot, time: wrap(snapshot.time + dt * snapshot.speed) };
    notifyThrottled();

    rafHandle = raf(frame);
  }

  function startRaf(): void {
    if (rafHandle != null) return;
    lastFrameMs = now();
    rafHandle = raf(frame);
  }

  function play(): void {
    if (!snapshot.ready || snapshot.playing) return;
    snapshot = { ...snapshot, playing: true };
    startRaf();
    notify();
  }

  function pause(): void {
    if (!snapshot.playing) return;
    stopRaf();
    snapshot = { ...snapshot, playing: false };
    notify();
  }

  return {
    /** 渲染端每幀同步讀（不經 React） */
    get(): number {
      return snapshot.time;
    },
    getSnapshot(): ReplayClockSnapshot {
      return snapshot;
    },
    subscribe(cb: () => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    setRange(t0: number, t1: number, speed: number, startAt?: number): void {
      stopRaf();
      const ready = Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0;
      const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
      const start =
        startAt != null && Number.isFinite(startAt) && startAt >= t0 && startAt <= t1
          ? startAt
          : t0;
      snapshot = {
        time: ready ? start : 0,
        t0: ready ? t0 : 0,
        t1: ready ? t1 : 0,
        speed: safeSpeed,
        playing: false,
        ready,
      };
      notify();
    },

    play,
    pause,

    toggle(): void {
      if (snapshot.playing) pause();
      else play();
    },

    /**
     * 換倍速。以「現在」為錨點重設幀基準 —— 不動 `time`，所以畫面不會跳，
     * 只有之後的推進速率改變。
     */
    setSpeed(speed: number): void {
      if (!Number.isFinite(speed) || speed <= 0) return;
      lastFrameMs = now();
      snapshot = { ...snapshot, speed };
      notify();
    },

    seek(time: number): void {
      if (!snapshot.ready || !Number.isFinite(time)) return;
      lastFrameMs = now();
      snapshot = { ...snapshot, time: wrap(time) };
      notify();
    },

    clear(): void {
      stopRaf();
      snapshot = { time: 0, t0: 0, t1: 0, speed: 1, playing: false, ready: false };
      notify();
    },
  };
}

/**
 * embed 的單例時鐘。一頁只會有一個回放圖層（URL 決定），故不需要多實例；
 * UI（EmbedApp 的播放鈕）與渲染端（threeReplayLayer）都讀這一個。
 */
export const replayClock: ReplayClock = createReplayClock();

/**
 * 一天的回放預設播完秒數。倍速 = 資料實際跨度 / 這個值 —— 用「資料跨度」而非
 * 固定 86400，才能保證任何一天都真的是約 90 秒跑完一圈。
 */
export const REPLAY_LOOP_SECONDS = 90;

/** 由資料時間跨度算預設倍速。 */
export function defaultReplaySpeed(t0: number, t1: number): number {
  const span = t1 - t0;
  return span > 0 ? span / REPLAY_LOOP_SECONDS : 1;
}

/**
 * `p.speed` 的驗證：**越界一律 drop（用預設），不 clamp** —— 與 urlState 的
 * 降級原則一致（越界多半是壞掉的網址，不是想要邊界值）。
 * 上限 86400 = 一天一秒播完，再快沒有意義且會讓每幀跨度大到看不出動畫。
 */
export function resolveReplaySpeed(param: number | undefined, t0: number, t1: number): number {
  if (param != null && Number.isFinite(param) && param > 0 && param <= 86400) return param;
  return defaultReplaySpeed(t0, t1);
}

/**
 * `h=`（起始時刻，0–23）→ 起始 unix 秒。
 *
 * 時區固定 **Asia/Taipei**：`date` 指的是台灣的那一天，讀者可能在任何時區，
 * 不能用瀏覽器 local time 解讀。落在資料實際跨度 `[t0, t1]` 外 → 退回 `t0`
 * （drop，不 clamp 到 t1 —— 指定了沒有資料的時刻，從頭播比停在最後一幀有用）。
 */
export function resolveReplayStart(
  date: string,
  hour: number | undefined,
  t0: number,
  t1: number,
): number {
  if (hour == null || !Number.isFinite(hour)) return t0;
  const dayStartMs = Date.parse(`${date}T00:00:00+08:00`);
  if (Number.isNaN(dayStartMs)) return t0;
  const start = dayStartMs / 1000 + Math.floor(hour) * 3600;
  return start >= t0 && start <= t1 ? start : t0;
}

/** 回放時刻 → `HH:MM`（Asia/Taipei，固定時區，見 resolveReplayStart 註解）。 */
export function formatReplayClock(unixSec: number): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return "--:--";
  return new Date(unixSec * 1000).toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
