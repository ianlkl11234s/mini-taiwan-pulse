/**
 * External Time Store
 *
 * 動態圖層的時間來源。目的是讓動畫迴圈脫離 React re-render 週期：
 * 時間變動透過 subscribe 通知，而不是 setState 觸發整棵元件樹重算。
 *
 * 規則（專案 CLAUDE.md / development-rules.md）：
 *   - 動態圖層禁止把 currentTime 放進 React useEffect/useMemo deps。
 *   - RAF 內讀 getTime()；UI 用 useSyncExternalStore；
 *     真相依改 subscribeThrottled；只關心日期用 subscribeDate。
 *
 * 只有 useTimeline 應該呼叫 setTime。其他地方一律唯讀。
 */

type Listener<T> = (v: T) => void;

function toDateKey(unixSec: number): string {
  // 與專案其餘處一致：sv-SE locale = YYYY-MM-DD，Asia/Taipei
  return new Date(unixSec * 1000).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Taipei",
  });
}

let currentTime = Date.now() / 1000;
let currentDateKey = toDateKey(currentTime);

const rawListeners = new Set<Listener<number>>();
const dateListeners = new Set<Listener<string>>();

// 節流訂閱需要各自追蹤 last fire 時間，所以包成獨立 entry。
interface ThrottledEntry {
  ms: number;
  cb: Listener<number>;
  lastFire: number; // performance.now() 時間戳
  pending: boolean;
  timer: number | null;
}
const throttledEntries = new Set<ThrottledEntry>();

function notifyRaw() {
  for (const cb of rawListeners) cb(currentTime);
}

function notifyDate() {
  for (const cb of dateListeners) cb(currentDateKey);
}

function scheduleThrottled(entry: ThrottledEntry) {
  const now = performance.now();
  const elapsed = now - entry.lastFire;
  if (elapsed >= entry.ms) {
    entry.lastFire = now;
    entry.pending = false;
    entry.cb(currentTime);
  } else if (!entry.pending) {
    entry.pending = true;
    const delay = entry.ms - elapsed;
    entry.timer = window.setTimeout(() => {
      entry.lastFire = performance.now();
      entry.pending = false;
      entry.timer = null;
      entry.cb(currentTime);
    }, delay);
  }
}

function notifyThrottled() {
  for (const entry of throttledEntries) scheduleThrottled(entry);
}

export const timeStore = {
  /** 當前時間（unix 秒）。純讀，絕對不觸發 React re-render。 */
  getTime(): number {
    return currentTime;
  },

  /** 當前日期 key（YYYY-MM-DD，Asia/Taipei）。 */
  getDateKey(): string {
    return currentDateKey;
  },

  /**
   * 寫入當前時間。僅 useTimeline 應呼叫。
   * 會通知 raw 訂閱者（每次），date 訂閱者（日期變化），
   * throttled 訂閱者（依各自 ms 節流）。
   */
  setTime(t: number): void {
    if (t === currentTime) return;
    currentTime = t;
    const nextKey = toDateKey(t);
    const dateChanged = nextKey !== currentDateKey;
    if (dateChanged) currentDateKey = nextKey;

    notifyRaw();
    notifyThrottled();
    if (dateChanged) notifyDate();
  },

  /**
   * 訂閱每次時間變動（動畫迴圈用；高頻）。
   * 回傳 unsubscribe 函式。
   */
  subscribe(cb: Listener<number>): () => void {
    rawListeners.add(cb);
    return () => rawListeners.delete(cb);
  },

  /**
   * 節流訂閱：距上次通知超過 ms 才觸發（trailing edge 保證最後一次會送）。
   * 給 news filter / earthquake ripple / freeway lookup / UI 顯示用。
   */
  subscribeThrottled(ms: number, cb: Listener<number>): () => void {
    const entry: ThrottledEntry = {
      ms,
      cb,
      lastFire: -Infinity,
      pending: false,
      timer: null,
    };
    throttledEntries.add(entry);
    return () => {
      if (entry.timer !== null) window.clearTimeout(entry.timer);
      throttledEntries.delete(entry);
    };
  },

  /**
   * 訂閱日期變化（粒度：日）。
   * 給資料載入類邏輯用，避免把 currentTime 放進 useEffect deps。
   */
  subscribeDate(cb: Listener<string>): () => void {
    dateListeners.add(cb);
    return () => dateListeners.delete(cb);
  },
};

export type TimeStore = typeof timeStore;
