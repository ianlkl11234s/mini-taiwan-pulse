/**
 * gfwV4TrackDataWindowStore —— GFW v4 航跡圖層「目前時間軸落在資料窗哪裡」的明確狀態。
 *
 * 由 useGfwV4TracksLayer 寫入；legend / overlay 用 useSyncExternalStore 讀（形狀刻意對齊
 * `src/state/climateFrameStore.ts`）。**圖層絕不 clamp、絕不改動全域 timeStore**：
 * 超出資料窗只清空自己並在這裡留下可被 UI 標示的理由。
 */

import { useSyncExternalStore } from "react";

export type GfwV4TrackDataWindowState =
  /** release 還沒載到，或圖層關閉。 */
  | "unknown"
  /** 選取日期在資料窗內，且該小時有資料。 */
  | "in-window"
  /** 選取日期在資料窗外 → 圖層刻意空白。 */
  | "out-of-window"
  /** 日期在窗內，但該小時缺 enabled bucket 的 frame → 圖層刻意空白。 */
  | "hour-unavailable";

export interface GfwV4TrackDataWindow {
  status: GfwV4TrackDataWindowState;
  /** 資料窗起訖（含），UTC `YYYY-MM-DD`；release 未載入時為 null。 */
  startUtcDate: string | null;
  endUtcDate: string | null;
  /** 時間軸目前要求的 UTC 日期。 */
  requestedUtcDate: string | null;
}

const UNKNOWN: GfwV4TrackDataWindow = Object.freeze({ status: "unknown", startUtcDate: null, endUtcDate: null, requestedUtcDate: null });

let state: GfwV4TrackDataWindow = UNKNOWN;
const listeners = new Set<() => void>();

const same = (a: GfwV4TrackDataWindow, b: GfwV4TrackDataWindow) =>
  a.status === b.status && a.startUtcDate === b.startUtcDate && a.endUtcDate === b.endUtcDate && a.requestedUtcDate === b.requestedUtcDate;

export const gfwV4TrackDataWindowStore = {
  get(): GfwV4TrackDataWindow { return state; },
  set(next: GfwV4TrackDataWindow): void {
    if (same(state, next)) return;
    state = next;
    for (const listener of listeners) listener();
  },
  clear(): void { gfwV4TrackDataWindowStore.set(UNKNOWN); },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useGfwV4TrackDataWindow(): GfwV4TrackDataWindow {
  return useSyncExternalStore(gfwV4TrackDataWindowStore.subscribe, gfwV4TrackDataWindowStore.get, () => UNKNOWN);
}
