// 房地產時間軸：連續日期游標（unix 秒）。季/月/週 = 點淡入淡出的時間窗大小。
// grid 永遠按游標所在「季」snapshot；point 依 trade_ts 與游標距離做梯形窗透明度。

export type ReGran = "quarter" | "month" | "week";

export const RE_PERIODS = ["2024Q3", "2024Q4", "2025Q1", "2025Q2", "2025Q3", "2025Q4", "2026Q1"];

export const DAY = 86400;
// 各季起始（UTC 秒）
const Q_START_TS = [
  Date.UTC(2024, 6, 1), Date.UTC(2024, 9, 1), Date.UTC(2025, 0, 1), Date.UTC(2025, 3, 1),
  Date.UTC(2025, 6, 1), Date.UTC(2025, 9, 1), Date.UTC(2026, 0, 1),
].map((ms) => ms / 1000);

export const RANGE_START = Q_START_TS[0]!;             // 2024-07-01
export const RANGE_END = Date.UTC(2026, 2, 31) / 1000; // 2026-03-31（2026Q1 末）

/** 游標所在季的 period 字串（grid filter 用） */
export function quarterOfTs(ts: number): string {
  let idx = 0;
  for (let k = 0; k < Q_START_TS.length; k++) {
    if (ts >= Q_START_TS[k]!) idx = k;
  }
  return RE_PERIODS[idx]!;
}

/** 把任意 ts 吸附到所在季的起始（季粒度 slider/播放用） */
export function snapQuarterStart(ts: number): number {
  let v = Q_START_TS[0]!;
  for (const q of Q_START_TS) if (ts >= q) v = q;
  return v;
}

/** 下一季起始（季播放推進）；已是最後一季回傳自身 */
export function nextQuarterStart(ts: number): number {
  for (const q of Q_START_TS) if (q > ts + 1) return q;
  return Q_START_TS[Q_START_TS.length - 1]!;
}

/** unix 秒 → YYYY-MM-DD（UTC） */
export function tsToDate(ts: number): string {
  const d = new Date(ts * 1000);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/** 游標標籤 */
export function reLabel(gran: ReGran, ts: number): string {
  if (gran === "quarter") return quarterOfTs(ts);
  const date = tsToDate(ts);
  return gran === "month" ? date.slice(0, 7) : date;
}

/** point 梯形時間窗（秒）：full = 全亮、fade = 之後淡出尾段 */
export function reWindow(gran: ReGran): { full: number; fade: number } {
  // 俐落版：縮短淡出尾，減少「延續」感（畫面較稀疏為取捨）
  if (gran === "week") return { full: 2 * DAY, fade: 3 * DAY };
  if (gran === "month") return { full: 6 * DAY, fade: 10 * DAY };
  return { full: 0, fade: 0 }; // quarter 用 period filter
}

/** 整段播放秒數（依粒度，speed 再分母）：週掃得慢、季跳得快 */
export function rePlaySeconds(gran: ReGran): number {
  if (gran === "week") return 40;
  if (gran === "month") return 28;
  return 14; // quarter（7 季）
}
