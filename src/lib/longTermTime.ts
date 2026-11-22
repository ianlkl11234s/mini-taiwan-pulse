// 長期時間條的全站共用常數（規範：docs/features/longterm-time/STANDARD.md §1–§2）。
// 各圖層不自訂這些值；欄位形狀在 src/data/layerLongTerm.ts。
import type { LongTermCoverage, LongTermGranularity } from "../data/layerLongTerm";

/** 事件點／大量事件：選取期間達這麼多個月（`>=`）就自動改成熱區（STANDARD.md §1、§4 第 3 題）。 */
export const LONG_TERM_HEATMAP_MIN_MONTHS = 6;

/** 播放速度選項（逐期跳、不漸變；播到最後一期停住）。 */
export const LONG_TERM_PLAY_SPEEDS = [0.5, 1, 2, 4] as const;
export type LongTermPlaySpeed = (typeof LONG_TERM_PLAY_SPEEDS)[number];

/** 預設速度。 */
export const LONG_TERM_DEFAULT_SPEED: LongTermPlaySpeed = 1;

/** 1× 時每一期停留的毫秒數；實際間隔＝本值 ÷ 速度。 */
export const LONG_TERM_MS_PER_PERIOD_AT_1X = 1000;

// ─── 期別軸（由 manifest `longTerm.coverage`＋`granularity` 產生；時間條、圖層標記共用） ───


/** 時間條上的一期。日期一律西元；`month`／`quarter`／`day` 只在對應粒度時有值。 */
export interface LongTermPeriod {
  /** 期別起日（西元 `YYYY-MM-DD`） */
  start: string;
  year: number;
  /** 1–12（month／day 粒度） */
  month?: number;
  /** 1–4（quarter 粒度） */
  quarter?: number;
  /** 1–31（day 粒度） */
  day?: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

/** `end: "ongoing"` 以今天（台北日期）為止。 */
export function coverageEnd(coverage: LongTermCoverage, now: Date = new Date()): string {
  if (coverage.end !== "ongoing") return coverage.end;
  const taipei = new Date(now.getTime() + 8 * 3600_000);
  return ymd(taipei.getUTCFullYear(), taipei.getUTCMonth() + 1, taipei.getUTCDate());
}

/** 依涵蓋與粒度列出所有期別（由舊到新）。 */
export function longTermPeriods(coverage: LongTermCoverage, granularity: LongTermGranularity, now: Date = new Date()): LongTermPeriod[] {
  const s = parseYmd(coverage.start);
  const e = parseYmd(coverageEnd(coverage, now));
  const out: LongTermPeriod[] = [];
  if (granularity === "year") {
    for (let y = s.y; y <= e.y; y++) out.push({ start: ymd(y, 1, 1), year: y });
  } else if (granularity === "quarter") {
    for (let y = s.y; y <= e.y; y++) {
      const q0 = y === s.y ? Math.ceil(s.m / 3) : 1;
      const q1 = y === e.y ? Math.ceil(e.m / 3) : 4;
      for (let q = q0; q <= q1; q++) out.push({ start: ymd(y, (q - 1) * 3 + 1, 1), year: y, quarter: q });
    }
  } else if (granularity === "month") {
    for (let y = s.y, m = s.m; y < e.y || (y === e.y && m <= e.m); m === 12 ? (y++, m = 1) : m++) {
      out.push({ start: ymd(y, m, 1), year: y, month: m });
    }
  } else {
    const t0 = Date.UTC(s.y, s.m - 1, s.d);
    const t1 = Date.UTC(e.y, e.m - 1, e.d);
    for (let t = t0; t <= t1; t += 86_400_000) {
      const d = new Date(t);
      out.push({ start: ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    }
  }
  return out;
}

/** 月粒度：西元年＋月 → 期別索引；落在涵蓋外回 -1。 */
export function monthPeriodIndex(periods: readonly LongTermPeriod[], year: number, month: number): number {
  const first = periods[0];
  if (!first || first.month == null) return -1;
  const i = (year - first.year) * 12 + (month - first.month);
  return i >= 0 && i < periods.length ? i : -1;
}

/** 選取幾期（含兩端）時是否改畫熱區：只看月數，門檻是 `LONG_TERM_HEATMAP_MIN_MONTHS`（`>=`）。 */
export function longTermUsesHeatmap(granularity: LongTermGranularity, periodsSelected: number): boolean {
  const months = granularity === "year" ? periodsSelected * 12
    : granularity === "quarter" ? periodsSelected * 3
      : granularity === "month" ? periodsSelected
        : periodsSelected / 30;
  return months >= LONG_TERM_HEATMAP_MIN_MONTHS;
}

/** 民國年（台灣圖層顯示用）。 */
export const rocYear = (adYear: number) => adYear - 1911;
