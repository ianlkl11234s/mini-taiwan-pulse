/**
 * 雙北國道逐車模擬：模組級狀態（不進 React state，避免隨時間 re-render）。
 * - data：解碼後資料（loader 完成後寫入）。
 * - heads：custom layer 每次 render 算出的車頭位置，點選用（同一份陣列重複使用）。
 * - follow：跟隨中的趟序號；圖例與說明框以 useSyncExternalStore 訂閱。
 * - status：圖層狀態（載入錯誤、在不在資料時段、在路上台數、fps），圖例節流顯示。
 */
import type { Map as MapboxMap } from "mapbox-gl";
import type { FreewayTdcsData } from "./freewayTdcsSimModel";
import {
  FREEWAY_TDCS_FLAG_ENTER_BOUNDARY, FREEWAY_TDCS_FLAG_EXIT_BOUNDARY, FREEWAY_TDCS_FLAG_SERVICE_BREAK, FREEWAY_TDCS_SPEED_CUSTOM_DEFAULT,
  FREEWAY_TDCS_VT_COLORS, FREEWAY_TDCS_VT_NAMES,
} from "./freewayTdcsSimTypes";

type Listener = () => void;

let data: FreewayTdcsData | null = null;
export function freewayTdcsData(): FreewayTdcsData | null { return data; }
export function setFreewayTdcsData(d: FreewayTdcsData | null): void { data = d; }

// ── 車頭（點選用） ──
export interface FreewayTdcsHeads { lng: Float64Array; lat: Float64Array; trip: Uint32Array; seg: Uint32Array; n: number }
let heads: FreewayTdcsHeads = { lng: new Float64Array(0), lat: new Float64Array(0), trip: new Uint32Array(0), seg: new Uint32Array(0), n: 0 };
export function setFreewayTdcsHeads(h: FreewayTdcsHeads): void { heads = h; }

/** 點選：找畫面上距離點擊位置最近的車（像素門檻內） */
export function pickFreewayTdcsCar(map: MapboxMap, x: number, y: number, maxPx = 10): Record<string, unknown> | null {
  if (!data || heads.n === 0) return null;
  let best = -1, bestD = maxPx * maxPx;
  const b = map.getBounds();
  for (let i = 0; i < heads.n; i++) {
    const lng = heads.lng[i]!, lat = heads.lat[i]!;
    if (b && (lng < b.getWest() || lng > b.getEast() || lat < b.getSouth() || lat > b.getNorth())) continue;
    const p = map.project([lng, lat]);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return null;
  return freewayTdcsTripProps(heads.trip[best]!);
}

export function freewayTdcsTripProps(trip: number): Record<string, unknown> | null {
  if (!data) return null;
  const fl = data.flags[trip]!;
  return {
    trip,
    vehicle_type: FREEWAY_TDCS_VT_NAMES[data.vt[trip]!] ?? null,
    vt_index: data.vt[trip]!,
    on_ic: data.meta.names[data.on[trip]!] ?? null,
    off_ic: data.meta.names[data.off[trip]!] ?? null,
    on_outside: !!(fl & FREEWAY_TDCS_FLAG_ENTER_BOUNDARY),
    off_outside: !!(fl & FREEWAY_TDCS_FLAG_EXIT_BOUNDARY),
    service_break: !!(fl & FREEWAY_TDCS_FLAG_SERVICE_BREAK),
    avg_speed_kmh: data.spd[trip]!,
  };
}

// ── 跟隨 ──
let followTrip: number | null = null;
const followListeners = new Set<Listener>();
export function freewayTdcsFollowTrip(): number | null { return followTrip; }
export function setFreewayTdcsFollow(trip: number | null): void {
  if (followTrip === trip) return;
  followTrip = trip;
  for (const cb of followListeners) cb();
}
export function subscribeFreewayTdcsFollow(cb: Listener): () => void {
  followListeners.add(cb);
  return () => { followListeners.delete(cb); };
}

// ── 狀態（圖例顯示） ──
export interface FreewayTdcsStatus { state: "idle" | "loading" | "ready" | "error"; active: number; fps: number }
let status: FreewayTdcsStatus = { state: "idle", active: 0, fps: 0 };
const statusListeners = new Set<Listener>();
export function freewayTdcsStatus(): FreewayTdcsStatus { return status; }
export function setFreewayTdcsStatus(patch: Partial<FreewayTdcsStatus>): void {
  const next = { ...status, ...patch };
  if (next.state === status.state && next.active === status.active && next.fps === status.fps) return;
  status = next;
  for (const cb of statusListeners) cb();
}
export function subscribeFreewayTdcsStatus(cb: Listener): () => void {
  statusListeners.add(cb);
  return () => { statusListeners.delete(cb); };
}

// ── 跟隨結束原因（圖例顯示；i18n key 尾碼 legend.freewayTdcsSim.followEnd.<code>） ──
export type FreewayTdcsFollowEndCode = "window" | "before" | "service" | "exited";
let followEndMsg: { code: FreewayTdcsFollowEndCode; at: number } | null = null;
const followEndListeners = new Set<Listener>();
export function freewayTdcsFollowEndMsg(): { code: FreewayTdcsFollowEndCode; at: number } | null { return followEndMsg; }
export function setFreewayTdcsFollowEndMsg(code: FreewayTdcsFollowEndCode | null): void {
  followEndMsg = code ? { code, at: Date.now() } : null;
  for (const cb of followEndListeners) cb();
}
export function subscribeFreewayTdcsFollowEndMsg(cb: Listener): () => void {
  followEndListeners.add(cb);
  return () => { followEndListeners.delete(cb); };
}

// ── 自訂顏色（使用者自選；圖層自己的 store＋localStorage，沒有對應的 param kind） ──
/**
 * 正式站先不開放自訂色（使用者 2026-11 決定）：只在開發模式（import.meta.env.DEV）可用。
 * 正式 build 的 getter 一律回預設色，localStorage 裡留下的舊值也不會被讀。
 */
export const FREEWAY_TDCS_CUSTOM_COLORS_ENABLED: boolean = import.meta.env.DEV;
export type FreewayTdcsSpeedPalette = "viridis" | "custom";
export interface FreewayTdcsColors {
  speedPalette: FreewayTdcsSpeedPalette;
  /** 自訂三色：慢（≤ 20 km/h）、中（50）、快（≥ 90） */
  speedCustom: [string, string, string];
  /** 自訂車種五色（順序同 FREEWAY_TDCS_VT_NAMES） */
  typeColors: [string, string, string, string, string];
}
const COLORS_KEY = "pulse.freewayTdcsSim.colors.v1";
export const FREEWAY_TDCS_DEFAULT_COLORS: FreewayTdcsColors = {
  speedPalette: "viridis",
  speedCustom: [...FREEWAY_TDCS_SPEED_CUSTOM_DEFAULT],
  typeColors: [...FREEWAY_TDCS_VT_COLORS],
};
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
function loadColors(): FreewayTdcsColors {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(COLORS_KEY) : null;
    if (!raw) return FREEWAY_TDCS_DEFAULT_COLORS;
    const v = JSON.parse(raw) as Partial<FreewayTdcsColors>;
    return {
      speedPalette: v.speedPalette === "custom" ? "custom" : "viridis",
      speedCustom: Array.isArray(v.speedCustom) && v.speedCustom.length === 3 && v.speedCustom.every(isHex)
        ? (v.speedCustom as FreewayTdcsColors["speedCustom"]) : FREEWAY_TDCS_DEFAULT_COLORS.speedCustom,
      typeColors: Array.isArray(v.typeColors) && v.typeColors.length === 5 && v.typeColors.every(isHex)
        ? (v.typeColors as FreewayTdcsColors["typeColors"]) : FREEWAY_TDCS_DEFAULT_COLORS.typeColors,
    };
  } catch { return FREEWAY_TDCS_DEFAULT_COLORS; }
}
let colors: FreewayTdcsColors = import.meta.env.DEV ? loadColors() : FREEWAY_TDCS_DEFAULT_COLORS;
let colorsVersion = 0;
const colorListeners = new Set<Listener>();
export function freewayTdcsColors(): FreewayTdcsColors {
  return FREEWAY_TDCS_CUSTOM_COLORS_ENABLED ? colors : FREEWAY_TDCS_DEFAULT_COLORS;
}
export function freewayTdcsColorsVersion(): number { return colorsVersion; }
export function setFreewayTdcsColors(patch: Partial<FreewayTdcsColors> | null): void {
  if (!FREEWAY_TDCS_CUSTOM_COLORS_ENABLED) return;
  colors = patch ? { ...colors, ...patch } : FREEWAY_TDCS_DEFAULT_COLORS;
  colorsVersion++;
  try { localStorage.setItem(COLORS_KEY, JSON.stringify(colors)); } catch { /* 無痕或配額滿：只留在記憶體 */ }
  for (const cb of colorListeners) cb();
}
export function subscribeFreewayTdcsColors(cb: Listener): () => void {
  colorListeners.add(cb);
  return () => { colorListeners.delete(cb); };
}
