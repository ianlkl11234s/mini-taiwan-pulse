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

/** 讀取結果：失敗不再偽裝成空陣列，由呼叫端依 reason 顯示各自文案 */
export type ManeuversFetchResult =
  | { ok: true; rows: ManeuverRow[]; fetchedAt: number }
  | { ok: false; reason: "unconfigured" | "rpc"; message: string };

export async function fetchRecentManeuvers(hours = 24): Promise<ManeuversFetchResult> {
  if (!supabaseConfigured) {
    return { ok: false, reason: "unconfigured", message: "Supabase 未設定" };
  }
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { ok: true, rows: cache.rows, fetchedAt: cache.fetchedAt };
  }
  const { data, error } = await withLoading(
    "satellite:maneuvers",
    "衛星變軌偵測",
    supabase.rpc("get_satellite_maneuvers_recent", { p_hours: hours }),
  );
  if (error) {
    console.warn("[satconsole] get_satellite_maneuvers_recent failed:", error.message);
    return { ok: false, reason: "rpc", message: error.message };
  }
  const rows = (data ?? []) as ManeuverRow[];
  const fetchedAt = Date.now();
  cache = { fetchedAt, rows };
  return { ok: true, rows, fetchedAt };
}

/** 強制 invalidate cache（panel 上的 refresh 按鈕用） */
export function invalidateManeuversCache(): void {
  cache = null;
}

const NO_VALUE = "—";

/** 帶正負號的 delta；null 顯示「—」，不當 0 */
function signed(d: number | null, fmt: (n: number) => string): string {
  if (d == null) return NO_VALUE;
  return `${d > 0 ? "+" : ""}${fmt(d)}`;
}

/** 把 delta 數值 format 成中文 chip 文字 */
export function formatManeuverDetail(row: ManeuverRow): string {
  switch (row.maneuver_type) {
    case "PLANE_CHANGE":
      return `傾角 ${signed(row.delta_inclination, (n) => `${n.toFixed(2)}°`)}`;
    case "ALTITUDE_CHANGE":
      return `週期 ${signed(row.delta_period_min, (n) => `${n.toFixed(2)} min`)}`;
    case "SHAPE_CHANGE":
      return `離心率 ${signed(row.delta_eccentricity, (n) => n.toExponential(1))}`;
  }
}

/** 變軌嚴重度 — 給 §A 卡片上色 + 排序用。unknown = 判定所需的 delta 為 null，不歸入例行 */
export type ManeuverSeverity = "grey" | "orange" | "red" | "unknown";

const SEV_THRESHOLDS = {
  PLANE_CHANGE: { orange: 0.02, red: 0.1 },       // 絕對值 °
  ALTITUDE_CHANGE: { orange: 0.1, red: 0.5 },     // 絕對值 min
  SHAPE_CHANGE: { orange: 1e-4, red: 5e-4 },      // 絕對值（無單位）
} as const;

export function getManeuverSeverity(row: ManeuverRow): ManeuverSeverity {
  const th = SEV_THRESHOLDS[row.maneuver_type];
  let delta: number | null = null;
  switch (row.maneuver_type) {
    case "PLANE_CHANGE":    delta = row.delta_inclination; break;
    case "ALTITUDE_CHANGE": delta = row.delta_period_min; break;
    case "SHAPE_CHANGE":    delta = row.delta_eccentricity; break;
  }
  if (delta == null) return "unknown";
  const v = Math.abs(delta);
  if (v >= th.red) return "red";
  if (v >= th.orange) return "orange";
  return "grey";
}

/** 排序 rank — 數字大優先（red=2 > orange=1 > grey=0 > unknown=-1） */
export function severityRank(s: ManeuverSeverity): number {
  return s === "red" ? 2 : s === "orange" ? 1 : s === "grey" ? 0 : -1;
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
