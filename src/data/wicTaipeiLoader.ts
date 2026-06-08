import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 北市水利處水情即時三本柱（每 10 分鐘）
 *
 * 後端：gis-platform migration 157 (tables/indexes) + 158 (evacuate latest RPC)
 *   public.get_taipei_sewer_latest(p_hours)
 *   public.get_taipei_evacuate_latest(p_hours)
 *   public.get_taipei_pumb_latest(p_hours)
 *
 * 視覺化策略：
 *   - 全部 latest only（無 timeline 回放，比照 useFireLatestLayer）
 *   - sewer: 點以 ground_far (距地面深度) 染色 — 低 = 接近溢出
 *   - evacuate: 點以閘門開關狀態染色 — 全閉 = 防護啟動
 *   - pumb: 點以 risk_ratio (內池/警戒) 染色 + pumb_status 描邊
 */

// ── Sewer ──
export interface SewerLatestRow {
  station_no: string;
  station_name: string | null;
  lat: number | null;
  lng: number | null;
  level_out: number | null;
  ground_far: number | null;
  observed_at: string;
}

export async function fetchTaipeiSewerLatest(): Promise<SewerLatestRow[]> {
  const { data, error } = await withLoading(
    "taipei-sewer-latest",
    "北市下水道水位 即時",
    supabase.rpc("get_taipei_sewer_latest", { p_hours: 1 }),
  );
  if (error) throw new Error(`get_taipei_sewer_latest: ${error.message}`);
  return (data ?? []) as SewerLatestRow[];
}

// ── Evacuate ──
export interface EvacuateLatestRow {
  station_no: string;
  station_name: string | null;
  lat: number | null;
  lng: number | null;
  gate_num: number | null;
  fo01: string | null;
  fc01: string | null;
  flt01: string | null;
  fo02: string | null;
  fc02: string | null;
  flt02: string | null;
  observed_at: string;
}

export async function fetchTaipeiEvacuateLatest(): Promise<EvacuateLatestRow[]> {
  const { data, error } = await withLoading(
    "taipei-evacuate-latest",
    "北市疏散門 即時",
    supabase.rpc("get_taipei_evacuate_latest", { p_hours: 1 }),
  );
  if (error) throw new Error(`get_taipei_evacuate_latest: ${error.message}`);
  return (data ?? []) as EvacuateLatestRow[];
}

// ── Pumb ──
export interface PumbLatestRow {
  stn_id: string;
  stn_name: string | null;
  lat: number | null;
  lng: number | null;
  inner_value: number | null;
  outer_value: number | null;
  pumb_status: string | null;
  door_status: string | null;
  max_allowable_water_level: number | null;
  risk_ratio: number | null;
  observed_at: string;
}

export async function fetchTaipeiPumbLatest(): Promise<PumbLatestRow[]> {
  const { data, error } = await withLoading(
    "taipei-pumb-latest",
    "北市抽水站 即時",
    supabase.rpc("get_taipei_pumb_latest", { p_hours: 1 }),
  );
  if (error) throw new Error(`get_taipei_pumb_latest: ${error.message}`);
  return (data ?? []) as PumbLatestRow[];
}

// ── 24h Timeseries（給 popup sparkline 用）──

export interface SewerTimeseriesRow {
  observed_at: string;
  level_out: number | null;
  ground_far: number | null;
  voltage: number | null;
}
export async function fetchTaipeiSewerTimeseries(stationNo: string, hours = 24): Promise<SewerTimeseriesRow[]> {
  const { data, error } = await supabase.rpc("get_taipei_sewer_timeseries", {
    p_station_no: stationNo,
    p_hours: hours,
  });
  if (error) throw new Error(`get_taipei_sewer_timeseries: ${error.message}`);
  return (data ?? []) as SewerTimeseriesRow[];
}

export interface PumbTimeseriesRow {
  observed_at: string;
  inner_value: number | null;
  outer_value: number | null;
  pumb_status: string | null;
  door_status: string | null;
}
export async function fetchTaipeiPumbTimeseries(stnId: string, hours = 24): Promise<PumbTimeseriesRow[]> {
  const { data, error } = await supabase.rpc("get_taipei_pumb_timeseries", {
    p_stn_id: stnId,
    p_hours: hours,
  });
  if (error) throw new Error(`get_taipei_pumb_timeseries: ${error.message}`);
  return (data ?? []) as PumbTimeseriesRow[];
}

export interface EvacuateTimeseriesRow {
  observed_at: string;
  fo01: string | null; fc01: string | null; flt01: string | null;
  fo02: string | null; fc02: string | null; flt02: string | null;
}
export async function fetchTaipeiEvacuateTimeseries(stationNo: string, hours = 24): Promise<EvacuateTimeseriesRow[]> {
  const { data, error } = await supabase.rpc("get_taipei_evacuate_timeseries", {
    p_station_no: stationNo,
    p_hours: hours,
  });
  if (error) throw new Error(`get_taipei_evacuate_timeseries: ${error.message}`);
  return (data ?? []) as EvacuateTimeseriesRow[];
}
