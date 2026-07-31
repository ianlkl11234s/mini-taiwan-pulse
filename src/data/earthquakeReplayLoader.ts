import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, keyedThunkCache } from "../lib/loaderCache";
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

async function fetchReplayEventsUncached(): Promise<EarthquakeReplayEvent[]> {
  const { data, error } = await withLoading(
    "earthquake-replay-events",
    "地震回放事件清單",
    supabase.rpc("earthquake_replay_events"),
  );
  if (error) throw new Error(`Supabase earthquake_replay_events: ${error.message}`);

  const rows = (data ?? []) as RawEventRow[];
  const out: EarthquakeReplayEvent[] = [];
  for (const r of rows) {
    if (r.epicenter_lat == null || r.epicenter_lng == null) continue;
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
      has_grid: r.has_grid === true,
      grid_event_time: r.grid_event_time,
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

async function fetchGrid(ev: EarthquakeReplayEvent): Promise<EqReplayGridCell[]> {
  if (!ev.has_grid || !ev.grid_event_time) return [];
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
  const out: EqReplayGridCell[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
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
