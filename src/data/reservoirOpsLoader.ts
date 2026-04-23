import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 水庫近期進/出流量聚合（for 3D 雙排日柱視覺化 — BL-5 方案 D）
 *
 * 後端：gis-platform migration 047 的 get_reservoir_timeseries
 *   回傳 hourly 觀測，前端聚合成「近 N 日每日平均 cms」
 *
 * 輸出供 ReservoirScene.setActiveOps 使用：
 *   {
 *     reservoir_id,
 *     days: [{ date, inflow_cms, outflow_cms }, ...]  // 最舊在前
 *   }
 *
 * 為什麼不直接用 reservoir_daily_ops？
 *   daily_ops 目前只有 ~4 天歷史且欄位單位是 wan_m3/day，
 *   hourly reservoir_status 有 5+ 天且欄位直接是 cms，算日平均更直觀。
 */

interface TimeseriesRow {
  snapshot_at: string;
  inflow_cms: number | null;
  total_outflow_cms: number | null;
}

export interface ReservoirOpsDay {
  date: string;            // YYYY-MM-DD（Asia/Taipei）
  inflow_cms: number;      // 當日平均進流
  outflow_cms: number;     // 當日平均出流
}

export interface ReservoirOpsRecent {
  reservoir_id: string;
  days: ReservoirOpsDay[]; // 最舊在前，長度可能 < days 參數（資料不足）
  max_outflow_cms: number;
}

function dateKeyTaipei(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** 近 N 日每日平均進/出流量 */
export async function fetchReservoirOpsRecent(
  reservoirId: string,
  days = 5,
): Promise<ReservoirOpsRecent> {
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

  // 依日期（台北時區）聚合
  const byDate = new Map<string, { inSum: number; outSum: number; nIn: number; nOut: number }>();
  for (const r of rows) {
    const key = dateKeyTaipei(r.snapshot_at);
    let entry = byDate.get(key);
    if (!entry) {
      entry = { inSum: 0, outSum: 0, nIn: 0, nOut: 0 };
      byDate.set(key, entry);
    }
    if (r.inflow_cms != null) { entry.inSum += r.inflow_cms; entry.nIn++; }
    if (r.total_outflow_cms != null) { entry.outSum += r.total_outflow_cms; entry.nOut++; }
  }

  const daysList: ReservoirOpsDay[] = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      inflow_cms: v.nIn > 0 ? v.inSum / v.nIn : 0,
      outflow_cms: v.nOut > 0 ? v.outSum / v.nOut : 0,
    }));

  const maxOut = daysList.reduce((m, d) => Math.max(m, d.outflow_cms), 0);

  return { reservoir_id: reservoirId, days: daysList, max_outflow_cms: maxOut };
}
