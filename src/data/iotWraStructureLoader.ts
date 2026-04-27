import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 水利署 IoT 水工結構/環境 5 in 1
 *   - cumulativeflow 累計流量
 *   - watergate      閘門
 *   - damstructure   堤防結構安全
 *   - erosiondepth   河床沖刷深度
 *   - dustemission   揚塵
 *
 * 全部跟既有 collector 沒重疊，是 iot_wra 獨有資料。
 * 後端：gis-platform migration 063 — public.get_iot_wra_latest(station_type)
 *
 * 視覺策略：純 latest snapshot（不接 timeline，因為 timeline 拖拉跟 river 一致即可）
 *   - 顏色按 station_type 區分
 *   - radius 統一（量綱不同無法歸一化跨 type 比較）
 */

export type IotStructureType =
  | "cumulativeflow"
  | "watergate"
  | "damstructure"
  | "erosiondepth"
  | "dustemission";

export const STRUCTURE_TYPES: IotStructureType[] = [
  "cumulativeflow",
  "watergate",
  "damstructure",
  "erosiondepth",
  "dustemission",
];

export interface IotWraLatestRow {
  iow_station_id: string;
  physical_quantity_id: string;
  station_type: string;
  name: string;
  county_name: string | null;
  basin_name: string | null;
  lat: number;
  lng: number;
  measurement_name: string | null;
  si_unit: string | null;
  value: number | null;
  value_day_start: number | null;
  delta_since_day_start: number | null;
  observed_at: string;
}

/** 一次抓全部 7 type，前端 filter 結構類別（latest 表才 ~4k rows，不會踩 cap） */
export async function fetchIotWraStructureLatest(): Promise<IotWraLatestRow[]> {
  const { data, error } = await withLoading(
    "iot-wra-structure-latest",
    "IoT 水工結構",
    supabase.rpc("get_iot_wra_latest", { p_station_type: null }),
  );
  if (error) throw new Error(`get_iot_wra_latest: ${error.message}`);
  const rows = (data ?? []) as IotWraLatestRow[];
  const allowed = new Set<string>(STRUCTURE_TYPES);
  return rows.filter((r) => allowed.has(r.station_type));
}
