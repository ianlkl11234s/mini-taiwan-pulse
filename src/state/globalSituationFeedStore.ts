import type { GlobalSituationEntry } from "../data/globalEventsLoader";

/**
 * INTEL「全球情勢」分頁的資料來源。
 *
 * 刻意**不共用** `globalEventsViewStore` —— 那份快照由 `useGlobalEventsLayer`
 * 在 `visible && map` 的 effect 內寫入，等於把面板綁死在「圖層有開 + 地圖已掛載」。
 * 面板自己載自己的，行為才能跟國內新聞一致。
 */
export interface GlobalSituationFeedSnapshot {
  entries: readonly GlobalSituationEntry[];
  status: "idle" | "loading" | "ready" | "error";
  message: string | null;
  /** 這批資料對應的 timeStore 日期（YYYY-MM-DD） */
  dateKey: string | null;
}

export const EMPTY_GLOBAL_SITUATION_FEED: GlobalSituationFeedSnapshot = {
  entries: [],
  status: "idle",
  message: null,
  dateKey: null,
};

let snapshot: GlobalSituationFeedSnapshot = EMPTY_GLOBAL_SITUATION_FEED;
const listeners = new Set<() => void>();

export const globalSituationFeedStore = {
  /** 回傳快取住的同一個 reference（useSyncExternalStore 契約） */
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  set: (next: GlobalSituationFeedSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  },
  reset: () => globalSituationFeedStore.set(EMPTY_GLOBAL_SITUATION_FEED),
};
