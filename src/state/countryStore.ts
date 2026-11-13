/**
 * 目前的國家主體（議題 1「國家主體化」）。圖層面板與統計面板共用同一份，桌機 rail 與手機底部面板也共用；
 * 任一處改國家，其他訂閱者跟著變。刻意不存 localStorage：初始值只看網址（`resolveInitialCountry`）。
 */
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_COUNTRY, countryForPoint, countryForViewer, visibleCountries, type CountryCode, type CountryDef } from "../constants/countries";

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

// ── 站主限定國家（2026-11-13 中國）────────────────────────────
// App 依 tier 回報「目前是不是站主」；國家選單與圖層面板的國家清單只列看得到的國家。
// tier 載入完成前（loading）不退回，避免站主開中國網址時先被踢回台灣。
let viewerIsOwner = false;
const viewerListeners = new Set<Listener>();

export const countryViewer = {
  getSnapshot(): boolean {
    return viewerIsOwner;
  },
  subscribe(listener: Listener): () => void {
    viewerListeners.add(listener);
    return () => viewerListeners.delete(listener);
  },
  set(isOwner: boolean): void {
    if (isOwner === viewerIsOwner) return;
    viewerIsOwner = isOwner;
    for (const listener of viewerListeners) listener();
  },
};

/** 目前身分看得到的國家（國家選單、面板跨國搜尋用）。 */
export function useVisibleCountries(): readonly CountryDef[] {
  const isOwner = useSyncExternalStore(countryViewer.subscribe, countryViewer.getSnapshot, countryViewer.getSnapshot);
  return visibleCountries(isOwner);
}

/** App 呼叫：同步站主身分；非站主（tier 已載入）停在站主限定國家時退回台灣（網址 `c=cn`、鏡頭中心在中國）。 */
export function useOwnerOnlyCountryGuard(isOwner: boolean, loading: boolean): void {
  const current = useCountry();
  useEffect(() => {
    countryViewer.set(isOwner);
  }, [isOwner]);
  useEffect(() => {
    if (loading) return;
    const next = countryForViewer(current, isOwner);
    if (next !== current) countryStore.set(next);
  }, [current, isOwner, loading]);
}
