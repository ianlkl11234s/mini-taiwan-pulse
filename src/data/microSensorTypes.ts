/**
 * microSensorTypes.ts — LASS 微型感測（aqiMicroSensors）三模式上色的色階 SSOT
 *
 * 三邊共用（開發規則 §4a 規則 2）：
 *   1. `src/data/microSensorsLoader.ts` — build GeoJSON 時把三種顏色都烤進 properties
 *   2. `src/hooks/useMicroSensorsLayer.ts` — 切模式只 setPaintProperty 換 ["get", colorField]
 *   3. `src/components/LegendPanel.tsx` 的 MicroSensorLegend — 依當前 mode 出對應圖例
 *
 * 溫度刻意直接 import `temperatureGridTypes` 的 11 級色階：與溫度網格 2D 圖層
 * 跨圖層同色 = 兩層疊看時「同一個溫度 = 同一個顏色」。
 * 濕度色階移植自 weather_change（Windy 風格 7 級）。
 */

import { TEMPERATURE_GRID_BANDS, temperatureGridColor } from "./temperatureGridTypes";

export interface MicroSensorBand {
  /** 該級上界（不含）；最後一級為 null（無上界） */
  max: number | null;
  color: string;
  label: string;
}

/** 缺值統一中性灰（loader 端 null、properties 端 temperature=-999 / humidity=-1 哨兵） */
export const MICRO_SENSOR_NO_DATA_COLOR = "#707070";

/**
 * PM2.5 5 級（斷點沿用原 pm25ToColor）：對應 PM2.5 AQI sub-index 常用分級。
 * 這是針對「PM2.5 濃度」而非 AQI 的近似色。
 */
export const MICRO_SENSOR_PM25_BANDS: MicroSensorBand[] = [
  { max: 15,   color: "#009966", label: "0–15 µg/m³" },
  { max: 35,   color: "#FFDE33", label: "15–35 µg/m³" },
  { max: 54,   color: "#FF9933", label: "35–54 µg/m³" },
  { max: 150,  color: "#CC0033", label: "54–150 µg/m³" },
  { max: null, color: "#660099", label: "≥ 150 µg/m³" },
];

/** 濕度 7 級（移植 weather_change `getHumidityColor()`，Windy 風格棕→綠→藍→紫） */
export const MICRO_SENSOR_HUMIDITY_BANDS: MicroSensorBand[] = [
  { max: 40,   color: "#b48f60", label: "< 40%（極乾）" },
  { max: 50,   color: "#d6bb7e", label: "40–50%（乾燥）" },
  { max: 60,   color: "#e6dfaa", label: "50–60%（稍乾）" },
  { max: 70,   color: "#b6d69f", label: "60–70%（舒適）" },
  { max: 80,   color: "#64b6e1", label: "70–80%（濕潤）" },
  { max: 90,   color: "#5a6fc2", label: "80–90%（潮濕）" },
  { max: null, color: "#5e3a86", label: "≥ 90%（極濕）" },
];

function bandColor(bands: MicroSensorBand[], v: number): string {
  for (const band of bands) {
    if (band.max === null || v < band.max) return band.color;
  }
  return bands[bands.length - 1]!.color;
}

/** PM2.5（µg/m³）→ 色碼；null / 非有限 / 負值（哨兵 -1）→ 中性灰 */
export function microSensorPm25Color(pm25: number | null | undefined): string {
  if (pm25 == null || !Number.isFinite(pm25) || pm25 < 0) return MICRO_SENSOR_NO_DATA_COLOR;
  return bandColor(MICRO_SENSOR_PM25_BANDS, pm25);
}

/** 濕度（%）→ 色碼；null / 非有限 / 負值（哨兵 -1）→ 中性灰 */
export function microSensorHumidityColor(humidity: number | null | undefined): string {
  if (humidity == null || !Number.isFinite(humidity) || humidity < 0) return MICRO_SENSOR_NO_DATA_COLOR;
  return bandColor(MICRO_SENSOR_HUMIDITY_BANDS, humidity);
}

/**
 * 溫度（°C）→ 色碼，直接走溫度網格 2D 的 11 級色階。
 * ⚠️ 不能用 `< 0` 當無效判準（山區可能低於 0°C）；哨兵是 -999 → 用 ≤ -100 過濾。
 */
export function microSensorTemperatureColor(tempC: number | null | undefined): string {
  if (tempC == null || !Number.isFinite(tempC) || tempC <= -100) return MICRO_SENSOR_NO_DATA_COLOR;
  return temperatureGridColor(tempC);
}

/** GeoJSON properties 裡預烤的顏色欄位名（切模式只換這個 key） */
export type MicroSensorColorField = "colorPm25" | "colorTemp" | "colorHum";

export interface MicroSensorMode {
  /** select value；index 對齊 overlayParams 的 aqiMicroModeIdx */
  value: string;
  label: string;
  colorField: MicroSensorColorField;
  /** 圖例列（只需 color + label；溫度直接吃 TEMPERATURE_GRID_BANDS） */
  legend: readonly { color: string; label: string }[];
  /** 圖例底下的一行說明 */
  note: string;
}

/** 顯示模式 select 選項；index 對齊 overlayParams 的 aqiMicroModeIdx。預設 0=PM2.5。 */
export const MICRO_SENSOR_MODES: MicroSensorMode[] = [
  { value: "0", label: "PM2.5", colorField: "colorPm25", legend: MICRO_SENSOR_PM25_BANDS, note: "PM2.5 濃度（µg/m³）" },
  { value: "1", label: "溫度",  colorField: "colorTemp", legend: TEMPERATURE_GRID_BANDS,  note: "溫度（°C）· 與溫度網格 2D 同色階" },
  { value: "2", label: "濕度",  colorField: "colorHum",  legend: MICRO_SENSOR_HUMIDITY_BANDS, note: "相對濕度（%）" },
];

export function resolveMicroSensorMode(modeIdx: number): MicroSensorMode {
  return MICRO_SENSOR_MODES[modeIdx] ?? MICRO_SENSOR_MODES[0]!;
}

/** 依當前模式取 circle-color 表達式（顏色已預烤進 properties，這裡只換欄位） */
export function microSensorColorExpr(modeIdx: number): unknown[] {
  return ["get", resolveMicroSensorMode(modeIdx).colorField];
}
