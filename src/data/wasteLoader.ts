import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 垃圾清運（waste）資料 loader
 *
 * 後端：gis-platform migration 069_waste_rpc.sql
 *   - public.get_waste_current(p_cities)        每車最新 GPS（30 分鐘內）
 *   - public.get_waste_routes(p_city)           路線 LineString
 *   - public.get_waste_stops(p_city)            停靠點
 *   - public.get_waste_facilities()             焚化爐/掩埋場
 *   - public.get_waste_trails(p_cities, p_since_minutes)      live 近 N 分鐘
 *   - public.get_waste_trails_day(p_target_date, p_cities)    指定台灣日期整日
 *
 * 主城策略（2026-05-06 起）：
 *   高雄 — 24h GPS 8,374 / 157 車 / 1,399 路線 / 32,422 點
 *   新北/台南 為 fallback；台北無 GPS 暫不接
 */

export type WasteStatus = "collecting" | "returning" | "parked" | "offline" | "unknown";

export interface WasteVehicleRow {
  vehicle_no: string;
  city: string;
  route_id: string | null;
  status: WasteStatus;
  lat: number;
  lng: number;
  observed_at: string;
}

export interface WasteRouteRow {
  route_id: string | null;
  route_name: string | null;
  city: string;
  district: string | null;
  vehicle_type: "garbage" | "recycling" | "kitchen" | "mixed";
  coords: [number, number][];  // [[lng, lat], ...]
}

export interface WasteStopRow {
  id: number;
  city: string;
  district: string | null;
  stop_name: string | null;
  route_id: string | null;
  route_name: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  vehicle_type: string;
  village: string | null;
  lat: number;
  lng: number;
}

export interface WasteFacilityRow {
  id: number;
  city: string;
  facility_name: string;
  facility_type: string;
  operator: string | null;
  address: string | null;
  capacity_tpd: number | null;
  status: string | null;
  start_year: number | null;
  lat: number;
  lng: number;
}

/** 取得每車最新 GPS（30 分鐘內），預設只抓高雄 */
export async function fetchWasteCurrent(
  cities: string[] = ["高雄市"],
): Promise<WasteVehicleRow[]> {
  const { data, error } = await withLoading(
    `waste-current-${cities.join(",")}`,
    `垃圾車即時 ${cities.join("/")}`,
    supabase.rpc("get_waste_current", { p_cities: cities }),
  );
  if (error) throw new Error(`get_waste_current: ${error.message}`);
  return (data ?? []) as WasteVehicleRow[];
}

/** 取得路線 LineString（高雄/新北有資料） */
export async function fetchWasteRoutes(city: string = "高雄市"): Promise<WasteRouteRow[]> {
  const { data, error } = await withLoading(
    `waste-routes-${city}`,
    `垃圾車路線 ${city}`,
    supabase.rpc("get_waste_routes", { p_city: city }),
  );
  if (error) throw new Error(`get_waste_routes(${city}): ${error.message}`);
  return (data ?? []) as WasteRouteRow[];
}

/** 取得清運點位 */
export async function fetchWasteStops(city: string = "高雄市"): Promise<WasteStopRow[]> {
  const { data, error } = await withLoading(
    `waste-stops-${city}`,
    `清運點位 ${city}`,
    supabase.rpc("get_waste_stops", { p_city: city }),
  );
  if (error) throw new Error(`get_waste_stops(${city}): ${error.message}`);
  return (data ?? []) as WasteStopRow[];
}

/** 取得焚化爐/掩埋場（已 geocode 16 筆） */
export async function fetchWasteFacilities(): Promise<WasteFacilityRow[]> {
  const { data, error } = await withLoading(
    "waste-facilities",
    "垃圾處理設施",
    supabase.rpc("get_waste_facilities"),
  );
  if (error) throw new Error(`get_waste_facilities: ${error.message}`);
  return (data ?? []) as WasteFacilityRow[];
}

// ── Trails (方案 A 軌跡插值) ──────────────────────────────

/** 軌跡單點（解碼後） */
export interface WasteTrailPoint {
  t: number;          // unix epoch seconds
  lat: number;
  lng: number;
  status: WasteStatus;
  tripId: number;     // 同 trip 的點才能連線（trip break = 跨 trip 不連）
}

export interface WasteTrailRow {
  vehicle_no: string;
  city: string;
  route_id: string | null;
  trail: WasteTrailPoint[];
}

const STATUS_CHAR_MAP: Record<string, WasteStatus> = {
  c: "collecting", r: "returning", p: "parked", o: "offline", u: "unknown",
};

/** 解析 timeline 字串：`"epoch,lat,lng,statusChar,tripId;..."` → WasteTrailPoint[] */
export function parseWasteTimeline(timeline: string): WasteTrailPoint[] {
  if (!timeline) return [];
  const out: WasteTrailPoint[] = [];
  for (const segment of timeline.split(";")) {
    const parts = segment.split(",");
    if (parts.length !== 5) continue;
    const t = Number(parts[0]);
    const lat = Number(parts[1]);
    const lng = Number(parts[2]);
    const tripId = Number(parts[4]);
    const statusChar = parts[3] ?? "u";
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      t, lat, lng,
      status: STATUS_CHAR_MAP[statusChar] ?? "unknown",
      tripId: Number.isFinite(tripId) ? tripId : 0,
    });
  }
  return out;
}

interface RawTrailRow {
  vehicle_no: string;
  city: string;
  route_id: string | null;
  timeline: string;
  point_count: number;
}

/** 取每車近 N 分鐘軌跡（含後端去噪 + stop snapping）。多城市可復用。 */
export async function fetchWasteTrails(
  cities: string[] = ["高雄市"],
  sinceMinutes: number = 60,
): Promise<WasteTrailRow[]> {
  const { data, error } = await withLoading(
    `waste-trails-${cities.join(",")}-${sinceMinutes}`,
    `垃圾車軌跡 ${cities.join("/")} (${sinceMinutes}min)`,
    supabase.rpc("get_waste_trails", { p_cities: cities, p_since_minutes: sinceMinutes }),
  );
  if (error) throw new Error(`get_waste_trails: ${error.message}`);
  const rows = (data ?? []) as RawTrailRow[];
  return rows.map((r) => ({
    vehicle_no: r.vehicle_no,
    city: r.city,
    route_id: r.route_id,
    trail: parseWasteTimeline(r.timeline),
  }));
}

/** 取指定台灣日期整日軌跡（for timeline replay）。 */
export async function fetchWasteTrailsDay(
  targetDate: string,
  cities: string[] = ["高雄市"],
): Promise<WasteTrailRow[]> {
  const { data, error } = await withLoading(
    `waste-trails-day-${targetDate}-${cities.join(",")}`,
    `垃圾車軌跡 ${targetDate} ${cities.join("/")}`,
    supabase.rpc("get_waste_trails_day", { p_target_date: targetDate, p_cities: cities }),
  );
  if (error) throw new Error(`get_waste_trails_day(${targetDate}): ${error.message}`);
  const rows = (data ?? []) as RawTrailRow[];
  return rows.map((r) => ({
    vehicle_no: r.vehicle_no,
    city: r.city,
    route_id: r.route_id,
    trail: parseWasteTimeline(r.timeline),
  }));
}

// ── 顏色 / 圖例 ──────────────────────────────────────────

export const WASTE_STATUS_COLORS: Record<WasteStatus, string> = {
  collecting: "#fbbf24",  // 琥珀色 — 收運中（音符飄出）
  returning: "#06b6d4",   // cyan — 返程
  parked: "#6b7280",      // 灰 — 停車
  offline: "#374151",     // 暗灰
  unknown: "#9ca3af",
};

export const WASTE_STATUS_LABELS: Record<WasteStatus, string> = {
  collecting: "收運中",
  returning: "返程",
  parked: "停車",
  offline: "離線",
  unknown: "未知",
};

export const WASTE_FACILITY_COLORS: Record<string, string> = {
  incinerator: "#ef4444",        // 紅 — 焚化爐
  landfill: "#92400e",           // 棕 — 掩埋場
  transfer_station: "#a855f7",   // 紫 — 轉運站
  recycling_plant: "#22c55e",    // 綠 — 回收廠
  food_waste_processing: "#f59e0b",  // 橘
  scrap_yard: "#737373",
  medical_waste: "#ec4899",
  repair_shop: "#3b82f6",
  other: "#6b7280",
};
