import type { GlobalSituationEntry } from "../data/globalEventsLoader";

export interface GlobalEventsViewSnapshot {
  entries: readonly GlobalSituationEntry[];
  status: "idle" | "loading" | "ready" | "partial" | "error";
  message: string | null;
  windowLabel: string;
}
let snapshot: GlobalEventsViewSnapshot = { entries: [], status: "idle", message: null, windowLabel: "最近七天" };
const listeners = new Set<() => void>();
let onSelect: ((entry: GlobalSituationEntry) => void) | null = null;
export const globalEventsViewStore = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  set: (next: GlobalEventsViewSnapshot) => { snapshot = next; for (const listener of listeners) listener(); },
  setSelectHandler: (handler: typeof onSelect) => { onSelect = handler; },
  select: (entry: GlobalSituationEntry) => onSelect?.(entry),
};
