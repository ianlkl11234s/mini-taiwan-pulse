import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 河川水位即時讀值（WRA，每 10 分鐘）
 *
 * 後端：gis-platform migration 055（latest）+ 057（當日時序，for timeline 回放）
 *   public.get_river_water_level_latest()
 *   public.get_river_water_level_day(target_date)
 *
 * NOTE：原 public.river_stations 含三級警戒水位但目前無資料，本 RPC JOIN
 * water_monitoring_stations 僅取座標。警戒水位視覺化需等上游 seed 補齊。
 *
 * 視覺策略：
 *   - 圓圈半徑：water_level_m 絕對值（大致反映「大河」vs「小溪」）
 *   - 顏色：單色青（#22d3ee）；check_result=0 時警示紅
 */

/** get_river_water_level_day 回傳列（migration 060b：降頻至每站每小時） */
export interface RiverLevelDayRow {
  station_id: string;
  station_name: string | null;
  lat: number;
  lng: number;
  bucket_at: string;  // hourly bucket 起點（Asia/Taipei）
  observed_at: string;
  water_level_m: number | null;
  check_result: number | null;
}

/** 當日河川水位時序（for timeline 回放） */
export async function fetchRiverLevelDay(dateKey: string): Promise<RiverLevelDayRow[]> {
  const { data, error } = await withLoading(
    `river-level-day-${dateKey}`,
    `河川水位 ${dateKey}`,
    supabase.rpc("get_river_water_level_day", { target_date: dateKey }),
  );
  if (error) throw new Error(`get_river_water_level_day(${dateKey}): ${error.message}`);
  return (data ?? []) as RiverLevelDayRow[];
}
