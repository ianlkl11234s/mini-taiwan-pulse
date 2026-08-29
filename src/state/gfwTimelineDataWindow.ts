export interface GfwTimelineWindow {
  readonly layers: readonly string[];
  readonly startUtcSeconds: number;
  readonly endUtcSecondsExclusive: number;
}

export function utcDateWindowSeconds(
  startUtcDate: string,
  endUtcDate: string,
): { startUtcSeconds: number; endUtcSecondsExclusive: number } | null {
  const start = Date.parse(`${startUtcDate}T00:00:00Z`) / 1000;
  const end = Date.parse(`${endUtcDate}T00:00:00Z`) / 1000 + 86_400;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { startUtcSeconds: start, endUtcSecondsExclusive: end };
}

/**
 * 取最接近目前時間、且確實落在 release 內的 UTC 整點。
 * 這只是 button target 的純計算；不會讀寫 timeStore，也不會自動 clamp。
 */
export function nearestGfwWindowHour(
  currentTime: number,
  startUtcSeconds: number,
  endUtcSecondsExclusive: number,
): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(startUtcSeconds)
    || !Number.isFinite(endUtcSecondsExclusive) || endUtcSecondsExclusive <= startUtcSeconds) return null;
  if (currentTime < startUtcSeconds) return Math.ceil(startUtcSeconds / 3_600) * 3_600;
  if (currentTime >= endUtcSecondsExclusive) {
    return Math.floor((endUtcSecondsExclusive - 1) / 3_600) * 3_600;
  }
  return Math.floor(currentTime / 3_600) * 3_600;
}

export function formatGfwUtcWindow(
  startUtcSeconds: number,
  endUtcSecondsExclusive: number,
): string {
  const format = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ");
  return `${format(startUtcSeconds)}–${format(endUtcSecondsExclusive)} UTC`;
}

/** 合併 Grid／Tracks 相同的正式 release 視窗，避免時間軸重複顯示兩張警告。 */
export function mergeGfwTimelineWindows(windows: readonly GfwTimelineWindow[]): GfwTimelineWindow[] {
  const merged = new Map<string, GfwTimelineWindow>();
  for (const window of windows) {
    const key = `${window.startUtcSeconds}|${window.endUtcSecondsExclusive}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, window);
      continue;
    }
    merged.set(key, { ...previous, layers: [...previous.layers, ...window.layers] });
  }
  return [...merged.values()];
}
