/**
 * 目前的國家主體（議題 1「國家主體化」）。圖層面板與統計面板共用同一份，桌機 rail 與手機底部面板也共用；
 * 任一處改國家，其他訂閱者跟著變。刻意不存 localStorage：初始值只看網址（`resolveInitialCountry`）。
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_COUNTRY, countryForPoint, type CountryCode } from "../constants/countries";

type Listener = () => void;

let country: CountryCode = DEFAULT_COUNTRY;
const listeners = new Set<Listener>();

/**
 * 初始國家：網址 `c=` → 網址相機中心所屬國 → （網址沒有相機時）第一個國家圖層所屬國 → 台灣。
 * 舊的日本分享連結因此開成日本；手寫的 `?layers=jpStations` 也開成日本。
 */
export function resolveInitialCountry(
  urlCountry: CountryCode | undefined,
  camera: { center: [number, number] } | undefined,
  layerCountry?: CountryCode,
): CountryCode {
  if (urlCountry) return urlCountry;
  if (camera) return countryForPoint(camera.center[0], camera.center[1]) ?? DEFAULT_COUNTRY;
  return layerCountry ?? DEFAULT_COUNTRY;
}

export const countryStore = {
  getSnapshot(): CountryCode {
    return country;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  set(next: CountryCode): void {
    if (next === country) return;
    country = next;
    for (const listener of listeners) listener();
  },

  /** 測試用：回到台灣。 */
  reset(): void {
    this.set(DEFAULT_COUNTRY);
  },
};

export function useCountry(): CountryCode {
  return useSyncExternalStore(countryStore.subscribe, countryStore.getSnapshot, countryStore.getSnapshot);
}
