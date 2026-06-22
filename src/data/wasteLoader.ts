import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

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
 *   - public.get_waste_trails_matched_day(p_target_date, p_cities) OSRM 路網 matched 整日
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
  source_url: string | null;
  /** 是否為濱海掩埋場（landfill_coastal 一律 true，其他 false） */
  is_coastal: boolean;
  /** 距海岸距離（公尺）— 僅 landfill_coastal 有值 */
  distance_to_sea_m: number | null;
  lat: number;
  lng: number;
}

/** 投放點（衣物箱、街頭桶、電池站等，~13,751 筆） */
export interface WasteDisposalPointRow {
  id: number;
  city: string;
  district: string | null;
  point_type: string;
  point_name: string | null;
  address: string | null;
  operator: string | null;
  accepts_categories: string[] | null;
  source: string;
  source_url: string | null;
  lat: number;
  lng: number;
}

/** 全國清潔隊辦公點（359 / 23 縣市，spatial.waste_cleaning_squads） */
export interface WasteCleaningSquadRow {
  id: number;
  city: string;
  district: string | null;
  squad_name: string;
  address: string | null;
  phone: string | null;
  jurisdiction: string | null;
  source: string;
  source_url: string | null;
  lat: number;
  lng: number;
}

/** facility 分類筆數（給 sidebar 顯示） */
export interface WasteFacilityCount {
  facility_type: string;
  n: number;
}

/** disposal point 分類筆數（給 sidebar 顯示） */
export interface WasteDisposalPointCount {
  point_type: string;
  source: string;
  n: number;
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

const facilitiesCache = keyedThunkCache<WasteFacilityRow[]>(15 * 60_000);

/** 取得垃圾處理設施（focal 類型 8 種，~4,609 筆全量；用 migration 075 RPC）。15min TTL 快取 */
export function fetchWasteFacilities(types?: string[]): Promise<WasteFacilityRow[]> {
  const cacheKey = types?.length ? types.slice().sort().join(",") : "all";
  return facilitiesCache(cacheKey, async () => {
    const { data, error } = await withLoading(
      `waste-facilities-${cacheKey}`,
      `垃圾處理設施 ${types?.length ?? "全部"}`,
      supabase.rpc("get_waste_facilities", { p_types: types ?? null }),
    );
    if (error) throw new Error(`get_waste_facilities: ${error.message}`);
    return (data ?? []) as WasteFacilityRow[];
  });
}

const disposalPointsCache = keyedThunkCache<WasteDisposalPointRow[]>(15 * 60_000);

/**
 * 取得垃圾投放點（衣物箱/街頭桶/電池站等，~13,751 筆；用 migration 076 RPC）。
 * payload ~2.5MB — 15min TTL 快取，toggle 不重抓（2026-06-10 實測 DB 端僅 31ms，
 * 成本在傳輸與 JSON parse）
 */
export function fetchWasteDisposalPoints(
  cities?: string[],
  types?: string[],
): Promise<WasteDisposalPointRow[]> {
  const cityKey = cities?.length ? cities.slice().sort().join(",") : "all";
  const typeKey = types?.length ? types.slice().sort().join(",") : "all";
  return disposalPointsCache(`${cityKey}|${typeKey}`, async () => {
    const { data, error } = await withLoading(
      `waste-disposal-${cityKey}-${typeKey}`,
      `垃圾投放點 ${cityKey}/${typeKey}`,
      supabase.rpc("get_waste_disposal_points", {
        p_cities: cities ?? null,
        p_types: types ?? null,
      }),
    );
    if (error) throw new Error(`get_waste_disposal_points: ${error.message}`);
    return (data ?? []) as WasteDisposalPointRow[];
  });
}

const squadsCache = keyedThunkCache<WasteCleaningSquadRow[]>(15 * 60_000);

/** 取得全國清潔隊辦公點（359 筆，~50KB JSON）。15min cache。 */
export function fetchWasteCleaningSquads(cities?: string[]): Promise<WasteCleaningSquadRow[]> {
  const cacheKey = cities?.length ? cities.slice().sort().join(",") : "all";
  return squadsCache(cacheKey, async () => {
    const { data, error } = await withLoading(
      `waste-squads-${cacheKey}`,
      `清潔隊 ${cacheKey}`,
      supabase.rpc("get_waste_cleaning_squads", { p_cities: cities ?? null }),
    );
    if (error) throw new Error(`get_waste_cleaning_squads: ${error.message}`);
    return (data ?? []) as WasteCleaningSquadRow[];
  });
}

/** sidebar 顯示「焚化爐 30 筆」用 */
export async function fetchWasteFacilityCounts(): Promise<WasteFacilityCount[]> {
  const { data, error } = await supabase.rpc("get_waste_facility_counts");
  if (error) throw new Error(`get_waste_facility_counts: ${error.message}`);
  return (data ?? []) as WasteFacilityCount[];
}

/** sidebar 顯示「衣物箱 utmap 6915 / tnepb 302 / osm 19」用 */
export async function fetchWasteDisposalPointCounts(): Promise<WasteDisposalPointCount[]> {
  const { data, error } = await supabase.rpc("get_waste_disposal_point_counts");
  if (error) throw new Error(`get_waste_disposal_point_counts: ${error.message}`);
  return (data ?? []) as WasteDisposalPointCount[];
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

/** matched progress 時間點（路網 polyline 上的 progress） */
export interface WasteMatchedProgressPoint {
  t: number;
  progress: number;   // [0, 1] on matched polyline
  status: WasteStatus;
  tripId: number;
}

export interface WasteMatchedTrail {
  polyline: [number, number][]; // [[lng, lat], ...] OSRM matched road geometry
  timeline: WasteMatchedProgressPoint[];
  confidence: number | null;
}

export interface WasteTrailRow {
  vehicle_no: string;
  city: string;
  route_id: string | null;
  trail: WasteTrailPoint[];
  matched?: WasteMatchedTrail;
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

/** 解析 matched timeline：`"epoch,progress,statusChar,tripId;..."` */
export function parseWasteMatchedTimeline(timeline: string): WasteMatchedProgressPoint[] {
  if (!timeline) return [];
  const out: WasteMatchedProgressPoint[] = [];
  for (const segment of timeline.split(";")) {
    const parts = segment.split(",");
    if (parts.length !== 4) continue;
    const t = Number(parts[0]);
    const progress = Number(parts[1]);
    const statusChar = parts[2] ?? "u";
    const tripId = Number(parts[3]);
    if (!Number.isFinite(t) || !Number.isFinite(progress)) continue;
    out.push({
      t,
      progress: Math.max(0, Math.min(1, progress)),
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

interface RawMatchedTrailRow {
  vehicle_no: string;
  city: string;
  route_id: string | null;
  trip_id: number;
  segment_seq: number;
  polyline: [number, number][];
  timeline: string;
  point_count: number;
  confidence: number | null;
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

/** 取指定台灣日期整日 OSRM matched 軌跡（progress-based，沿路網移動）。 */
export async function fetchWasteTrailsMatchedDay(
  targetDate: string,
  cities: string[] = ["高雄市"],
): Promise<WasteTrailRow[]> {
  const { data, error } = await withLoading(
    `waste-trails-matched-day-${targetDate}-${cities.join(",")}`,
    `垃圾車路網軌跡 ${targetDate} ${cities.join("/")}`,
    supabase.rpc("get_waste_trails_matched_day", { p_target_date: targetDate, p_cities: cities }),
  );
  if (error) throw new Error(`get_waste_trails_matched_day(${targetDate}): ${error.message}`);
  const rows = (data ?? []) as RawMatchedTrailRow[];
  return rows
    .map((r) => {
      const polyline = (r.polyline ?? [])
        .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
      return {
        vehicle_no: r.vehicle_no,
        city: r.city,
        route_id: r.route_id,
        trail: [],
        matched: {
          polyline,
          timeline: parseWasteMatchedTimeline(r.timeline),
          confidence: r.confidence,
        },
      };
    })
    .filter((r) => r.matched.polyline.length >= 2 && r.matched.timeline.length >= 2);
}

// ── 顏色 / 圖例 ──────────────────────────────────────────

export const WASTE_STATUS_COLORS: Record<WasteStatus, string> = {
  collecting: "#fbbf24",
  returning: "#fbbf24",
  parked: "#fbbf24",
  offline: "#fbbf24",
  unknown: "#fbbf24",
};

export const WASTE_STATUS_LABELS: Record<WasteStatus, string> = {
  collecting: "收運中",
  returning: "返程",
  parked: "停車",
  offline: "離線",
  unknown: "未知",
};

export const WASTE_FACILITY_COLORS: Record<string, string> = {
  incinerator: "#ef4444",          // 紅 — 焚化爐
  landfill: "#92400e",             // 棕 — 掩埋場
  landfill_coastal: "#0891b2",     // 深青 — 濱海掩埋場 🌊
  transfer_station: "#a855f7",     // 紫 — 轉運站
  recycling_plant: "#22c55e",      // 綠 — 回收廠
  monitoring_well: "#3b82f6",      // 藍 — 地下水監測井
  food_waste_processing: "#f59e0b",
  scrap_yard: "#737373",
  medical_waste: "#ec4899",        // 粉紅 — 醫療廢棄物（warning）
  repair_shop: "#0ea5e9",
  other: "#6b7280",
};

export const WASTE_FACILITY_LABELS: Record<string, string> = {
  incinerator: "焚化爐",
  landfill: "衛生掩埋場",
  landfill_coastal: "濱海掩埋場",
  transfer_station: "轉運站",
  recycling_plant: "資源回收廠",
  monitoring_well: "地下水監測井",
  food_waste_processing: "廚餘處理廠",
  scrap_yard: "廢車/廢金屬",
  medical_waste: "醫療廢棄物",
  repair_shop: "維修點",
  other: "其他事廢設施",
};

export const WASTE_DISPOSAL_COLORS: Record<string, string> = {
  clothes_box: "#f97316",
  mixed: "#14b8a6",
  recycling_container: "#84cc16",
  battery: "#fbbf24",
  community_station: "#a78bfa",
  food_waste_dropoff: "#fb923c",
  huge_waste_dropoff: "#94a3b8",
};

export const WASTE_DISPOSAL_LABELS: Record<string, string> = {
  clothes_box: "衣物回收箱",
  mixed: "混合投放點",
  recycling_container: "街頭資收桶",
  battery: "電池回收",
  community_station: "社區資收站",
  food_waste_dropoff: "廚餘投放點",
  huge_waste_dropoff: "大型廢棄物收受",
};

/** 投放點來源 → 顯示名稱（給 popup badge） */
export const WASTE_SOURCE_LABELS: Record<string, string> = {
  utmap: "環境部官方",
  moenv: "環境部官方",
  tnepb_kml: "台南環保局",
  city_gov: "縣市政府",
  osm: "OpenStreetMap (群眾編輯)",
  other: "其他",
};

/** 投放點來源權威度色塊（高=藍 / 中=綠 / 低=橘群眾） */
export const WASTE_SOURCE_BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  utmap:     { bg: "rgba(37,99,235,0.18)", fg: "#3b82f6" },   // 高權威
  moenv:     { bg: "rgba(37,99,235,0.18)", fg: "#3b82f6" },
  tnepb_kml: { bg: "rgba(16,185,129,0.18)", fg: "#22c55e" },  // 中權威
  city_gov:  { bg: "rgba(16,185,129,0.18)", fg: "#22c55e" },
  osm:       { bg: "rgba(249,115,22,0.18)", fg: "#fb923c" },  // 群眾
  other:     { bg: "rgba(148,163,184,0.18)", fg: "#94a3b8" },
};

/** facility_type → LayerVisibility key（sub-toggle 對應） */
export const FACILITY_TYPE_TO_VIS_KEY: Record<string, string> = {
  incinerator: "wfIncinerator",
  landfill: "wfLandfill",
  landfill_coastal: "wfLandfillCoastal",
  transfer_station: "wfTransfer",
  medical_waste: "wfMedical",
  monitoring_well: "wfMonitoring",
  recycling_plant: "wfRecycling",
  scrap_yard: "wfScrapYard",
  other: "wfOther",
  // 沒對應 sub-toggle 的（food_waste_processing/repair_shop）暫歸 wfOther
  food_waste_processing: "wfOther",
  repair_shop: "wfOther",
};

/** point_type → LayerVisibility key */
export const DISPOSAL_TYPE_TO_VIS_KEY: Record<string, string> = {
  clothes_box: "wdClothes",
  mixed: "wdMixed",
  recycling_container: "wdRecyclingContainer",
  battery: "wdBattery",
  community_station: "wdMixed",
  food_waste_dropoff: "wdMixed",
  huge_waste_dropoff: "wdMixed",
};
