import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 水庫即時水情（for 3D 水位計 cylinder）
 *
 * 後端：gis-platform migration 047
 *   public.get_reservoir_status_latest()
 *
 * 每庫一筆最新水情，含座標 + 容量 + 蓄水率 + 警示等級。
 * 由 `useReservoirStatusLayer` 定期 refresh，驅動 ReservoirScene 的
 * cylinder 高度（外殼固定 = 滿水容量、內部水位 = storage_ratio_pct）。
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

export async function fetchReservoirStatusLatest(): Promise<ReservoirStatus[]> {
  const { data, error } = await withLoading(
    "reservoir-status-latest",
    "水庫水情",
    supabase.rpc("get_reservoir_status_latest"),
  );
  if (error) throw new Error(`get_reservoir_status_latest: ${error.message}`);
  return (data ?? []) as ReservoirStatus[];
}

/** 警示等級 → 水柱色 */
export const ALERT_COLOR_HEX: Record<string, number> = {
  正常: 0x22d3ee,
  輕度: 0xfbbf24,
  中度: 0xf97316,
  重度: 0xef4444,
  嚴重: 0x991b1b,
};

/** 將 text 類型 reservoir_id 轉成 integer compare_id（40/40 都是數字字串） */
export function compareIdFromReservoirId(rid: string): number | null {
  if (!/^\d+$/.test(rid)) return null;
  const n = parseInt(rid, 10);
  return n > 0 ? n : null;
}
