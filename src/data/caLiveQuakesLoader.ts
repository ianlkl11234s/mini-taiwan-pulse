// 加拿大即時地震：瀏覽器直連 NRCan FDSN event 服務（CORS `*`），比照 JMA 上游直連層（docs/features/jma-live-layers §P5）：
// 不入我們的 DB／R2／分析倉庫（DISPLAY_ONLY）。只取「現在往前 30 天」快照，不跟時間軸；狀態 store 給圖例顯示筆數、最新事件與錯誤。

import { withLoading } from "../lib/loadingRegistry";
import { CA_QUAKE_LIVE_DAYS, CA_QUAKE_LIVE_QUERY_URL } from "./caEnvTypes";

export type CaQuakeLiveType = "earthquake" | "industry" | "mining" | "blast";

export interface CaQuakeLiveStatus {
  state: "idle" | "loading" | "ready" | "error";
  count: number;
  /** 最新一筆事件時間（ISO，UTC）；無事件為 null */
  latest: string | null;
  /** 這份快照的抓取時間（ISO） */
  fetchedAt: string | null;
  error: string | null;
}

/** 事件地名「英文/法文」取英文段：斜線數為奇數時取前半（少數地名本身含斜線）。 */
export function caQuakePlaceEn(name: string): string {
  const parts = name.split("/");
  if (parts.length < 2 || parts.length % 2 !== 0) return name.trim();
  return parts.slice(0, parts.length / 2).join("/").trim();
}

/** 依英文地名前綴關鍵字分類（Blast／Quarry blast／Suspected blast → 爆破；Mining… → 礦場；…industry-related → 產業）。 */
export function caQuakeEventType(placeEn: string): CaQuakeLiveType {
  if (/\bblast\b/i.test(placeEn)) return "blast";
  if (/\bmining\b/i.test(placeEn)) return "mining";
  if (/industry-related/i.test(placeEn)) return "industry";
  return "earthquake";
}

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** FDSN `format=text`（`#EventID|Time|Latitude|Longitude|Depth/km|MagType|Magnitude|EventLocationName`）→ GeoJSON；欄數或座標不對的列略過。 */
export function parseCaQuakeText(text: string): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const c = line.split("|");
    if (c.length < 8) continue;
    const lat = num(c[2]);
    const lng = num(c[3]);
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const name = c.slice(7).join("|");
    const place = caQuakePlaceEn(name);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        event_id: c[0]!.trim(),
        time_utc: c[1]!.trim().replace(/\.000Z$/, "Z"),
        depth_km: num(c[4]),
        mag_type: c[5]!.trim() || null,
        magnitude: num(c[6]),
        place,
        place_raw: name.trim(),
        event_type: caQuakeEventType(place),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function caQuakeLiveUrl(nowMs: number, days = CA_QUAKE_LIVE_DAYS): string {
  const start = new Date(nowMs - days * 86_400_000).toISOString().slice(0, 19);
  return `${CA_QUAKE_LIVE_QUERY_URL}?starttime=${start}&format=text`;
}

// ── 狀態 store（圖例用 useSyncExternalStore 讀） ──

let status: CaQuakeLiveStatus = { state: "idle", count: 0, latest: null, fetchedAt: null, error: null };
const listeners = new Set<() => void>();
const setStatus = (next: CaQuakeLiveStatus) => { status = next; listeners.forEach((l) => l()); };
export const caQuakeLiveStatus = {
  get: () => status,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** 抓最近 30 天；204（無事件）＝空集合；失敗丟錯並寫進狀態（呼叫端清空 source，不留舊資料）。 */
export async function fetchCaQuakesLive(nowMs = Date.now()): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  setStatus({ ...status, state: "loading", error: null });
  try {
    const res = await withLoading("ca-earthquakes-live", "加拿大即時地震", fetch(caQuakeLiveUrl(nowMs), { cache: "no-cache" }));
    if (res.status !== 200 && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    const fc = res.status === 204 ? { type: "FeatureCollection" as const, features: [] } : parseCaQuakeText(await res.text());
    const latest = fc.features.reduce<string | null>((m, f) => {
      const t = String(f.properties?.time_utc ?? "");
      return t && (!m || t > m) ? t : m;
    }, null);
    setStatus({ state: "ready", count: fc.features.length, latest, fetchedAt: new Date(nowMs).toISOString(), error: null });
    return fc;
  } catch (e) {
    setStatus({ state: "error", count: 0, latest: null, fetchedAt: new Date(nowMs).toISOString(), error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
