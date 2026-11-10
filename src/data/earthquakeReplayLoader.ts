import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, keyedThunkCache } from "../lib/loaderCache";
import { IMAGERY_CDN_BASE } from "./imageryManifestLoader";
import {
  S_WAVE_KM_S,
  eventTier,
  haversineKm,
  townCodeToPmtilesCode,
  type EarthquakeReplayEvent,
  type EqReplayDetail,
  type EqReplayGridCell,
  type EqReplayStation,
  type EqReplayTensor,
  type EqReplayTown,
} from "./earthquakeReplayTypes";

/**
 * 地震回放 loader — 清單 RPC + 四種明細。
 *
 * ⚠️ 明細一律用 RPC 給的 key **等值查詢**（±90s / ±5s 時間窗配對已做在 DB 端）。
 * 清單 15min TTL 快取、明細 per-event 快取（切回同一起地震不重打 DB）。
 * 震度網格（2026-11-09 起）讀 R2 事件檔 `events/shakemap/<UTC>.json`，以 index.json ±90s 配對；
 * R2 沒有對應事件（或 index 讀取失敗）才退回 DB `earthquake_shakemap_grid`。
 * 全部包 withLoading（開發規則 §2）。
 */

// ── 事件清單 ────────────────────────────────────────────────────────

interface RawEventRow {
  event_id: string;
  occurred_at: string;
  magnitude: number | null;
  depth_km: number | null;
  epicenter_lat: number | null;
  epicenter_lng: number | null;
  location: string | null;
  station_count: number | null;
  has_town: boolean | null;
  town_origin_time: string | null;
  has_grid: boolean | null;
  grid_event_time: string | null;
  has_tensor: boolean | null;
  tensor_origin_utc: string | null;
}

// ── R2 震度圖事件檔 ────────────────────────────────────────────────

export const SHAKEMAP_INDEX_URL = `${IMAGERY_CDN_BASE}/events/shakemap/index.json`;
/** 與 earthquake_replay_events() 的 grid 配對時間窗相同 */
export const SHAKEMAP_MATCH_WINDOW_MS = 90_000;

export interface ShakemapIndexEntry {
  event_time: string;
  key: string;
}

/** 找 occurred_at ±90s 內最近的 R2 事件檔；沒有回 null */
export function matchShakemapIndex(
  occurredAt: string,
  entries: readonly ShakemapIndexEntry[],
): ShakemapIndexEntry | null {
  const t = Date.parse(occurredAt);
  if (!Number.isFinite(t)) return null;
  let best: ShakemapIndexEntry | null = null;
  let bestDiff = Infinity;
  for (const e of entries) {
    const diff = Math.abs(Date.parse(e.event_time) - t);
    if (diff <= SHAKEMAP_MATCH_WINDOW_MS && diff < bestDiff) {
      best = e;
      bestDiff = diff;
    }
  }
  return best;
}

/** index 讀取失敗回 null（呼叫端退回 RPC 的 has_grid），不讓整個清單失敗 */
async function fetchShakemapIndex(): Promise<ShakemapIndexEntry[] | null> {
  try {
    const json = await withLoading(
      "earthquake-shakemap-index",
      "地震回放 震度圖清單",
      (async () => {
        const res = await fetch(SHAKEMAP_INDEX_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { events?: unknown };
      })(),
    );
    if (!Array.isArray(json.events)) throw new Error("index.json 缺 events");
    return (json.events as Record<string, unknown>[])
      .filter((e) => typeof e.event_time === "string" && typeof e.key === "string")
      .map((e) => ({ event_time: e.event_time as string, key: e.key as string }));
  } catch (err) {
    console.warn("[earthquakeReplay] R2 震度圖清單讀取失敗，改用 DB 配對", err);
    return null;
  }
}

async function fetchReplayEventsUncached(): Promise<EarthquakeReplayEvent[]> {
  const [{ data, error }, shakemapIndex] = await Promise.all([
    withLoading(
      "earthquake-replay-events",
      "地震回放事件清單",
      supabase.rpc("earthquake_replay_events"),
    ),
    fetchShakemapIndex(),
  ]);
  if (error) throw new Error(`Supabase earthquake_replay_events: ${error.message}`);

  const rows = (data ?? []) as RawEventRow[];
  const out: EarthquakeReplayEvent[] = [];
  for (const r of rows) {
    if (r.epicenter_lat == null || r.epicenter_lng == null) continue;
    const r2Grid = shakemapIndex ? matchShakemapIndex(r.occurred_at, shakemapIndex) : null;
    out.push({
      event_id: r.event_id,
      occurred_at: r.occurred_at,
      magnitude: Number(r.magnitude ?? 0),
      depth_km: Number(r.depth_km ?? 0),
      epicenter_lat: Number(r.epicenter_lat),
      epicenter_lng: Number(r.epicenter_lng),
      location: r.location ?? "",
      station_count: Number(r.station_count ?? 0),
      has_town: r.has_town === true,
      town_origin_time: r.town_origin_time,
      has_grid: r2Grid != null || r.has_grid === true,
      grid_event_time: r2Grid?.event_time ?? r.grid_event_time,
      grid_key: r2Grid?.key ?? null,
      has_tensor: r.has_tensor === true,
      tensor_origin_utc: r.tensor_origin_utc,
    });
  }
  return out;
}

const fetchReplayEventsCached = cachedOnce(fetchReplayEventsUncached, 15 * 60_000);

/** 有回放素材的地震清單（新→舊）。15min TTL，重複開圖層不重抓。 */
export function fetchReplayEvents(): Promise<EarthquakeReplayEvent[]> {
  return fetchReplayEventsCached();
}

// ── 明細（測站 / 鄉鎮 / 網格 / 機制解）─────────────────────────────

async function fetchStations(ev: EarthquakeReplayEvent): Promise<EqReplayStation[]> {
  const { data, error } = await withLoading(
    `eq-replay-stations:${ev.event_id}`,
    `地震回放 測站 ${ev.event_id}`,
    supabase
      .from("earthquake_station_obs")
      .select("station_id, lat, lon, epicenter_distance_km, intensity_value, pga_int")
      .eq("event_id", ev.event_id)
      .order("epicenter_distance_km"),
  );
  if (error) throw new Error(`Supabase earthquake_station_obs: ${error.message}`);
  const out: EqReplayStation[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const dist = Number(r.epicenter_distance_km ?? 0);
    out.push({
      station_id: String(r.station_id ?? ""),
      lat,
      lon,
      epicenter_distance_km: dist,
      intensity_value: Number(r.intensity_value ?? 0),
      pga_int: Number(r.pga_int ?? 0),
      arrivalSec: dist / S_WAVE_KM_S,
    });
  }
  return out;
}

async function fetchTowns(ev: EarthquakeReplayEvent): Promise<EqReplayTown[]> {
  if (!ev.has_town || !ev.town_origin_time) return [];
  const { data, error } = await withLoading(
    `eq-replay-towns:${ev.event_id}`,
    `地震回放 鄉鎮震度 ${ev.event_id}`,
    supabase
      .from("earthquake_town_intensity")
      .select("town_code, town_name, county_name, intensity, intensity_value")
      .eq("origin_time", ev.town_origin_time),
  );
  if (error) throw new Error(`Supabase earthquake_town_intensity: ${error.message}`);
  const out: EqReplayTown[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const code = String(r.town_code ?? "");
    if (!code) continue;
    out.push({
      town_code: code,
      town_name: String(r.town_name ?? ""),
      county_name: String(r.county_name ?? ""),
      intensity: String(r.intensity ?? ""),
      intensity_value: Number(r.intensity_value ?? 0),
      pmtilesCode: townCodeToPmtilesCode(code),
    });
  }
  return out;
}

/** R2 事件檔（欄式 cells）→ 有感格（intensity > 0，與 DB 路徑同口徑） */
export function parseShakemapEventFile(
  json: unknown,
): { lon: number; lat: number; pga: number; intensity: number }[] {
  const obj = json as { columns?: unknown; cells?: unknown };
  if (!Array.isArray(obj?.columns) || !Array.isArray(obj?.cells)) {
    throw new Error("震度圖事件檔格式不符（缺 columns／cells）");
  }
  const cols = obj.columns as string[];
  const iLon = cols.indexOf("lon");
  const iLat = cols.indexOf("lat");
  const iPga = cols.indexOf("pga");
  const iInt = cols.indexOf("intensity");
  if (iLon < 0 || iLat < 0 || iInt < 0) throw new Error("震度圖事件檔缺 lon／lat／intensity 欄");
  const out: { lon: number; lat: number; pga: number; intensity: number }[] = [];
  for (const c of obj.cells as unknown[][]) {
    const intensity = Number(c[iInt] ?? 0);
    if (!(intensity > 0)) continue;
    out.push({ lon: Number(c[iLon]), lat: Number(c[iLat]), pga: Number((iPga >= 0 ? c[iPga] : 0) ?? 0), intensity });
  }
  return out;
}

async function fetchGridRows(ev: EarthquakeReplayEvent): Promise<Record<string, unknown>[]> {
  if (ev.grid_key) {
    const url = `${IMAGERY_CDN_BASE}/${ev.grid_key}`;
    const gridKey = ev.grid_key;
    const json = await withLoading(`eq-replay-grid:${ev.event_id}`, `地震回放 等震度網格 ${ev.event_id}`, (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`R2 震度圖事件檔 HTTP ${res.status}: ${gridKey}`);
      return (await res.json()) as unknown;
    })());
    return parseShakemapEventFile(json);
  }
  return fetchGridRowsFromDb(ev);
}

async function fetchGrid(ev: EarthquakeReplayEvent): Promise<EqReplayGridCell[]> {
  if (!ev.has_grid || !ev.grid_event_time) return [];
  const out: EqReplayGridCell[] = [];
  for (const r of await fetchGridRows(ev)) {
    const lon = Number(r.lon);
    const lat = Number(r.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const distKm = haversineKm(ev.epicenter_lng, ev.epicenter_lat, lon, lat);
    out.push({
      lon,
      lat,
      pga: Number(r.pga ?? 0),
      intensity: Number(r.intensity ?? 0),
      arrivalSec: distKm / S_WAVE_KM_S,
    });
  }
  return out;
}

/** 退路：R2 沒有對應事件時讀 DB（DB 只留短期，見 retention_policies） */
async function fetchGridRowsFromDb(ev: EarthquakeReplayEvent): Promise<Record<string, unknown>[]> {
  // intensity > 0 才拉（DB 有 partial index）：全量 4,377 含大量 0 值外海格，畫了也是透明
  const { data, error } = await withLoading(
    `eq-replay-grid:${ev.event_id}`,
    `地震回放 等震度網格 ${ev.event_id}`,
    supabase
      .from("earthquake_shakemap_grid")
      .select("lon, lat, pga, intensity")
      .eq("event_time", ev.grid_event_time)
      .gt("intensity", 0),
  );
  if (error) throw new Error(`Supabase earthquake_shakemap_grid: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function fetchTensor(ev: EarthquakeReplayEvent): Promise<EqReplayTensor | null> {
  if (!ev.has_tensor || !ev.tensor_origin_utc) return null;
  const { data, error } = await withLoading(
    `eq-replay-tensor:${ev.event_id}`,
    `地震回放 震源機制解 ${ev.event_id}`,
    supabase
      .from("earthquake_moment_tensor")
      .select("strike1, dip1, rake1, strike2, dip2, rake2, mw, centroid_depth, beachball_url, solution_type")
      .eq("origin_time_utc", ev.tensor_origin_utc),
  );
  if (error) throw new Error(`Supabase earthquake_moment_tensor: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  // 一事件可能兩列（R = 快解 / A = 修訂解）→ A 優先、fallback R（目前庫裡全是 R）
  const picked = rows.find((r) => String(r.solution_type ?? "") === "A") ?? rows[0]!;
  return {
    strike1: Number(picked.strike1 ?? 0),
    dip1: Number(picked.dip1 ?? 0),
    rake1: Number(picked.rake1 ?? 0),
    strike2: Number(picked.strike2 ?? 0),
    dip2: Number(picked.dip2 ?? 0),
    rake2: Number(picked.rake2 ?? 0),
    mw: picked.mw == null ? null : Number(picked.mw),
    centroid_depth: picked.centroid_depth == null ? null : Number(picked.centroid_depth),
    beachball_url: picked.beachball_url == null ? null : String(picked.beachball_url),
    solution_type: String(picked.solution_type ?? ""),
  };
}

const detailCache = keyedThunkCache<EqReplayDetail>(30 * 60_000, 12);

/** 某事件的完整回放素材（per-event 快取，切回同一起不重打 DB） */
export function fetchReplayDetail(ev: EarthquakeReplayEvent): Promise<EqReplayDetail> {
  return detailCache(ev.event_id, async () => {
    const [stations, towns, grid, tensor] = await Promise.all([
      fetchStations(ev),
      fetchTowns(ev),
      fetchGrid(ev),
      fetchTensor(ev),
    ]);
    let maxDistKm = 0;
    for (const s of stations) maxDistKm = Math.max(maxDistKm, s.epicenter_distance_km);
    for (const c of grid) maxDistKm = Math.max(maxDistKm, c.arrivalSec * S_WAVE_KM_S);
    return { event: ev, tier: eventTier(ev), stations, towns, grid, tensor, maxDistKm };
  });
}
