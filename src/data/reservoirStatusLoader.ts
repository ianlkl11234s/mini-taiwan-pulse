import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey } from "../lib/loaderCache";

/**
 * 水庫即時水情（for 3D 水位計 cylinder）
 *
 * 後端：gis-platform migration 047 + 056
 *   public.get_reservoir_status_latest()
 *
 * 每庫一筆最新水情，含座標 + 容量 + 蓄水率 + 警示等級。
 * 由 `useReservoirStatusLayer` 定期 refresh，驅動 ReservoirScene 的
 * cylinder 高度（外殼固定 = 滿水容量、內部水位 = storage_ratio_pct）。
 *
 * 蓄水率分母（2026-04-22 migration 056 起）：
 *   storage_ratio_pct = effective_storage_wan_m3 / current_capacity_wan × 100
 *   採用「現行有效容量」（扣除淤積）對齊水利署 fhy.wra.gov.tw 官網，
 *   淤積嚴重的水庫（霧社 81% 淤積）才不會顯示失真的低百分比。
 *   翡翠等幾乎無淤積的水庫在滿水時可能 >100%，屬正常。
 */

export interface ReservoirStatus {
  reservoir_id: string;
  name: string | null;
  region: string | null;
  lat: number;
  lng: number;
  effective_capacity_wan: number | null;
  snapshot_at: string | null;
  water_level_m: number | null;
  effective_storage_wan_m3: number | null;
  storage_ratio_pct: number | null;
  alert_level: string | null;
  inflow_cms: number | null;
  total_outflow_cms: number | null;
  basin_rainfall_mm: number | null;
}

/** get_reservoir_status_day 回傳列（無 region/inflow/outflow/alert_level） */
export interface ReservoirDayRow {
  reservoir_id: string;
  name: string | null;
  lat: number;
  lng: number;
  effective_capacity_wan: number | null;
  snapshot_at: string;
  water_level_m: number | null;
  effective_storage_wan_m3: number | null;
  storage_ratio_pct: number | null;
  basin_rainfall_mm: number | null;
}

async function fetchReservoirStatusDayUncached(dateKey: string): Promise<ReservoirDayRow[]> {
  const { data, error } = await withLoading(
    `reservoir-status-day-${dateKey}`,
    `水庫水情 ${dateKey}`,
    supabase.rpc("get_reservoir_status_day", { target_date: dateKey }),
  );
  if (error) throw new Error(`get_reservoir_status_day(${dateKey}): ${error.message}`);
  return (data ?? []) as ReservoirDayRow[];
}

const fetchReservoirStatusDayCached = cachedByKey(fetchReservoirStatusDayUncached, 10 * 60_000);

/** 當日每小時全庫時序（for timeline 回放）。10min TTL 快取，toggle 不重抓 */
export function fetchReservoirStatusDay(dateKey: string): Promise<ReservoirDayRow[]> {
  return fetchReservoirStatusDayCached(dateKey);
}

/** 從 storage_ratio_pct 推算 alert_level（保持與 view 公式一致） */
export function alertLevelFromPct(pct: number | null | undefined): string {
  if (pct == null) return "normal";
  if (pct < 15) return "critical";
  if (pct < 30) return "warning";
  if (pct > 90) return "high";
  return "normal";
}

/** 警示等級 → 水柱色（對齊 022_water_system.sql reservoir_situation_v 的 alert_level 輸出） */
export const ALERT_COLOR_HEX: Record<string, number> = {
  critical: 0xef4444, // 紅：<15%
  warning:  0xf97316, // 橘：<30%
  normal:   0x22d3ee, // 青：30~90%（預設）
  high:     0x22c55e, // 綠：>90% 滿水
};

/** 將 text 類型 reservoir_id 轉成 integer compare_id（40/40 都是數字字串） */
export function compareIdFromReservoirId(rid: string): number | null {
  if (!/^\d+$/.test(rid)) return null;
  const n = parseInt(rid, 10);
  return n > 0 ? n : null;
}
