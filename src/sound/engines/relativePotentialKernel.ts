/**
 * 相對潛勢 kernel：無單位、0–1，**不是 dB**。參數全部來自 soundProfiles。
 */
import { RAIN, THUNDER } from "../model/soundProfiles";

/** 距離越近越高（對「接近度」單調遞增；對距離單調遞減）：1 / (1 + (d/half)^2) */
export function proximityPotential(distanceM: number, halfPotentialDistanceM: number): number {
  if (!Number.isFinite(distanceM) || distanceM < 0) return 0;
  return 1 / (1 + (distanceM / halfPotentialDistanceM) ** 2);
}

/** 雨勢 → 相對潛勢：1 − exp(−R/R0)，R 單位 mm/h；null 或無效 → null（不當 0） */
export function rainPotential(mmPerHour: number | null | undefined): number | null {
  if (mmPerHour == null || !Number.isFinite(mmPerHour) || mmPerHour < 0) return null;
  return 1 - Math.exp(-mmPerHour / RAIN.potentialScaleMmPerHour.value);
}

/**
 * 雷聲 envelope：抵達後持續 durationS 秒，線性從 1 降到 tailFloor，之後 0。
 * 抵達前 0。表達「持續數秒」而非瞬間點。
 */
export function thunderEnvelope(
  sinceArrivalS: number,
  durationS: number = THUNDER.envelopeDurationS.value,
  tailFloor: number = THUNDER.envelopeTailFloor.value,
): number {
  if (sinceArrivalS < 0 || sinceArrivalS > durationS) return 0;
  return 1 - (1 - tailFloor) * (sinceArrivalS / durationS);
}

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
