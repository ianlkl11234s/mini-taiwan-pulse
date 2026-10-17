import { useSyncExternalStore } from "react";
import type { BridgeResilienceData, VillageDestinations } from "./bridgeResilienceTypes";

/**
 * 橋梁韌性圖層的兩個跨元件小狀態（模組級 store，useSyncExternalStore 訂閱）：
 * - selection：被點選的橋名。popup 面板掛載時寫入、卸載時清除，hook 據此高亮／上色／畫替代路線。
 * - data：私人 JSON（summary＋impacts）。只由 hook 在站主驗證通過後寫入；失去權限時清空。
 * - origin：目的地視角的起點村里（VILLCODE）。選橋後點村里寫入；換橋、關閉面板、點地圖空白處、關閉村里都會清除。
 *   它不影響橋的選取：清 origin 只是「回到起點視角」。
 * - destinations：village_destinations.json（6.4 MB）。第一次進入目的地視角才懶載入，失去權限時清空。
 * 模式、村里、路線、聯合等開關是圖層參數（layerParamsStore），這裡不重複存。
 */
export type DestinationStatus = "idle" | "loading" | "error";
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
const originStore = createStore<string | null>(null);
const destinationsStore = createStore<VillageDestinations | null>(null);
const destinationStatusStore = createStore<DestinationStatus>("idle");

export const bridgeResilienceSelection = {
  get: selectionStore.get,
  /** 換一座橋會結束目的地視角（起點屬於上一座橋的情境）；同一座橋重選不動 origin。 */
  select: (uid: string) => { if (selectionStore.get() !== uid) originStore.set(null); selectionStore.set(uid); },
  clear: () => { originStore.set(null); selectionStore.set(null); },
  subscribe: selectionStore.subscribe,
};
export const bridgeResilienceDataStore = {
  get: dataStore.get,
  set: (data: BridgeResilienceData | null) => dataStore.set(data),
  subscribe: dataStore.subscribe,
};

export const bridgeResilienceOrigin = {
  get: originStore.get,
  set: (code: string) => originStore.set(code),
  /** 回到起點視角：只清起點，橋維持選取。 */
  clear: () => originStore.set(null),
  subscribe: originStore.subscribe,
};
export const bridgeResilienceDestinationsStore = {
  get: destinationsStore.get,
  set: (data: VillageDestinations | null) => destinationsStore.set(data),
  subscribe: destinationsStore.subscribe,
};

export const bridgeResilienceDestinationStatus = {
  get: destinationStatusStore.get,
  set: (status: DestinationStatus) => destinationStatusStore.set(status),
  subscribe: destinationStatusStore.subscribe,
};

export const useBridgeResilienceSelection = () => useSyncExternalStore(selectionStore.subscribe, selectionStore.get, selectionStore.get);
export const useBridgeResilienceData = () => useSyncExternalStore(dataStore.subscribe, dataStore.get, dataStore.get);
export const useBridgeResilienceOrigin = () => useSyncExternalStore(originStore.subscribe, originStore.get, originStore.get);
export const useBridgeResilienceDestinations = () => useSyncExternalStore(destinationsStore.subscribe, destinationsStore.get, destinationsStore.get);
export const useBridgeResilienceDestinationStatus = () => useSyncExternalStore(destinationStatusStore.subscribe, destinationStatusStore.get, destinationStatusStore.get);
