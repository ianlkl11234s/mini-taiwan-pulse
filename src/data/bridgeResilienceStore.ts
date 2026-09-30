import { useSyncExternalStore } from "react";
import type { BridgeResilienceData } from "./bridgeResilienceTypes";

/**
 * 橋梁韌性圖層的兩個跨元件小狀態（模組級 store，useSyncExternalStore 訂閱）：
 * - selection：被點選的橋名。popup 面板掛載時寫入、卸載時清除，hook 據此高亮／上色／畫替代路線。
 * - data：私人 JSON（summary＋impacts）。只由 hook 在站主驗證通過後寫入；失去權限時清空。
 * 模式、村里、路線、聯合等開關是圖層參數（layerParamsStore），這裡不重複存。
 */
type Listener = () => void;
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) { if (Object.is(next, value)) return; value = next; listeners.forEach((l) => l()); },
    subscribe(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

const selectionStore = createStore<string | null>(null);
const dataStore = createStore<BridgeResilienceData | null>(null);

export const bridgeResilienceSelection = {
  get: selectionStore.get,
  select: (uid: string) => selectionStore.set(uid),
  clear: () => selectionStore.set(null),
  subscribe: selectionStore.subscribe,
};
export const bridgeResilienceDataStore = {
  get: dataStore.get,
  set: (data: BridgeResilienceData | null) => dataStore.set(data),
  subscribe: dataStore.subscribe,
};

export const useBridgeResilienceSelection = () => useSyncExternalStore(selectionStore.subscribe, selectionStore.get, selectionStore.get);
export const useBridgeResilienceData = () => useSyncExternalStore(dataStore.subscribe, dataStore.get, dataStore.get);
