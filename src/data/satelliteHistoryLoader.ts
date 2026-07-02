/**
 * Satellite Console §E / §F — TLE 歷史
 *
 * 對應 gis-platform migration 169:
 * - get_satellite_tle_history(p_norad, p_days)
 * - get_satellite_tle_pair(p_norad, p_prev_epoch, p_curr_epoch)
 *
 * §E 變軌時間軸：30 天歷史 TLE → 偵測 epoch 變化
 * §F 前後對比 modal：拿變軌前後兩條 TLE 跑 SGP4
 */
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

export interface TleHistoryRow {
  norad_id: number;
  name: string | null;
  tle_line1: string;
  tle_line2: string;
  tle_epoch: string;
  inclination: number | null;
  eccentricity: number | null;
  period_min: number | null;
  fetched_at: string;
}

export interface TlePair {
  prev: TleHistoryRow | null;
  curr: TleHistoryRow | null;
}

const tleHistoryCache = keyedThunkCache<TleHistoryRow[]>(10 * 60_000);

/** 30 天 TLE 歷史。10min TTL 快取（key=norad:days），重選同衛星不重打（失敗不留快取） */
export function fetchTleHistory(norad: number, days = 30): Promise<TleHistoryRow[]> {
  if (!supabaseConfigured) return Promise.resolve([]);
  return tleHistoryCache(`${norad}:${days}`, () => fetchTleHistoryUncached(norad, days)).catch(
    (err) => {
      console.warn(`[satconsole] get_satellite_tle_history(${norad}) failed:`, err);
      return [] as TleHistoryRow[];
    },
  );
}

async function fetchTleHistoryUncached(norad: number, days: number): Promise<TleHistoryRow[]> {
  const { data, error } = await withLoading(
    `satellite:tle-history:${norad}`,
    `TLE 歷史 ${norad}`,
    supabase.rpc("get_satellite_tle_history", { p_norad: norad, p_days: days }),
  );
  if (error) throw new Error(`get_satellite_tle_history(${norad}): ${error.message}`);
  return (data ?? []) as TleHistoryRow[];
}

export async function fetchTlePair(
  norad: number,
  prevEpoch: string,
  currEpoch: string,
): Promise<TlePair> {
  if (!supabaseConfigured) return { prev: null, curr: null };
  const { data, error } = await withLoading(
    `satellite:tle-pair:${norad}`,
    `變軌前後 TLE ${norad}`,
    supabase.rpc("get_satellite_tle_pair", {
      p_norad: norad,
      p_prev_epoch: prevEpoch,
      p_curr_epoch: currEpoch,
    }),
  );
  if (error) {
    console.warn(`[satconsole] get_satellite_tle_pair(${norad}) failed:`, error.message);
    return { prev: null, curr: null };
  }
  const rows = (data ?? []) as Array<TleHistoryRow & { side: "prev" | "curr" }>;
  return {
    prev: rows.find((r) => r.side === "prev") ?? null,
    curr: rows.find((r) => r.side === "curr") ?? null,
  };
}

/**
 * 從 TLE 歷史推算變軌事件：
 * 連續兩筆 TLE 的 inclination/eccentricity/period_min 變化超過閾值就標 event。
 * 給 §E 衛星百科卡的「變軌時間軸」用，免再打一次 satellite_maneuvers RPC。
 */
export interface DerivedManeuverEvent {
  date: string;             // YYYY-MM-DD（取 fetched_at TZ=Taiwan）
  type: "ALTITUDE_CHANGE" | "PLANE_CHANGE" | "SHAPE_CHANGE";
  detail: string;
  deltaInclination?: number;
  deltaEccentricity?: number;
  deltaPeriodMin?: number;
}

const T_INC = 0.01;       // 度
const T_PERIOD = 0.03;    // min
const T_ECC = 1e-5;       // 無單位

export function deriveManeuverEvents(history: TleHistoryRow[]): DerivedManeuverEvent[] {
  // history 是 DESC 排序，從舊到新比對較直觀，先反轉
  const asc = [...history].reverse();
  const out: DerivedManeuverEvent[] = [];
  for (let i = 1; i < asc.length; i++) {
    const prev = asc[i - 1]!;
    const curr = asc[i]!;
    const di = (curr.inclination ?? 0) - (prev.inclination ?? 0);
    const dp = (curr.period_min ?? 0) - (prev.period_min ?? 0);
    const de = (curr.eccentricity ?? 0) - (prev.eccentricity ?? 0);
    const ai = Math.abs(di), ap = Math.abs(dp), ae = Math.abs(de);
    if (ai < T_INC && ap < T_PERIOD && ae < T_ECC) continue;
    let type: DerivedManeuverEvent["type"] = "ALTITUDE_CHANGE";
    let detail = "";
    // 軌道面變化權重最高
    if (ai >= T_INC && ai * 100 > ap * 0.5) {
      type = "PLANE_CHANGE";
      detail = `傾角 ${di > 0 ? "+" : ""}${di.toFixed(2)}°`;
    } else if (ap >= T_PERIOD) {
      type = "ALTITUDE_CHANGE";
      detail = `週期 ${dp > 0 ? "+" : ""}${dp.toFixed(2)} min`;
    } else if (ae >= T_ECC) {
      type = "SHAPE_CHANGE";
      detail = `離心率 ${de > 0 ? "+" : ""}${de.toExponential(1)}`;
    } else {
      continue;
    }
    const date = curr.fetched_at.slice(0, 10);
    void prev; // prev 已用於 delta 計算，這行只是讓 ts noUnusedLocals 滿意（其實沒事）
    out.push({
      date,
      type,
      detail,
      deltaInclination: di,
      deltaEccentricity: de,
      deltaPeriodMin: dp,
    });
  }
  // 反轉回 DESC（最新在前）
  return out.reverse();
}

/** μ ± σ 啟發式預測：基於歷史變軌間隔的均值與標準差 */
export interface PredictionStats {
  muDays: number | null;
  sigmaDays: number | null;
  nextLowDays: number | null;
  nextHighDays: number | null;
  confidencePercent: number | null;
  sampleSize: number;
}

export function computePrediction(events: DerivedManeuverEvent[]): PredictionStats {
  if (events.length < 2) {
    return { muDays: null, sigmaDays: null, nextLowDays: null, nextHighDays: null, confidencePercent: null, sampleSize: events.length };
  }
  // events 是 DESC，間隔 = 第 i 與第 i+1 的日期差
  const intervals: number[] = [];
  for (let i = 0; i < events.length - 1; i++) {
    const t1 = new Date(events[i]!.date).getTime();
    const t2 = new Date(events[i + 1]!.date).getTime();
    intervals.push(Math.abs(t1 - t2) / (86400 * 1000));
  }
  const mu = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sigma = Math.sqrt(
    intervals.reduce((a, b) => a + (b - mu) ** 2, 0) / intervals.length,
  );
  // 信心區間以樣本數遞增（n=2 → 40%，n=10 → 80% 上限）
  const confidence = Math.min(80, 30 + intervals.length * 5);
  return {
    muDays: mu,
    sigmaDays: sigma,
    nextLowDays: Math.max(1, Math.round(mu - sigma)),
    nextHighDays: Math.round(mu + sigma),
    confidencePercent: confidence,
    sampleSize: intervals.length + 1,
  };
}
