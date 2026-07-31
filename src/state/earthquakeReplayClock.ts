/**
 * 地震回放的 scoped 播放時鐘（**不掛全域 timeStore**）。
 *
 * 為什麼要獨立 store：
 * - 回放時鐘的單位是「震後真實秒數」，跟 timeline 的 unix 秒是兩件事，
 *   掛上去會讓其他動態圖層跟著地震回放跑（開發規則 §8 只約束消費 timeline 的圖層）。
 * - 引擎（useEarthquakeReplayLayer 的 RAF）每幀寫時鐘，若走 React state 會讓
 *   整個 App.tsx 每幀 re-render。這裡用 external store：寫入永遠即時（引擎讀 `get()`），
 *   **通知**節流到 10Hz，只有訂閱的小面板（進度條）會重繪。
 *
 * 所有視覺都是時鐘的純函數 → scrub 只要 `set(t)`，下一幀畫面自動正確。
 */

const NOTIFY_INTERVAL_MS = 100;

interface ClockSnapshot {
  /** 震後真實秒數（回放時鐘） */
  clock: number;
  /** 本次回放總長（震後真實秒數）；0 = 尚未載入 */
  duration: number;
  /** 播放速率（回放時鐘秒 / 牆鐘秒），僅供 UI 顯示 */
  rate: number;
}

let snapshot: ClockSnapshot = { clock: 0, duration: 0, rate: 1 };
let lastNotifyMs = 0;
const listeners = new Set<() => void>();

function notify(): void {
  lastNotifyMs = performance.now();
  for (const l of listeners) l();
}

export const earthquakeReplayClock = {
  /** 引擎每幀同步讀（不經 React） */
  get(): number {
    return snapshot.clock;
  },
  getDuration(): number {
    return snapshot.duration;
  },
  /** 引擎每幀寫；通知節流 10Hz。`force` 用於 scrub / reset 等需要立即反映的情境。 */
  set(clock: number, force = false): void {
    if (snapshot.clock === clock && !force) return;
    snapshot = { ...snapshot, clock };
    if (force || performance.now() - lastNotifyMs >= NOTIFY_INTERVAL_MS) notify();
  },
  /** 換事件 / 明細載入完成時設定總長與速率（低頻，一律立即通知） */
  setTimeline(duration: number, rate: number): void {
    snapshot = { clock: 0, duration, rate };
    notify();
  },
  reset(): void {
    snapshot = { ...snapshot, clock: 0 };
    notify();
  },
  clear(): void {
    snapshot = { clock: 0, duration: 0, rate: 1 };
    notify();
  },
  getSnapshot(): ClockSnapshot {
    return snapshot;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
