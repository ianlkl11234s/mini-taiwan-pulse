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
 * 取得到指定時間為止的軌跡段（等距內插版本）
 *
 * 生成等間距的平滑點，避免原始資料稀疏導致 trail 跳動。
 * 使用 progressive index 遍歷 path，時間複雜度 O(outputPoints)。
 *
 * @param path         原始軌跡點
 * @param time         當前時間
 * @param duration     保留的最大秒數（預設 300 = 5 分鐘）
 * @param step         內插間距秒數（預設 10 秒）
 */
export function getTrailUpToTime(
  path: TrailPoint[],
  time: number,
  duration: number = 300,
  step: number = 10,
): TrailPoint[] {
  if (path.length < 2) return [];

  const firstTime = path[0]![3];
  const lastTime = path[path.length - 1]![3];
  const startTime = Math.max(firstTime, time - duration);
  const endTime = Math.min(time, lastTime);

  if (endTime <= startTime) return [];

  const result: TrailPoint[] = [];
  let idx = 0;

  // 快速跳到 startTime 附近的 segment
  while (idx < path.length - 2 && path[idx + 1]![3] < startTime) {
    idx++;
  }

  for (let t = startTime; t <= endTime; t += step) {
    // 推進 idx 到包含 t 的 segment
    while (idx < path.length - 2 && path[idx + 1]![3] < t) {
      idx++;
    }
    const a = path[idx]!;
    const b = path[idx + 1]!;
    const dt = b[3] - a[3];
    if (dt <= 0) continue;
    const frac = Math.min(Math.max((t - a[3]) / dt, 0), 1);
    result.push([
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
      t,
    ]);
  }

  // 確保有精確的末端點
  if (result.length > 0) {
    const lastResultTime = result[result.length - 1]![3];
    if (endTime - lastResultTime > 1) {
      while (idx < path.length - 2 && path[idx + 1]![3] < endTime) {
        idx++;
      }
      const a = path[idx]!;
      const b = path[idx + 1]!;
      const dt = b[3] - a[3];
      if (dt > 0) {
        const frac = Math.min(Math.max((endTime - a[3]) / dt, 0), 1);
        result.push([
          a[0] + (b[0] - a[0]) * frac,
          a[1] + (b[1] - a[1]) * frac,
          a[2] + (b[2] - a[2]) * frac,
          endTime,
        ]);
      }
    }
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
