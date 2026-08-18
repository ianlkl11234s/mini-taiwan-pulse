/**
 * 共同登記地址 B4 的視覺編碼 SSOT。
 *
 * - 點大小：同址公司數 `n_companies`，用 log10 壓縮 5–794 家的長尾。
 * - 點顏色：資本額中位數 `capital_median`，用固定非線性級距避免極端值拉爆色階，
 *   並讓不同月份仍可直接比較。
 *
 * overlayRegistry 與 LegendPanel 必須共用這些常數，不可各自複製 stops。
 */

export const COMMON_REGISTRATION_BASE_COLOR = "#3b82f6";

export interface CommonRegistrationCapitalBand {
  min: number;
  color: string;
  label: string;
}

/** 固定資本額級距（新臺幣元），接近本版分位數但不隨月份漂移。 */
export const COMMON_REGISTRATION_CAPITAL_BANDS: CommonRegistrationCapitalBand[] = [
  { min: 0, color: "#dbeafe", label: "未滿 100 萬" },
  { min: 1_000_000, color: "#bfdbfe", label: "100–300 萬" },
  { min: 3_000_000, color: "#93c5fd", label: "300–600 萬" },
  { min: 6_000_000, color: "#60a5fa", label: "600–1,500 萬" },
  { min: 15_000_000, color: "#3b82f6", label: "1,500–3,000 萬" },
  { min: 30_000_000, color: "#1d4ed8", label: "3,000 萬–1 億" },
  { min: 100_000_000, color: "#7c3aed", label: "1 億以上" },
];

export const COMMON_REGISTRATION_COUNT_STOPS = [
  { count: 5, radius: 3 },
  { count: 10, radius: 4 },
  { count: 25, radius: 6 },
  { count: 50, radius: 8 },
  { count: 100, radius: 10 },
  { count: 800, radius: 18 },
] as const;

export const COMMON_REGISTRATION_LEGEND_COUNTS = [5, 20, 100] as const;

/** `capital_median` → 固定非線性色階。資料契約保證 number，fallback 僅防破損檔。 */
export function commonRegistrationCapitalColorExpr(): unknown[] {
  const value: unknown[] = ["to-number", ["get", "capital_median"], 0];
  const expression: unknown[] = [
    "step",
    value,
    COMMON_REGISTRATION_CAPITAL_BANDS[0]!.color,
  ];
  for (let i = 1; i < COMMON_REGISTRATION_CAPITAL_BANDS.length; i++) {
    const band = COMMON_REGISTRATION_CAPITAL_BANDS[i]!;
    expression.push(band.min, band.color);
  }
  return expression;
}

/** `n_companies` → log10 半徑，再乘上 zoom 與使用者 scale。 */
export function commonRegistrationRadiusExpr(scale: number): unknown[] {
  const count: unknown[] = [
    "log10",
    ["max", ["to-number", ["get", "n_companies"], 5], 5],
  ];
  const radius: unknown[] = ["interpolate", ["linear"], count];
  for (const stop of COMMON_REGISTRATION_COUNT_STOPS) {
    radius.push(Math.log10(stop.count), stop.radius);
  }
  // Mapbox 限制 ["zoom"] 只能是最外層 step/interpolate 的 input，不能包在乘法裡。
  return [
    "interpolate", ["linear"], ["zoom"],
    6, ["*", scale, 0.55, radius],
    10, ["*", scale, 0.85, radius],
    14, ["*", scale, 1.2, radius],
    16, ["*", scale, 1.5, radius],
  ];
}

/** 圖例圓點使用 z10 的視覺基準；CSS 尺寸另外限制在可讀範圍。 */
export function commonRegistrationLegendDiameter(count: number): number {
  const logCount = Math.log10(Math.max(count, 5));
  for (let i = 1; i < COMMON_REGISTRATION_COUNT_STOPS.length; i++) {
    const lo = COMMON_REGISTRATION_COUNT_STOPS[i - 1]!;
    const hi = COMMON_REGISTRATION_COUNT_STOPS[i]!;
    if (count <= hi.count) {
      const t = (logCount - Math.log10(lo.count)) /
        (Math.log10(hi.count) - Math.log10(lo.count));
      return Math.round((lo.radius + t * (hi.radius - lo.radius)) * 1.7);
    }
  }
  return Math.round(
    COMMON_REGISTRATION_COUNT_STOPS[COMMON_REGISTRATION_COUNT_STOPS.length - 1]!.radius * 1.7,
  );
}
