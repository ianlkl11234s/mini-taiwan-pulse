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

/** get_groundwater_day 回傳列（migration 060：降頻至每站每小時） */
export interface GroundwaterDayRow {
  station_id: string;
  well_name: string | null;
  lat: number;
  lng: number;
  bucket_at: string;      // hourly bucket 起點（Asia/Taipei）
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

/** get_groundwater_latest 回傳列（migration 060：加 delta_24h） */
export interface GroundwaterLatestRow {
  station_id: string;
  well_name: string | null;
  agency_unit: string | null;
  county: string | null;
  township: string | null;
  lat: number;
  lng: number;
  elevation_m: number | null;
  water_level_m: number;
  delta_24h: number | null;  // 當前 - 24h 前水位 (m)；24h 前沒讀值則 null
  observed_at: string;
}

/** 每站最新水位 + 24h 變化量（for 靜態點位 backdrop + 趨勢著色） */
export async function fetchGroundwaterLatest(): Promise<GroundwaterLatestRow[]> {
  const { data, error } = await withLoading(
    "groundwater-latest",
    "地下水井最新",
    supabase.rpc("get_groundwater_latest"),
  );
  if (error) throw new Error(`get_groundwater_latest: ${error.message}`);
  return (data ?? []) as GroundwaterLatestRow[];
}

export interface GroundwaterTimeseriesRow {
  observed_at: string;
  water_level_m: number | null;
}

/** 單站過去 N 小時時序（給 popup sparkline 用） */
export async function fetchGroundwaterTimeseries(
  stationId: string,
  hours = 24,
): Promise<GroundwaterTimeseriesRow[]> {
  const { data, error } = await supabase.rpc("get_groundwater_timeseries", {
    p_station_id: stationId,
    p_hours: hours,
  });
  if (error) throw new Error(`get_groundwater_timeseries(${stationId}): ${error.message}`);
  return (data ?? []) as GroundwaterTimeseriesRow[];
}
