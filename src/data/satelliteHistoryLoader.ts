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

/** error：null = 讀取成功（prev/curr 為 null 代表資料庫沒有該筆）；否則是讀取失敗，與「查無資料」分開 */
export type LoaderFailure = "unconfigured" | "rpc";

export interface TlePair {
  prev: TleHistoryRow | null;
  curr: TleHistoryRow | null;
  error: LoaderFailure | null;
}

export type TleHistoryResult =
  | { ok: true; rows: TleHistoryRow[] }
  | { ok: false; reason: LoaderFailure };

const tleHistoryCache = keyedThunkCache<TleHistoryRow[]>(10 * 60_000);

/** 30 天 TLE 歷史。10min TTL 快取（key=norad:days），重選同衛星不重打（失敗不留快取） */
export function fetchTleHistory(norad: number, days = 30): Promise<TleHistoryResult> {
  if (!supabaseConfigured) return Promise.resolve({ ok: false, reason: "unconfigured" });
  return tleHistoryCache(`${norad}:${days}`, () => fetchTleHistoryUncached(norad, days)).then(
    (rows): TleHistoryResult => ({ ok: true, rows }),
    (err): TleHistoryResult => {
      console.warn(`[satconsole] get_satellite_tle_history(${norad}) failed:`, err);
      return { ok: false, reason: "rpc" };
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
  if (!supabaseConfigured) return { prev: null, curr: null, error: "unconfigured" };
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
    return { prev: null, curr: null, error: "rpc" };
  }
  const rows = (data ?? []) as Array<TleHistoryRow & { side: "prev" | "curr" }>;
  return {
    prev: rows.find((r) => r.side === "prev") ?? null,
    curr: rows.find((r) => r.side === "curr") ?? null,
    error: null,
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

function deltaOrNull(curr: number | null, prev: number | null): number | null {
  return curr == null || prev == null ? null : curr - prev;
}

export function deriveManeuverEvents(history: TleHistoryRow[]): DerivedManeuverEvent[] {
  // history 是 DESC 排序，從舊到新比對較直觀，先反轉
  const asc = [...history].reverse();
  const out: DerivedManeuverEvent[] = [];
  for (let i = 1; i < asc.length; i++) {
    const prev = asc[i - 1]!;
    const curr = asc[i]!;
    // 任一端為 null 就略過該欄（不當 0 相減，否則 null→有值會變成假變軌）
    const di = deltaOrNull(curr.inclination, prev.inclination);
    const dp = deltaOrNull(curr.period_min, prev.period_min);
    const de = deltaOrNull(curr.eccentricity, prev.eccentricity);
    const ai = di == null ? 0 : Math.abs(di);
    const ap = dp == null ? 0 : Math.abs(dp);
    const ae = de == null ? 0 : Math.abs(de);
    if (ai < T_INC && ap < T_PERIOD && ae < T_ECC) continue;
    let type: DerivedManeuverEvent["type"] = "ALTITUDE_CHANGE";
    let detail = "";
    // 軌道面變化權重最高
    if (di != null && ai >= T_INC && ai * 100 > ap * 0.5) {
      type = "PLANE_CHANGE";
      detail = `傾角 ${di > 0 ? "+" : ""}${di.toFixed(2)}°`;
    } else if (dp != null && ap >= T_PERIOD) {
      type = "ALTITUDE_CHANGE";
      detail = `週期 ${dp > 0 ? "+" : ""}${dp.toFixed(2)} min`;
    } else if (de != null && ae >= T_ECC) {
      type = "SHAPE_CHANGE";
      detail = `離心率 ${de > 0 ? "+" : ""}${de.toExponential(1)}`;
    } else {
      continue;
    }
    const date = curr.fetched_at.slice(0, 10);
    out.push({
      date,
      type,
      detail,
      deltaInclination: di ?? undefined,
      deltaEccentricity: de ?? undefined,
      deltaPeriodMin: dp ?? undefined,
    });
  }
  // 反轉回 DESC（最新在前）
  return out.reverse();
}

/** μ ± σ 啟發式預測：基於歷史變軌間隔的均值與標準差（只是依間隔推估，不是統計信心） */
export interface PredictionStats {
  muDays: number | null;
  sigmaDays: number | null;
  nextLowDays: number | null;
  nextHighDays: number | null;
  sampleSize: number;
}

/** 至少要有幾個「變軌間隔」才給預測（<3 個間隔 σ 沒有意義，n=2 時 σ 恆為 0） */
export const MIN_PREDICTION_INTERVALS = 3;

export function computePrediction(events: DerivedManeuverEvent[]): PredictionStats {
  if (events.length - 1 < MIN_PREDICTION_INTERVALS) {
    return { muDays: null, sigmaDays: null, nextLowDays: null, nextHighDays: null, sampleSize: events.length };
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
  return {
    muDays: mu,
    sigmaDays: sigma,
    nextLowDays: Math.max(1, Math.round(mu - sigma)),
    nextHighDays: Math.round(mu + sigma),
    sampleSize: intervals.length + 1,
  };
}
