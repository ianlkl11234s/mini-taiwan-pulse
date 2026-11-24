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
/** 地圖上目前畫出的事件 feature（hook 提供；含 popup 需要的 properties 與座標）。 */
export interface GlobalEventPopupFeature { properties: Record<string, unknown>; coords: [number, number] }
let featureLookup: ((eventId: string) => GlobalEventPopupFeature | null) | null = null;
let popupOpener: ((feature: GlobalEventPopupFeature) => void) | null = null;
export const globalEventsViewStore = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  set: (next: GlobalEventsViewSnapshot) => { snapshot = next; for (const listener of listeners) listener(); },
  setSelectHandler: (handler: typeof onSelect) => { onSelect = handler; },
  select: (entry: GlobalSituationEntry) => onSelect?.(entry),
  setFeatureLookup: (lookup: typeof featureLookup) => { featureLookup = lookup; },
  setPopupOpener: (opener: typeof popupOpener) => { popupOpener = opener; },
  /** popup「可能相關報導」清單點一則：移過去、展開，並把 popup 換成那一則（INTEL 的 select 不換 popup，行為不變）。 */
  focusFromPopup: (entry: GlobalSituationEntry) => {
    onSelect?.(entry);
    const feature = featureLookup?.(entry.eventId);
    if (feature) popupOpener?.(feature);
  },
};
