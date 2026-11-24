/**
 * 以 IANA 時區名稱換算日期的唯一地基（純函式、無 React、無全域狀態；快取只是 formatter／位移的記憶）。
 *
 * 站內時間本身是 unix 秒／毫秒（與時區無關）；時區只出現在「日期換算與顯示」。
 * 有日光節約時間（DST）的國家，一天可能是 23 或 25 小時，所以一律用時區名稱算，
 * 不可再寫固定 +8／`+08:00` 算日界。台北 helper（taipeiDay.ts 等）是本檔的薄包裝。
 *
 * 做法：所有輸出都由「該時刻的 UTC 位移」推導——位移用 Intl（每個 tz 一個 formatter）取得，
 * 之後的年月日時分秒用 `new Date(ms + 位移)` 的 UTC getter 算。
 *
 * 快速路徑：時間軸每幀都會呼叫。對 1980–2040 內位移固定的時區（Asia/Taipei、Tokyo、Manila…），
 * 第一次使用時以每週取樣驗證「整段期間位移固定」（結果快取），之後完全不碰 Intl。
 * 範圍外或有 DST 的時區照走 Intl，結果一致。
 */

export const DEFAULT_TIME_ZONE = "Asia/Taipei";

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
  weekday: number; // 0＝週日 … 6＝週六
}

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const FIXED_FROM_MS = Date.UTC(1980, 0, 1);
const FIXED_TO_MS = Date.UTC(2040, 0, 1);
const SAMPLE_STEP_MS = 7 * MS_PER_DAY;

const formatters = new Map<string, Intl.DateTimeFormat>();
const fixedOffsets = new Map<string, number | null>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, fmt);
  }
  return fmt;
}

/** 慢路徑：用 Intl 取該時刻的位移（毫秒）。 */
function slowOffsetMs(ms: number, tz: string): number {
  if (!Number.isFinite(ms)) return NaN;
  const whole = Math.floor(ms / 1000) * 1000;
  let year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0;
  for (const p of formatterFor(tz).formatToParts(whole)) {
    switch (p.type) {
      case "year": year = Number(p.value); break;
      case "month": month = Number(p.value); break;
      case "day": day = Number(p.value); break;
      case "hour": hour = Number(p.value) % 24; break;
      case "minute": minute = Number(p.value); break;
      case "second": second = Number(p.value); break;
    }
  }
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, 0);
  return wall.getTime() - whole;
}

/** 1980–2040 內位移是否固定；是 → 回該位移（毫秒），否 → null。每個 tz 只算一次。 */
function fixedOffsetMs(tz: string): number | null {
  const hit = fixedOffsets.get(tz);
  if (hit !== undefined) return hit;
  const base = slowOffsetMs(FIXED_FROM_MS, tz);
  let fixed: number | null = base;
  for (let t = FIXED_FROM_MS + SAMPLE_STEP_MS; t <= FIXED_TO_MS; t += SAMPLE_STEP_MS) {
    if (slowOffsetMs(t, tz) !== base) {
      fixed = null;
      break;
    }
  }
  fixedOffsets.set(tz, fixed);
  return fixed;
}

/** 該時刻 tz 相對 UTC 的位移（毫秒）。NaN 輸入回 NaN。 */
function offsetMs(ms: number, tz: string): number {
  if (!(ms < FIXED_FROM_MS || ms > FIXED_TO_MS)) {
    const fixed = fixedOffsetMs(tz);
    if (fixed !== null) return fixed;
  }
  return slowOffsetMs(ms, tz);
}

/** 該時刻 tz 相對 UTC 的位移（分鐘，東正西負；Asia/Taipei＝480）。 */
export function zonedOffsetMinutes(ms: number, tz: string = DEFAULT_TIME_ZONE): number {
  return offsetMs(ms, tz) / MS_PER_MINUTE;
}

/** 該時刻 tz 的牆上時間分量。 */
export function zonedParts(ms: number, tz: string = DEFAULT_TIME_ZONE): ZonedParts {
  const d = new Date(ms + offsetMs(ms, tz));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** 該時刻 tz 的曆日 YYYY-MM-DD。非有限數回 "Invalid Date"（與 toLocaleDateString 行為一致）。 */
export function zonedDateKey(ms: number, tz: string = DEFAULT_TIME_ZONE): string {
  if (!Number.isFinite(ms)) return "Invalid Date";
  const p = zonedParts(ms, tz);
  return `${pad(p.year, 4)}-${pad(p.month, 2)}-${pad(p.day, 2)}`;
}

/** 該時刻 tz 的「一天中的秒數」（含小數；DST 當天最大可達 86400 以上／不足）。 */
export function zonedSecondsOfDay(ms: number, tz: string = DEFAULT_TIME_ZONE): number {
  const p = zonedParts(ms, tz);
  const frac = (ms - Math.floor(ms / 1000) * 1000) / 1000;
  return p.hour * 3600 + p.minute * 60 + p.second + frac;
}

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * tz 的曆日 dateKey（YYYY-MM-DD）當地 00:00 的 epoch ms。
 * 午夜重複（秋季回撥）取較早者；午夜不存在（春季跳進）取當日第一個存在的瞬間。無效 dateKey 回 NaN。
 */
export function zonedMidnightMs(dateKey: string, tz: string = DEFAULT_TIME_ZONE): number {
  const m = DATE_KEY_RE.exec(dateKey);
  if (!m) return NaN;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(wall)) return NaN;
  if (!(wall < FIXED_FROM_MS || wall > FIXED_TO_MS)) {
    const fixed = fixedOffsetMs(tz);
    if (fixed !== null) return wall - fixed;
  }
  // 候選：前後一天的位移各推一個瞬間，取「牆上時間恰為午夜」且較早者
  const candidates = [wall - slowOffsetMs(wall - MS_PER_DAY, tz), wall - slowOffsetMs(wall + MS_PER_DAY, tz)]
    .filter((t) => t + slowOffsetMs(t, tz) === wall)
    .sort((a, b) => a - b);
  if (candidates.length > 0) return candidates[0]!;
  // 午夜不存在：二分搜尋第一個「牆上日期 >= dateKey」的瞬間
  let lo = wall - 2 * MS_PER_DAY;
  let hi = wall + 2 * MS_PER_DAY;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (zonedDateKey(mid, tz) >= dateKey) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * 曆日 dateKey 加減 days 天（純日曆運算，與時區無關）。無效 dateKey 回 "Invalid Date"。
 * 不要用 `new Date(...).setDate()`＋`toISOString()`：前者依瀏覽器時區、後者取 UTC 日，兩者混用會差一天。
 */
export function shiftDateKey(dateKey: string, days: number): string {
  const m = DATE_KEY_RE.exec(dateKey);
  if (!m) return "Invalid Date";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

/** tz 的曆日 dateKey 的 [startMs, endMs)（長度 23／24／25 小時）。 */
export function zonedDayRangeMs(dateKey: string, tz: string = DEFAULT_TIME_ZONE): [number, number] {
  const m = DATE_KEY_RE.exec(dateKey);
  if (!m) return [NaN, NaN];
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  const nextKey = `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1, 2)}-${pad(next.getUTCDate(), 2)}`;
  return [zonedMidnightMs(dateKey, tz), zonedMidnightMs(nextKey, tz)];
}
