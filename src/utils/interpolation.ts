import type { TrailPoint } from "../types";

/**
 * 根據時間插值取得軌跡上的位置
 * 回傳 [lat, lng, alt_m] 或 null（如果時間超出範圍）
 */
export function interpolatePosition(
  path: TrailPoint[],
  time: number,
): [number, number, number] | null {
  if (path.length === 0) return null;

  const first = path[0]!;
  const last = path[path.length - 1]!;

  if (time <= first[3]) return [first[0], first[1], first[2]];
  if (time >= last[3]) return [last[0], last[1], last[2]];

  // 找到時間區間
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    if (time >= a[3] && time <= b[3]) {
      const t = (time - a[3]) / (b[3] - a[3]);
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
    }
  }

  return null;
}

/**
 * 取得到指定時間為止的軌跡段
 * 用於繪製「已經過的光軌」
 */
export function getTrailUpToTime(
  path: TrailPoint[],
  time: number,
  maxTrailDuration: number = 300, // 預設保留最近 300 秒的軌跡
): TrailPoint[] {
  const cutoffTime = time - maxTrailDuration;
  const result: TrailPoint[] = [];

  for (const pt of path) {
    if (pt[3] > time) break;
    if (pt[3] >= cutoffTime) {
      result.push(pt);
    }
  }

  // 加入插值的當前位置
  const currentPos = interpolatePosition(path, time);
  if (currentPos && result.length > 0) {
    result.push([currentPos[0], currentPos[1], currentPos[2], time]);
  }

  return result;
}

/**
 * 判斷航班在指定時間是否在飛行中
 */
export function isFlightActive(path: TrailPoint[], time: number): boolean {
  if (path.length === 0) return false;
  return time >= path[0]![3] && time <= path[path.length - 1]![3];
}
