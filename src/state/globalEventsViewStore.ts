import type { GlobalSituationEntry } from "../data/globalEventsLoader";

export interface GlobalEventsViewSnapshot {
  entries: readonly GlobalSituationEntry[];
  status: "idle" | "loading" | "ready" | "partial" | "error";
  message: string | null;
  windowLabel: string;
  /** 地圖上因「AI 判為雜訊」預設隱藏的事件數（開關打開時為 0）。 */
  noiseHidden?: number;
}
let snapshot: GlobalEventsViewSnapshot = { entries: [], status: "idle", message: null, windowLabel: "最近七天", noiseHidden: 0 };
const listeners = new Set<() => void>();
let onSelect: ((entry: GlobalSituationEntry) => void) | null = null;
export const globalEventsViewStore = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  set: (next: GlobalEventsViewSnapshot) => { snapshot = next; for (const listener of listeners) listener(); },
  setSelectHandler: (handler: typeof onSelect) => { onSelect = handler; },
  select: (entry: GlobalSituationEntry) => onSelect?.(entry),
};
