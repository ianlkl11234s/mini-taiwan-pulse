/**
 * 目前的國家主體（議題 1「國家主體化」）。圖層面板與統計面板共用同一份，桌機 rail 與手機底部面板也共用；
 * 任一處改國家，其他訂閱者跟著變。「目前國家」刻意不存 localStorage：初始值只看網址（`resolveInitialCountry`）。
 * 釘選清單（`pinnedCountries`）與各國上次鏡頭（`countryCameraMemory`）是使用者偏好，才存 localStorage。
 */
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_COUNTRY, countryDef, countryForPoint, countryForViewer, isCountryCode, visibleCountries, type CountryCamera, type CountryCode, type CountryDef } from "../constants/countries";

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

// ── 釘選國家（G1-a，2026-11-24）────────────────────────────────
// 國家選單上方的 chip 列；最多 MAX_PINNED 國、依釘選順序；並排地圖（G2-1）以此為候選清單。
// 清單可能含站主限定國家（站主釘過後降級）；顯示端用 `useVisibleCountries` 過濾，這裡不知道身分。
/** 飛向國家的方式：`default`＝國家預設鏡頭（選單選國家）；`remembered`＝該國上次的鏡頭（點釘選 chip）。 */
export type CountryFlyMode = "default" | "remembered";

export const MAX_PINNED = 3;
export const PINNED_STORAGE_KEY = "pulse.pinnedCountries.v1";
export const CAMERA_MEMORY_STORAGE_KEY = "pulse.countryCameras.v1";

function readStorage(key: string): unknown {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 無痕模式／額度滿：只當這次不記住
  }
}

/** 讀取時驗證：陣列、合法國碼、去重、截到上限；其餘丟棄。 */
export function parsePinned(value: unknown): CountryCode[] {
  if (!Array.isArray(value)) return [];
  const out: CountryCode[] = [];
  for (const item of value) {
    if (isCountryCode(item) && !out.includes(item)) out.push(item);
    if (out.length >= MAX_PINNED) break;
  }
  return out;
}

/** 驗證單一鏡頭：座標、縮放、傾斜、旋轉都要是有限數且在合理範圍；不合格回 undefined。 */
export function parseCamera(value: unknown): CountryCamera | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { center, zoom, pitch, bearing } = value as Record<string, unknown>;
  if (!Array.isArray(center) || center.length !== 2) return undefined;
  const [lng, lat] = center;
  const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  if (!num(lng) || !num(lat) || !num(zoom) || !num(pitch) || !num(bearing)) return undefined;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90 || zoom < 0 || zoom > 24 || pitch < 0 || pitch > 85) return undefined;
  return { center: [lng, lat], zoom, pitch, bearing };
}

export function parseCameraMemory(value: unknown): Partial<Record<CountryCode, CountryCamera>> {
  const out: Partial<Record<CountryCode, CountryCamera>> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;
  for (const [code, raw] of Object.entries(value)) {
    if (!isCountryCode(code)) continue;
    const camera = parseCamera(raw);
    if (camera) out[code] = camera;
  }
  return out;
}

let pinned: readonly CountryCode[] = [];
let pinnedLoaded = false;
const pinnedListeners = new Set<Listener>();

function loadPinned(): void {
  if (pinnedLoaded) return;
  pinnedLoaded = true;
  pinned = parsePinned(readStorage(PINNED_STORAGE_KEY));
}

function commitPinned(next: readonly CountryCode[]): void {
  pinned = next;
  writeStorage(PINNED_STORAGE_KEY, next);
  for (const listener of pinnedListeners) listener();
}

export const pinnedCountries = {
  /** 依釘選順序的國碼清單（參照穩定，變動時才換新陣列）。 */
  getSnapshot(): readonly CountryCode[] {
    loadPinned();
    return pinned;
  },
  subscribe(listener: Listener): () => void {
    pinnedListeners.add(listener);
    return () => pinnedListeners.delete(listener);
  },
  isPinned(code: CountryCode): boolean {
    return this.getSnapshot().includes(code);
  },
  /**
   * 釘選到清單尾端；已釘或已滿回 false。
   * 傳 `accessible`（目前身分看得到的國家）時，看不到的舊釘選（站主登出後的中國）不佔名額，並在這次寫入時一併清掉，
   * 否則選單顯示還有空位卻永遠釘不進去。
   */
  pin(code: CountryCode, accessible?: readonly CountryCode[]): boolean {
    const stored = this.getSnapshot();
    const list = accessible ? stored.filter((c) => accessible.includes(c)) : stored;
    if (list.includes(code) || list.length >= MAX_PINNED) return false;
    commitPinned([...list, code]);
    return true;
  },
  unpin(code: CountryCode): void {
    const list = this.getSnapshot();
    if (list.includes(code)) commitPinned(list.filter((c) => c !== code));
  },
  /** 已釘則取消，否則嘗試釘選；回傳操作後是否為釘選狀態。 */
  toggle(code: CountryCode, accessible?: readonly CountryCode[]): boolean {
    if (this.isPinned(code)) {
      this.unpin(code);
      return false;
    }
    return this.pin(code, accessible);
  },
  /** 測試用：清空記憶體狀態，下次讀取重新從 localStorage 載入（不動 localStorage）。 */
  resetForTest(): void {
    pinned = [];
    pinnedLoaded = false;
    for (const listener of pinnedListeners) listener();
  },
};

export function usePinnedCountries(): readonly CountryCode[] {
  return useSyncExternalStore(pinnedCountries.subscribe, pinnedCountries.getSnapshot, pinnedCountries.getSnapshot);
}

// ── 各國上次鏡頭 ────────────────────────────────────────────────
let cameras: Partial<Record<CountryCode, CountryCamera>> = {};
let camerasLoaded = false;

function loadCameras(): void {
  if (camerasLoaded) return;
  camerasLoaded = true;
  cameras = parseCameraMemory(readStorage(CAMERA_MEMORY_STORAGE_KEY));
}

export const countryCameraMemory = {
  /** 該國上次的鏡頭；沒記錄回 undefined。 */
  get(code: CountryCode): CountryCamera | undefined {
    loadCameras();
    return cameras[code];
  },
  /** 飛向該國用：有記錄用記錄，否則國家預設鏡頭。 */
  resolve(code: CountryCode): CountryCamera {
    return this.get(code) ?? countryDef(code).camera;
  },
  /**
   * 記錄鏡頭。只在鏡頭中心真的落在該國 bbox 內才記（使用者拖到別國但面板還停在原國時，不污染原國的記錄）；
   * 不合法的鏡頭丟棄。回傳是否有記。
   */
  record(code: CountryCode, camera: CountryCamera): boolean {
    loadCameras();
    // map.getCenter() 換世界副本時 lng 會超出 ±180：先折回再驗證，否則整筆被丟棄
    const lng = camera.center[0];
    const folded = Number.isFinite(lng) && Math.abs(lng) > 180 ? ((((lng + 180) % 360) + 360) % 360) - 180 : lng;
    const valid = parseCamera({ ...camera, center: [folded, camera.center[1]] });
    if (!valid || countryForPoint(valid.center[0], valid.center[1]) !== code) return false;
    cameras = { ...cameras, [code]: valid };
    writeStorage(CAMERA_MEMORY_STORAGE_KEY, cameras);
    return true;
  },
  /** 測試用：清空記憶體狀態，下次讀取重新從 localStorage 載入。 */
  resetForTest(): void {
    cameras = {};
    camerasLoaded = false;
  },
};
