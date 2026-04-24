import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 地下水井即時讀值（WRA，每日／每小時觀測）
 *
 * 後端：gis-platform migration 058
 *   public.get_groundwater_latest()         48h 內 739 站
 *   public.get_groundwater_day(target_date) 當日時序（timeline 回放）
 *   public.get_groundwater_timeseries(...)  panel sparkline 預留
 *
 * 視覺策略：
 *   - 單色藍圓（#0ea5e9）配合地下「水」語意
 *   - 半徑反映絕對水位（區別山區深井 vs 平原淺井）
 *   - 與 groundwater_zones 管制區 overlay 後，可說「超抽帶裡水位多低」
 */

/** get_groundwater_day 回傳列 */
export interface GroundwaterDayRow {
  station_id: string;
  well_name: string | null;
  lat: number;
  lng: number;
  observed_at: string;
  water_level_m: number | null;
}

/** 當日地下水時序（for timeline 回放） */
export async function fetchGroundwaterDay(dateKey: string): Promise<GroundwaterDayRow[]> {
  const { data, error } = await withLoading(
    `groundwater-day-${dateKey}`,
    `地下水井 ${dateKey}`,
    supabase.rpc("get_groundwater_day", { target_date: dateKey }),
  );
  if (error) throw new Error(`get_groundwater_day(${dateKey}): ${error.message}`);
  return (data ?? []) as GroundwaterDayRow[];
}
