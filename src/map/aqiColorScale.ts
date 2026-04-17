/**
 * AQI 色階（環境部官方 6 級配色）
 *
 * 參考：https://airtw.moenv.gov.tw/CHT/Information/Standard/AirQualityIndicator_new.aspx
 */

import type { ExpressionSpecification } from "mapbox-gl";

export interface AqiLevel {
  max: number;                 // 區間上限（含）
  color: string;
  label: string;
  description: string;
}

/**
 * 升序排列。查色時從小到大第一個 value <= max 命中。
 * 最後一級 max=Infinity，代表「以上皆歸此級」。
 */
export const AQI_LEVELS: AqiLevel[] = [
  { max: 50,       color: "#009966", label: "良好",           description: "空氣品質令人滿意" },
  { max: 100,      color: "#FFDE33", label: "普通",           description: "可接受，敏感族群微影響" },
  { max: 150,      color: "#FF9933", label: "對敏感族群不健康", description: "敏感族群減少戶外活動" },
  { max: 200,      color: "#CC0033", label: "對所有族群不健康", description: "一般民眾應減少戶外活動" },
  { max: 300,      color: "#660099", label: "非常不健康",       description: "避免戶外活動" },
  { max: Infinity, color: "#7E0023", label: "危害",           description: "嚴重健康警告" },
];

/** 無資料 / null 時的灰色 */
export const AQI_COLOR_MISSING = "#707070";

/** 數值 → 顏色字串 */
export function aqiToColor(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return AQI_COLOR_MISSING;
  for (const lv of AQI_LEVELS) {
    if (value <= lv.max) return lv.color;
  }
  return AQI_LEVELS[AQI_LEVELS.length - 1]!.color;
}

/**
 * 產生 Mapbox step expression：根據 feature property 選色。
 *
 * step 語法：["step", input, default_output, stop_1, output_1, stop_2, output_2, ...]
 *   input < stop_1                   → default_output
 *   stop_N  <= input < stop_{N+1}    → output_N
 *
 * 我們在 loader 端把 null 轉成 -1，所以 input < 0 → 灰（missing）。
 */
export function buildAqiStepExpression(propName: string): ExpressionSpecification {
  const args: (number | string)[] = [];
  // default: input < 0（missing sentinel）→ 灰
  args.push(AQI_COLOR_MISSING);
  // stops：每級區間的下限 → 該級顏色
  // 0 <= v <= 50  → level 0
  // 51 <= v <= 100 → level 1 ...
  let prev = 0;
  for (const lv of AQI_LEVELS) {
    args.push(prev, lv.color);
    if (!Number.isFinite(lv.max)) break;
    prev = lv.max + 1;
  }
  return [
    "step",
    ["coalesce", ["to-number", ["get", propName]], -1],
    ...args,
  ] as unknown as ExpressionSpecification;
}
