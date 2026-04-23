import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 水庫近期進/出流量聚合（for 3D 雙柱視覺化 — BL-5 方案 D）
 *
 * 後端：gis-platform migration 047 的 get_reservoir_timeseries
 *   回傳 hourly 觀測，前端聚合成「近 N 日平均 cms」
 *
 * 為什麼不直接用 reservoir_daily_ops？
 *   daily_ops 目前只有 4 天歷史且欄位單位是 wan_m3/day（需再換算），
 *   hourly reservoir_status 有 5+ 天且欄位直接是 cms，算平均更直觀。
 */

interface TimeseriesRow {
  snapshot_at: string;
  inflow_cms: number | null;
  total_outflow_cms: number | null;
}

export interface ReservoirOpsSummary {
  reservoir_id: string;
  avg_inflow_cms: number;
  avg_outflow_cms: number;
  max_outflow_cms: number;
  sample_count: number;
  from: string;
  to: string;
}

/** 近 N 日平均進/出流量（cms） */
export async function fetchReservoirOpsRecent(
  reservoirId: string,
  days = 3,
): Promise<ReservoirOpsSummary> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 3600 * 1000);
  const { data, error } = await withLoading(
    `reservoir-ops-${reservoirId}`,
    `水庫進出流 ${reservoirId}`,
    supabase.rpc("get_reservoir_timeseries", {
      p_reservoir_id: reservoirId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  );
  if (error) throw new Error(`get_reservoir_timeseries(${reservoirId}): ${error.message}`);
  const rows = (data ?? []) as TimeseriesRow[];
  if (rows.length === 0) {
    return {
      reservoir_id: reservoirId,
      avg_inflow_cms: 0,
      avg_outflow_cms: 0,
      max_outflow_cms: 0,
      sample_count: 0,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }
  let sumIn = 0, sumOut = 0, nIn = 0, nOut = 0, maxOut = 0;
  for (const r of rows) {
    if (r.inflow_cms != null) { sumIn += r.inflow_cms; nIn++; }
    if (r.total_outflow_cms != null) {
      sumOut += r.total_outflow_cms;
      nOut++;
      if (r.total_outflow_cms > maxOut) maxOut = r.total_outflow_cms;
    }
  }
  return {
    reservoir_id: reservoirId,
    avg_inflow_cms: nIn > 0 ? sumIn / nIn : 0,
    avg_outflow_cms: nOut > 0 ? sumOut / nOut : 0,
    max_outflow_cms: maxOut,
    sample_count: rows.length,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
