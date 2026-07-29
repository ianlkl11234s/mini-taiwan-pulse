/**
 * temperatureGridTypes.ts — 溫度網格 2D（temperatureGrid）11 級色階單一資料源
 *
 * 三邊共用（開發規則 §4a 規則 2）：
 *   1. `src/map/temperatureGridLayerFactory.ts` 的 fill-color step 表達式
 *   2. `src/components/LegendPanel.tsx` 的 TemperatureGridLegend
 *   3. `src/components/featureInfo/airPanels.tsx` 的 TemperatureGridPanel（色點）
 *
 * 色票移植自 weather_change 的溫度分級（°C）。
 */

export interface TemperatureBand {
  /** 該級的下界（°C）；null = 無下界（最冷一級） */
  min: number | null;
  /** 該級的上界（°C，不含）；null = 無上界（最熱一級） */
  max: number | null;
  color: string;
  label: string;
}

/** 由冷到熱，11 級。相鄰 band 的 max 必等於下一 band 的 min（step 表達式依此展開）。 */
export const TEMPERATURE_GRID_BANDS: TemperatureBand[] = [
  { min: null, max: 0, color: "#313695", label: "< 0°C" },
  { min: 0, max: 5, color: "#4575b4", label: "0–5°C" },
  { min: 5, max: 10, color: "#74add1", label: "5–10°C" },
  { min: 10, max: 15, color: "#abd9e9", label: "10–15°C" },
  { min: 15, max: 18, color: "#fee090", label: "15–18°C" },
  { min: 18, max: 20, color: "#fdae61", label: "18–20°C" },
  { min: 20, max: 25, color: "#f46d43", label: "20–25°C" },
  { min: 25, max: 28, color: "#d73027", label: "25–28°C" },
  { min: 28, max: 31, color: "#b2182b", label: "28–31°C" },
  { min: 31, max: 34, color: "#800026", label: "31–34°C" },
  { min: 34, max: null, color: "#4d0019", label: "≥ 34°C" },
];

/** 溫度（°C）→ 色碼。給 popup / legend 用（paint 端走 step 表達式，見 factory）。 */
export function temperatureGridColor(tempC: number): string {
  for (const band of TEMPERATURE_GRID_BANDS) {
    if (band.max === null || tempC < band.max) return band.color;
  }
  return TEMPERATURE_GRID_BANDS[TEMPERATURE_GRID_BANDS.length - 1]!.color;
}
