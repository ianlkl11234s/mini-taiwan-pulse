/**
 * 新聞四格的來源新鮮度輸入（純函式，可測）。
 *
 * - 判斷用時間不能取自「依日期＋使用者篩選」的 clusters：切到歷史日期、或只剩未定位／低分新聞時，
 *   最新一則本來就很舊，不代表收集器停了。
 * - 收集器是否活著改看未篩選的來源健康（`last_success_at` 最大值）；沒有就不下「停了」的結論。
 * - 看歷史日期時不判斷新鮮度（回傳 dataMs＝現在），標題列時間仍顯示該日資料時間。
 */
export const NEWS_QUIET_MAX_MS = 12 * 3600_000;

export interface NewsFreshnessArgs {
  dayKey: string;
  nowMs: number;
  latestNewsMs: number | null;
  aggregatedMs: number | null;
  /** 未篩選來源健康 last_success_at 的最大值（epoch ms） */
  healthMs: number | null;
}

export interface NewsFreshnessInput {
  /** 標題列顯示的時間 */
  time: number | null;
  /** 判斷用的資料時間 */
  dataMs: number | null;
  reason?: string;
  quiet: boolean;
}

export const taipeiDayKey = (ms: number): string => new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);

export function maxSourceSuccessMs(rows: readonly { last_success_at: string | null }[] | null | undefined): number | null {
  let max: number | null = null;
  for (const r of rows ?? []) {
    const t = r.last_success_at ? Date.parse(r.last_success_at) : NaN;
    if (Number.isFinite(t) && (max === null || t > max)) max = t;
  }
  return max;
}

export function newsFreshnessInput(a: NewsFreshnessArgs): NewsFreshnessInput {
  const shown = a.aggregatedMs ?? a.latestNewsMs;
  if (a.dayKey < taipeiDayKey(a.nowMs)) {
    return { time: a.latestNewsMs, dataMs: a.nowMs, quiet: false };
  }
  const quiet = a.healthMs != null && a.nowMs - a.healthMs > NEWS_QUIET_MAX_MS;
  if (quiet) {
    return { time: a.healthMs, dataMs: a.healthMs, reason: "新聞來源已超過 12 小時沒有成功收集，收集可能停了", quiet: true };
  }
  return { time: shown, dataMs: shown, quiet: false };
}
