// ══════════════════════════════════════════════════════════════════
//  liveCountStore — 動態計數（航班 / 列車 / 公車 / 公路客運 / 觀光巴士）
// ══════════════════════════════════════════════════════════════════
//
// 引擎在 timeStore 訂閱裡每 500ms 更新一次計數。以前是各 hook 的 useState，
// 而這些 hook 掛在 App → 播放中 App（含全部 LayerHost）每 500ms 重渲（PF-6）。
// 改成外部 store：只有顯示數字的側欄 row 以 `useLayerLiveCount` per-key 訂閱。

import { useSyncExternalStore } from "react";

export type LiveCountKey = "flights" | "trains" | "buses" | "busesIntercity" | "touristShuttle";

const values: Record<LiveCountKey, number> = {
  flights: 0,
  trains: 0,
  buses: 0,
  busesIntercity: 0,
  touristShuttle: 0,
};
const listeners: Record<LiveCountKey, Set<() => void>> = {
  flights: new Set(),
  trains: new Set(),
  buses: new Set(),
  busesIntercity: new Set(),
  touristShuttle: new Set(),
};

export const liveCountStore = {
  get(key: LiveCountKey): number {
    return values[key];
  },
  set(key: LiveCountKey, n: number): void {
    if (values[key] === n) return;
    values[key] = n;
    for (const cb of listeners[key]) cb();
  },
  subscribe(key: LiveCountKey, cb: () => void): () => void {
    listeners[key].add(cb);
    return () => { listeners[key].delete(cb); };
  },
};

/** 側欄圖層 key → 計數 key（只有這幾層有即時計數） */
const LAYER_TO_COUNT: Partial<Record<string, LiveCountKey>> = {
  flights: "flights",
  rail: "trains",
  busLive: "buses",
  busIntercityLive: "busesIntercity",
};

const noopSubscribe = () => () => {};
const getUndefined = () => undefined;

// 每個 key 一組穩定的 subscribe / getSnapshot（useSyncExternalStore 要求身分穩定才不重訂）
const accessors = new Map<LiveCountKey, { subscribe: (cb: () => void) => () => void; get: () => number }>();
function accessorFor(key: LiveCountKey) {
  let a = accessors.get(key);
  if (!a) {
    a = { subscribe: (cb) => liveCountStore.subscribe(key, cb), get: () => liveCountStore.get(key) };
    accessors.set(key, a);
  }
  return a;
}

/**
 * 側欄 row 用：該圖層有即時計數時回傳目前數字（per-key 訂閱，只重渲這一個 row），
 * 否則回傳 undefined（不訂閱、不重渲）。
 */
export function useLayerLiveCount(layerKey: string): number | undefined {
  const countKey = LAYER_TO_COUNT[layerKey];
  const a = countKey ? accessorFor(countKey) : null;
  return useSyncExternalStore<number | undefined>(
    a ? a.subscribe : noopSubscribe,
    a ? a.get : getUndefined,
  );
}
