/**
 * W5 自然聲源 kernel：無單位、0–1，**不是 dB**。參數全部來自 soundProfiles。
 * 每個 kernel 對無效輸入回 null（呼叫端當 unknown），不回 0。
 */
import { COASTAL_WAVE, WIND_VEGETATION } from "../model/soundProfiles";

const finiteNonNeg = (x: number | null | undefined): x is number => x != null && Number.isFinite(x) && x >= 0;

/** 風速（m/s）→ 葉片受風活動潛勢：≤ onset 為 0，之後 1 − exp(−(v − onset)/scale) */
export function windPotential(windSpeedMs: number | null | undefined): number | null {
  if (!finiteNonNeg(windSpeedMs)) return null;
  const over = windSpeedMs - WIND_VEGETATION.windOnsetMs.value;
  return over <= 0 ? 0 : 1 - Math.exp(-over / WIND_VEGETATION.windScaleMs.value);
}

/** 樹冠覆蓋比例（0–1）→ 植被係數：線性到 coverSaturation 封頂 1 */
export function vegetationFactor(coverFraction: number | null | undefined): number | null {
  if (!finiteNonNeg(coverFraction)) return null;
  return Math.min(1, coverFraction / WIND_VEGETATION.coverSaturation.value);
}

/** 浪高 Hs（m）、週期 T（s）→ 海浪活動潛勢：1 − exp(−Hs²·T / scale)；任一缺值 → null */
export function wavePotential(hsM: number | null | undefined, periodS: number | null | undefined): number | null {
  if (!finiteNonNeg(hsM) || !finiteNonNeg(periodS)) return null;
  return 1 - Math.exp(-(hsM * hsM * periodS) / COASTAL_WAVE.powerScaleM2S.value);
}

/** 站自身歷史分位數表：probs 遞增（0–1），values 為對應水位（m，遞增或相等） */
export interface QuantileTable {
  probs: readonly number[];
  values: readonly number[];
  /** 建表用的樣本數 */
  n: number;
}

/**
 * 水位相對自身歷史的分位（0–1）：在分位數表內線性內插；低於最小分位 → probs[0]、高於最大 → probs[末]。
 * 表無效（長度不符、少於 2 點）或水位無效 → null。**水位分位≠流量≠聲音**，只當活動 proxy。
 */
export function percentileRank(level: number | null | undefined, table: QuantileTable | null | undefined): number | null {
  if (level == null || !Number.isFinite(level) || !table) return null;
  const { probs, values } = table;
  if (probs.length < 2 || probs.length !== values.length) return null;
  if (level <= values[0]!) return probs[0]!;
  const last = values.length - 1;
  if (level >= values[last]!) return probs[last]!;
  for (let i = 0; i < last; i++) {
    const a = values[i]!;
    const b = values[i + 1]!;
    if (level >= a && level <= b) {
      if (b === a) return probs[i + 1]!;
      return probs[i]! + ((level - a) / (b - a)) * (probs[i + 1]! - probs[i]!);
    }
  }
  return null;
}
