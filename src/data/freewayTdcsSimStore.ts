/**
 * 雙北國道逐車模擬：模組級狀態（不進 React state，避免隨時間 re-render）。
 * - data：解碼後資料（loader 完成後寫入）。
 * - heads：custom layer 每次 render 算出的車頭位置，點選用（同一份陣列重複使用）。
 * - follow：跟隨中的趟序號；圖例與說明框以 useSyncExternalStore 訂閱。
 * - status：圖層狀態（載入錯誤、在不在資料時段、在路上台數、fps），圖例節流顯示。
 */
import type { Map as MapboxMap } from "mapbox-gl";
import type { FreewayTdcsData } from "./freewayTdcsSimModel";
import { FREEWAY_TDCS_FLAG_ENTER_BOUNDARY, FREEWAY_TDCS_FLAG_EXIT_BOUNDARY, FREEWAY_TDCS_FLAG_SERVICE_BREAK, FREEWAY_TDCS_VT_NAMES } from "./freewayTdcsSimTypes";

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
