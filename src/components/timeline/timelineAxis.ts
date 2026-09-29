/**
 * TL3 刻度時間軸的純計算（刻度、缺漏區段、鍵盤步進、歷史離散軸）。
 * 不讀寫 timeStore、不碰 DOM；元件只把結果畫出來。規格見 docs/design-system/spec.md §5.24。
 *
 * 台灣沒有日光節約時間，整點對齊一律用固定 +8h（與 useTimeline 的 dayStartUnix 相同）。
 */

export const TAIPEI_OFFSET_SECONDS = 8 * 3600;
const HOUR = 3600;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export interface AxisTick {
  /** 0–1，軸上位置 */
  readonly pos: number;
  readonly major: boolean;
  /** 只有主刻度有標籤；數字與日期（不含中文），用 FONT_DATA 繪製 */
  readonly label?: string;
}

export interface AxisGap {
  readonly start: number;
  readonly end: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 台北時間的 [月, 日, 時, 分, 星期] */
export function taipeiParts(t: number): { month: number; day: number; hour: number; minute: number; weekday: number } {
  const d = new Date((t + TAIPEI_OFFSET_SECONDS) * 1000);
  return {
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 22:42 */
export function formatClock(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return "--:--";
  const p = taipeiParts(t);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** 9/27 */
export function formatMonthDay(t: number): string {
  const p = taipeiParts(t);
  return `${p.month}/${p.day}`;
}

/** 星期中文（日、一…） */
export function weekdayLabel(t: number): string {
  return WEEKDAYS[taipeiParts(t).weekday] ?? "";
}

/**
 * 即時／回放軸的刻度規則（依 rangeDays）：
 * - 1 天：主刻度每 4 小時（00 04 … 20 24），次刻度每 1 小時
 * - 2 天：主刻度每 6 小時（日界顯示 M/D，其餘 HH），次刻度每 2 小時
 * - 3–7 天：主刻度每天（M/D），次刻度每 6 小時
 */
export function liveAxisStepHours(rangeDays: number): { major: number; minor: number } {
  if (rangeDays <= 1) return { major: 4, minor: 1 };
  if (rangeDays === 2) return { major: 6, minor: 2 };
  return { major: 24, minor: 6 };
}

export function buildLiveTicks(windowStart: number, windowEnd: number, rangeDays: number): AxisTick[] {
  const duration = windowEnd - windowStart;
  if (!(duration > 0)) return [];
  const { major, minor } = liveAxisStepHours(rangeDays);
  // 視窗結尾是 23:59:59；軸上以下一個午夜當 100% 刻度（1 天 → 「24」）
  const axisEnd = Math.ceil((windowEnd + TAIPEI_OFFSET_SECONDS) / HOUR) * HOUR - TAIPEI_OFFSET_SECONDS;
  const first = Math.ceil((windowStart + TAIPEI_OFFSET_SECONDS) / (minor * HOUR)) * minor * HOUR - TAIPEI_OFFSET_SECONDS;
  const ticks: AxisTick[] = [];
  for (let t = first; t <= axisEnd; t += minor * HOUR) {
    const hourOfDay = ((Math.round((t + TAIPEI_OFFSET_SECONDS) / HOUR) % 24) + 24) % 24;
    const isMajor = hourOfDay % major === 0;
    let label: string | undefined;
    if (isMajor) {
      if (rangeDays <= 1) label = t >= axisEnd ? "24" : pad2(hourOfDay);
      else if (hourOfDay === 0) label = formatMonthDay(t);
      else label = pad2(hourOfDay);
    }
    ticks.push({ pos: clamp01((t - windowStart) / duration), major: isMajor, label });
  }
  return ticks;
}

/** 視窗 [windowStart, windowEnd] 中，不在資料窗 [start, endExclusive) 內的區段（0–1）。 */
export function gapsOutsideDataWindow(
  windowStart: number,
  windowEnd: number,
  dataStart: number,
  dataEndExclusive: number,
): AxisGap[] {
  const duration = windowEnd - windowStart;
  if (!(duration > 0) || !Number.isFinite(dataStart) || !Number.isFinite(dataEndExclusive)) return [];
  const gaps: AxisGap[] = [];
  if (dataStart > windowStart) {
    gaps.push({ start: 0, end: clamp01((dataStart - windowStart) / duration) });
  }
  if (dataEndExclusive < windowEnd) {
    gaps.push({ start: clamp01((dataEndExclusive - windowStart) / duration), end: 1 });
  }
  return gaps.filter((g) => g.end > g.start);
}

/** 「漁船資料只到 9/26」等說明。日期用資料源本身的 UTC 日曆日（YYYY-MM-DD）。 */
export function describeDataWindow(
  subject: string,
  windowStart: number,
  windowEnd: number,
  dataStart: number,
  dataEndExclusive: number,
  firstUtcDate: string,
  lastUtcDate: string,
): string | null {
  const md = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return m && d ? `${m}/${d}` : iso;
  };
  const cutStart = dataStart > windowStart;
  const cutEnd = dataEndExclusive < windowEnd;
  if (cutStart && cutEnd) return `${subject}只有 ${md(firstUtcDate)}–${md(lastUtcDate)}`;
  if (cutEnd) return `${subject}只到 ${md(lastUtcDate)}`;
  if (cutStart) return `${subject}從 ${md(firstUtcDate)} 起`;
  return null;
}

/** 鍵盤：←→ 5 分鐘；Shift＋←→ 或 PageUp/PageDown 1 小時；Home/End 到兩端。回傳新時間或 null。 */
export function keyboardSeekTarget(
  key: string,
  shiftKey: boolean,
  current: number,
  windowStart: number,
  windowEnd: number,
): number | null {
  const small = 5 * 60;
  const big = HOUR;
  let next: number;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      next = current - (shiftKey ? big : small);
      break;
    case "ArrowRight":
    case "ArrowUp":
      next = current + (shiftKey ? big : small);
      break;
    case "PageDown":
      next = current - big;
      break;
    case "PageUp":
      next = current + big;
      break;
    case "Home":
      next = windowStart;
      break;
    case "End":
      next = windowEnd;
      break;
    default:
      return null;
  }
  return Math.max(windowStart, Math.min(windowEnd, next));
}

/** 鍵盤：離散軸（歷史模式）的索引步進。 */
export function keyboardIndexTarget(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  let next: number;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      next = index - 1;
      break;
    case "ArrowRight":
    case "ArrowUp":
      next = index + 1;
      break;
    case "PageDown":
      next = index - 3;
      break;
    case "PageUp":
      next = index + 3;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = count - 1;
      break;
    default:
      return null;
  }
  return Math.max(0, Math.min(count - 1, next));
}

// ─── 歷史模式：離散軸 ──────────────────────────────────────────

export interface DiscreteAxis {
  /** 各格的值（民國年、月、日） */
  readonly values: readonly number[];
  readonly index: number;
  readonly ticks: AxisTick[];
}

/** 最多 13 個標籤，超過就隔格標；最後一格一定標，太靠近它的前一個標籤讓位。 */
function discreteTicks(values: readonly number[], labelOf: (v: number) => string, maxLabels = 13): AxisTick[] {
  const n = values.length;
  if (n === 0) return [];
  const stride = Math.max(1, Math.ceil(n / maxLabels));
  return values.map((v, i) => {
    const onStride = i % stride === 0;
    const crowdsLast = stride > 1 && i !== 0 && i < n - 1 && n - 1 - i < stride;
    const labelled = i === n - 1 || (onStride && !crowdsLast);
    const pos = n === 1 ? 0.5 : i / (n - 1);
    return { pos, major: labelled, label: labelled ? labelOf(v) : undefined };
  });
}

export function buildDiscreteAxis(values: readonly number[], current: number, labelOf: (v: number) => string, maxLabels?: number): DiscreteAxis {
  const idx = values.indexOf(current);
  const index = idx >= 0 ? idx : Math.max(0, values.findIndex((v) => v > current) - 1);
  return { values, index, ticks: discreteTicks(values, labelOf, maxLabels) };
}

export function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v++) out.push(v);
  return out;
}

/** 比例（0–1）→ 最近的離散索引 */
export function ratioToIndex(ratio: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clamp01(ratio) * (count - 1));
}

export function indexToRatio(index: number, count: number): number {
  if (count <= 1) return 0.5;
  return clamp01(index / (count - 1));
}

// ─── 房地產游標（連續，季刻度） ─────────────────────────────────

/** "2024Q3" → 該季起始（UTC 秒） */
export function quarterStartTs(period: string): number | null {
  const m = /^(\d{4})Q([1-4])$/.exec(period);
  if (!m) return null;
  return Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1) / 1000;
}

export function buildQuarterTicks(periods: readonly string[], min: number, max: number): AxisTick[] {
  const duration = max - min;
  if (!(duration > 0)) return [];
  const ticks: AxisTick[] = [];
  for (const p of periods) {
    const ts = quarterStartTs(p);
    if (ts === null || ts < min || ts > max) continue;
    ticks.push({ pos: clamp01((ts - min) / duration), major: true, label: p });
    // 每季中間兩個月的次刻度
    for (let k = 1; k <= 2; k++) {
      const d = new Date(ts * 1000);
      const minorTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) / 1000;
      if (minorTs <= max) ticks.push({ pos: clamp01((minorTs - min) / duration), major: false });
    }
  }
  return ticks;
}

