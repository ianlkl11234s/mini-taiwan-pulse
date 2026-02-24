/**
 * 共享軌道工具函數
 * 被 RailEngine 和 TraTrainEngine 共用
 */

/** 延長日制起始點：05:50（台鐵/捷運營運日分界） */
export const DAY_START_SECONDS = 5 * 3600 + 50 * 60; // 21000

/** 時間字串 "HH:MM:SS" 轉為延長日秒數（05:50 前的時間 +86400） */
export function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  const totalSec = h * 3600 + m * 60 + s;
  return totalSec < DAY_START_SECONDS ? totalSec + 86400 : totalSec;
}

/** Unix timestamp 轉為延長日秒數（台灣時區 UTC+8） */
export function unixToExtendedDaySeconds(unixTs: number): number {
  const daySeconds = ((unixTs + 8 * 3600) % 86400);
  return daySeconds < DAY_START_SECONDS ? daySeconds + 86400 : daySeconds;
}

/** 計算線段總長度 */
export function calculateTotalLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/** 在 LineString 上進行線性內插 */
export function interpolateOnLineString(
  coords: [number, number][],
  progress: number,
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0]!;
  if (progress <= 0) return coords[0]!;
  if (progress >= 1) return coords[coords.length - 1]!;

  const totalLength = calculateTotalLength(coords);
  const targetDistance = totalLength * progress;

  let accumulated = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!;
    const b = coords[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDistance) {
      const t = (targetDistance - accumulated) / segLen;
      return [
        a[0] + dx * t,
        a[1] + dy * t,
      ];
    }
    accumulated += segLen;
  }

  return coords[coords.length - 1]!;
}
