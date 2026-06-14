/**
 * Satellite Console §A — 近 N 小時變軌警報
 *
 * 對應 gis-platform migration 169: get_satellite_maneuvers_recent(p_hours)
 * MV 每 2h refresh，前端 cache 2 分鐘避免 panel 反覆切換時打爆 RPC。
 */
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/** 對應 RPC 回傳欄位（snake_case 直接帶過來） */
export type ManeuverType = "ALTITUDE_CHANGE" | "PLANE_CHANGE" | "SHAPE_CHANGE";

export type CnGroup =
  | "YAOGAN" | "JILIN" | "GAOFEN" | "TJS" | "BEIDOU" | "SHIYAN"
  | "TAIWAN" | "OTHER";

export interface ManeuverRow {
  norad_id: number;
  name: string;
  country_operator: string | null;
  cn_group: CnGroup;
  maneuver_type: ManeuverType;
  delta_inclination: number | null;
  delta_eccentricity: number | null;
  delta_period_min: number | null;
  curr_inclination: number | null;
  curr_eccentricity: number | null;
  curr_period_min: number | null;
  curr_fetched_at: string;
  prev_fetched_at: string;
  curr_epoch: string;
  prev_epoch: string;
}

let cache: { fetchedAt: number; rows: ManeuverRow[] } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

export async function fetchRecentManeuvers(hours = 24): Promise<ManeuverRow[]> {
  if (!supabaseConfigured) return [];
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const { data, error } = await withLoading(
    "satellite:maneuvers",
    "衛星變軌偵測",
    supabase.rpc("get_satellite_maneuvers_recent", { p_hours: hours }),
  );
  if (error) {
    console.warn("[satconsole] get_satellite_maneuvers_recent failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as ManeuverRow[];
  cache = { fetchedAt: Date.now(), rows };
  return rows;
}

/** 強制 invalidate cache（panel 上的 refresh 按鈕用） */
export function invalidateManeuversCache(): void {
  cache = null;
}

/** 把 delta 數值 format 成中文 chip 文字 */
export function formatManeuverDetail(row: ManeuverRow): string {
  switch (row.maneuver_type) {
    case "PLANE_CHANGE": {
      const d = row.delta_inclination ?? 0;
      return `傾角 ${d > 0 ? "+" : ""}${d.toFixed(2)}°`;
    }
    case "ALTITUDE_CHANGE": {
      const d = row.delta_period_min ?? 0;
      return `週期 ${d > 0 ? "+" : ""}${d.toFixed(2)} min`;
    }
    case "SHAPE_CHANGE": {
      const d = row.delta_eccentricity ?? 0;
      return `離心率 ${d > 0 ? "+" : ""}${d.toExponential(1)}`;
    }
  }
}

/** "14 分鐘前" / "2 小時前" / "已超過 24h" */
export function formatRelTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "剛剛";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} 小時前`;
  return `${Math.floor(h / 24)} 天前`;
}
