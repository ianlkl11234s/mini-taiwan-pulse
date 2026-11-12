/**
 * 雨勢分級（W6-1）：門檻正本 rainClasses.json（Python 雷達每日包共讀）。
 *
 * 分級碼：0 無雨／1 小雨／2 中雨／3 大雨／4 豪雨／255 無法判斷（GRID_UNKNOWN）。
 * 雨網格與接收點查詢都只用這裡的函式，網格值才會等於點選查詢值（W6-1 決定 6）。
 */
import spec from "./rainClasses.json";
import { GRID_UNKNOWN } from "./gridSpec";

export const RAIN_CLASS_SPEC = spec as Readonly<typeof spec>;
export const RAIN_CLASS_EDGES_MM_H: readonly number[] = spec.edgesMmPerHour;
export const RAIN_CLASS_COUNT = spec.edgesMmPerHour.length + 1; // 5
export const RAIN_CLASS_UNKNOWN = GRID_UNKNOWN;

export type RainClass = 0 | 1 | 2 | 3 | 4;
export type RainClassCode = RainClass | typeof GRID_UNKNOWN;

/** mm/h → 分級（左閉右開）；null／負值／非數 → 255（不當 0） */
export function rainClassOfMmPerHour(mm: number | null | undefined): RainClassCode {
  if (mm == null || !Number.isFinite(mm) || mm < 0) return GRID_UNKNOWN;
  let k = 0;
  for (const e of RAIN_CLASS_EDGES_MM_H) if (mm >= e) k++;
  return k as RainClass;
}

/** 分級下緣（mm/h）：雷達只有分級沒有雨量，相對潛勢用下緣換算（保守，不高估） */
export function rainClassLowerEdgeMmPerHour(k: RainClass): number {
  return k === 0 ? 0 : RAIN_CLASS_EDGES_MM_H[k - 1]!;
}

/**
 * 同一來源在一段區間內的多個值 → 一個分級：有任何已知 ≥1 → 取最大；否則有未知 → 255；否則 0。
 * （和原本雨量站「有雨優先、其次無法判斷、最後才是乾」的規則一致）
 */
export function foldRainClasses(codes: Iterable<RainClassCode>): RainClassCode | null {
  let max = -1;
  let anyUnknown = false;
  let any = false;
  for (const c of codes) {
    any = true;
    if (c === GRID_UNKNOWN) anyUnknown = true;
    else if (c > max) max = c;
  }
  if (!any) return null;
  if (max >= 1) return max as RainClass;
  return anyUnknown ? GRID_UNKNOWN : 0;
}

export type RainEvidenceSource = "radar" | "gauge" | "both";

/**
 * 雷達 ∨ 雨量站取較高者（W6-1 決定 1）。真值表：
 *
 * | 雷達            | 雨量站          | 結果               | 來源    |
 * |-----------------|-----------------|--------------------|---------|
 * | k（0–4）        | j（0–4）        | max(k, j)          | 較高者；相等＝both |
 * | k               | 255／沒有雨量站 | k                  | radar   |
 * | 255／沒有雷達包 | j               | j                  | gauge   |
 * | 255／沒有雷達包 | 255／沒有雨量站 | 255（無法判斷）    | null    |
 *
 * 一邊已知、另一邊無法判斷時取已知那邊（是實際觀測，不因另一邊缺而整格變無法判斷）；
 * 兩邊都無法判斷才是 255。null 參數＝該來源不存在（例如這天沒有雷達包）。
 */
export function combineRainClass(
  radar: RainClassCode | null,
  gauge: RainClassCode | null,
): { rainClass: RainClassCode; source: RainEvidenceSource | null } {
  const r = radar == null || radar === GRID_UNKNOWN ? null : radar;
  const g = gauge == null || gauge === GRID_UNKNOWN ? null : gauge;
  if (r == null && g == null) return { rainClass: GRID_UNKNOWN, source: null };
  if (g == null) return { rainClass: r!, source: "radar" };
  if (r == null) return { rainClass: g, source: "gauge" };
  if (r === g) return { rainClass: r, source: "both" };
  return r > g ? { rainClass: r, source: "radar" } : { rainClass: g, source: "gauge" };
}
