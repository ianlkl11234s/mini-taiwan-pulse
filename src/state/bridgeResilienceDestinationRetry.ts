import { useSyncExternalStore } from "react";
import { bridgeResilienceDestinationStatus, bridgeResilienceOrigin } from "../data/bridgeResilienceStore";

/**
 * 目的地資料載入失敗後的「再點同一個村里」重試觸發。
 * 起點 store 對相同值用 Object.is 抑制通知，失敗後 effect 依賴不變、不會重載；
 * 這裡用一個遞增 nonce 讓 hook 把它放進 deps 重新發請求。
 */
let nonce = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const get = () => nonce;
export const bridgeResilienceDestinationRetryNonce = get;

/** 點村里：同一個起點且上次載入失敗＝重試；否則照常設定起點。 */
export function selectBridgeResilienceOrigin(code: string): void {
  if (bridgeResilienceOrigin.get() === code && bridgeResilienceDestinationStatus.get() === "error") {
    nonce += 1;
    listeners.forEach((listener) => listener());
    return;
  }
  bridgeResilienceOrigin.set(code);
}

export const useBridgeResilienceDestinationRetry = () => useSyncExternalStore(subscribe, get, get);
