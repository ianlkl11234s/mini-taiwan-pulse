/**
 * temperatureGridTypes.ts — 溫度網格 2D（temperatureGrid）10 級色階單一資料源
 *
 * 三邊共用（開發規則 §4a 規則 2）：
 *   1. `src/map/temperatureGridLayerFactory.ts` 的 fill-color step 表達式
 *   2. `src/components/LegendPanel.tsx` 的 TemperatureGridLegend
 *   3. `src/components/featureInfo/airPanels.tsx` 的 TemperatureGridPanel（色點）
 *
 * 色票原移植自 weather_change 的溫度分級（°C），2026-10-06 調淺並改暖端分段。
 * 微型感測器（microSensorTypes.ts）的溫度模式也直接吃這份色階。
 */

export interface TemperatureBand {
  /** 該級的下界（°C）；null = 無下界（最冷一級） */
  min: number | null;
  /** 該級的上界（°C，不含）；null = 無上界（最熱一級） */
  max: number | null;
  color: string;
  label: string;
}

/**
 * 由冷到熱，10 級。相鄰 band 的 max 必等於下一 band 的 min（step 表達式依此展開）。
 *
 * 2026-10-06 色票調淺（使用者：原色票太深）：暖端分段改為 18–22／22–26／26–30／30–34／≥34，
 * 最熱一級由近黑 #4d0019 改為 RdYlBu 端點 #a50026；冷端整體略調亮。
 * 相鄰色 OKLab ΔE 皆 ≥ 9（舊版最小 8.8），驗證數字見 docs/features/map-layer-restyle/r6-s1-compare.html。
 */
export const TEMPERATURE_GRID_BANDS: TemperatureBand[] = [
  { min: null, max: 0, color: "#4575b4", label: "< 0°C" },
  { min: 0, max: 5, color: "#6a9fce", label: "0–5°C" },
  { min: 5, max: 10, color: "#94c6df", label: "5–10°C" },
  { min: 10, max: 15, color: "#bfe0ec", label: "10–15°C" },
  { min: 15, max: 18, color: "#fee090", label: "15–18°C" },
  { min: 18, max: 22, color: "#fdb768", label: "18–22°C" },
  { min: 22, max: 26, color: "#f88b4c", label: "22–26°C" },
  { min: 26, max: 30, color: "#ec5a37", label: "26–30°C" },
  { min: 30, max: 34, color: "#d02a28", label: "30–34°C" },
  { min: 34, max: null, color: "#a50026", label: "≥ 34°C" },
];

/** 溫度（°C）→ 色碼。給 popup / legend 用（paint 端走 step 表達式，見 factory）。 */
export function temperatureGridColor(tempC: number): string {
  for (const band of TEMPERATURE_GRID_BANDS) {
    if (band.max === null || tempC < band.max) return band.color;
  }
  return TEMPERATURE_GRID_BANDS[TEMPERATURE_GRID_BANDS.length - 1]!.color;
}
