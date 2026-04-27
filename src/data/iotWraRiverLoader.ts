import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 水利署 IoT 河川水位（補強既有 riverLevel 圖層）
 *
 * 後端：gis-platform migration 063
 *   public.get_iot_wra_day(target_date, station_type)
 *   public.get_iot_wra_latest(station_type)
 *
 * 互補定位：
 *   - iot_wra river 1,634 站，跟既有 riverLevel (831 站) 重疊僅 266 對；
 *     iot 獨有 1,265 站、old 獨有 565 站，兩個 layer 同時開才完整。
 *   - 含「12-19 小時預測水位」physical_quantity（少數站）。
 *
 * timeline 字串編碼：`"epoch1,val1;epoch2,val2;..."`（每小時 1 個 timepoint）
 */

export interface IotWraDayRow {
  iow_station_id: string;          // UUID
  physical_quantity_id: string;    // UUID
  station_type: string;
  name: string;                    // 站名（中文）
  county_name: string | null;
  basin_name: string | null;
  lat: number;
  lng: number;
  measurement_name: string | null; // 「水位」/「12 小時預測水位」…
  si_unit: string | null;
  timeline: string;                // "epoch,val;epoch,val;..."
  point_count: number;
}

export async function fetchIotWraRiverDay(dateKey: string): Promise<IotWraDayRow[]> {
  const { data, error } = await withLoading(
    `iot-wra-river-day-${dateKey}`,
    `IoT 河川 ${dateKey}`,
    supabase.rpc("get_iot_wra_day", { p_target_day: dateKey, p_station_type: "river" }),
  );
  if (error) throw new Error(`get_iot_wra_day(river,${dateKey}): ${error.message}`);
  return (data ?? []) as IotWraDayRow[];
}

/** 解析 timeline 字串為 [epoch, value] 陣列 */
export function parseTimeline(timeline: string): Array<{ t: number; v: number }> {
  if (!timeline) return [];
  return timeline.split(";").reduce<Array<{ t: number; v: number }>>((acc, pair) => {
    const [tStr, vStr] = pair.split(",");
    const t = Number(tStr);
    const v = Number(vStr);
    if (Number.isFinite(t) && Number.isFinite(v)) acc.push({ t, v });
    return acc;
  }, []);
}
