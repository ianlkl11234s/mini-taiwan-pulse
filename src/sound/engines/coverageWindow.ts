/**
 * 涵蓋窗截斷：查「今天」時，尚未發生（或尚未收進來）的時段不可落入 status=ok 的窗，
 * 否則會被算成 inactive＝0（T18）。
 */
export function clipCoverageEnd(dayStart: number, nowUnix: number, lastDataTs?: number | null): number {
  const dayEnd = dayStart + 86_400;
  if (nowUnix >= dayEnd) return dayEnd;
  if (nowUnix <= dayStart) return dayStart;
  return lastDataTs == null ? nowUnix : Math.max(dayStart, Math.min(nowUnix, lastDataTs));
}
