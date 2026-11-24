/**
 * 台灣圖層延伸 B6（2026-11-21）：海洋熱浪月分級（ODB）與珊瑚白化熱壓力（NOAA CRW）的常數與上色規則（色票 SSOT）。
 *
 * 兩層都是「每年一張拼圖」的月幀（src/data/marineYearAtlas.ts）。PNG 只存值，顏色在這裡：
 *  - mhw_level_la_v1：L＝熱浪等級 0–4、A＝255 海洋格；L=0＋A=0 陸地／範圍外（透明）；L=255＝海洋格缺值（未涵蓋灰）
 *  - crw_dhw_baa_rgba_v1：R＝DHW×10（0–254）、G＝警報等級 0–7、A＝255 遮罩內水域；R=G=255＝遮罩內缺值；A=0 陸地或遮罩外
 * raster-color 的解碼與補償係數沿用 jmaTypes（JMA_IMAGERY_MIX_R）；mapbox 會把輸出 alpha 乘上像素 alpha，所以 A=0 一律透明。
 *
 * 資料：analytics marine/odb_marine_heatwave_monthly、marine/coral_bleaching_heat_stress（docs/topic-research/tw_layer_ext_20261120/b6/layer-plan.md）。
 */
import { JMA_IMAGERY_MIX_R, JMA_IMAGERY_RASTER_COLOR_RANGE, JMA_IMAGERY_UNCOVERED_COLOR } from "./jmaTypes";

export type TwMarineHeatLayerKey = "twMarineHeatwaves" | "twCoralBleachingHeatStress";

const TRANSPARENT = "rgba(0, 0, 0, 0)";
export const TW_MARINE_HEAT_UNCOVERED_COLOR = JMA_IMAGERY_UNCOVERED_COLOR;
export const TW_MARINE_HEAT_MISSING = 255;

function years(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/** 月份選單值（01–12）；順序＝索引 */
export const TW_MARINE_HEAT_MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

export interface TwMarineHeatProduct {
  key: TwMarineHeatLayerKey;
  /** public/ 底下的目錄（結尾含 /） */
  base: string;
  framesKey: string;
  atlasKey: (year: number) => string;
  /** 選單年份（＝幀清單涵蓋年份；twMarineHeatTypes.test 對照幀清單） */
  years: readonly number[];
  /** 預設期別＝最新一期 */
  defaultYear: number;
  defaultMonth: (typeof TW_MARINE_HEAT_MONTHS)[number];
  attribution: string;
}

export const TW_MARINE_HEAT_PRODUCTS: Readonly<Record<TwMarineHeatLayerKey, TwMarineHeatProduct>> = {
  twMarineHeatwaves: {
    key: "twMarineHeatwaves",
    base: "./marine/odb_mhw/",
    framesKey: "odb_mhw_frames_v1.json",
    atlasKey: (y) => `odb_mhw_${y}_v1.png`,
    years: years(1982, 2026),
    defaultYear: 2026,
    defaultMonth: "10",
    attribution: "Ocean Data Bank, National Science and Technology Council, Taiwan. https://doi.org/10.5281/zenodo.7512112",
  },
  twCoralBleachingHeatStress: {
    key: "twCoralBleachingHeatStress",
    base: "./marine/crw_heat_stress/",
    framesKey: "crw_heat_stress_frames_v1.json",
    atlasKey: (y) => `crw_heat_stress_${y}_v1.png`,
    years: years(2003, 2026),
    defaultYear: 2026,
    defaultMonth: "10",
    attribution: "NOAA Coral Reef Watch Version 3.1 Monthly Global 5km Satellite Coral Bleaching Heat Stress Products",
  },
};

export interface TwMarineHeatClass {
  /** 等級值（或 DHW 分級下限 °C-weeks） */
  value: number;
  zh: string;
  color: string;
}

/** 海洋熱浪 Hobday et al. 2018 四級＋無熱浪（極淡藍灰，和「未涵蓋」灰分得出來） */
export const TW_MHW_LEVELS: readonly TwMarineHeatClass[] = [
  { value: 0, zh: "無熱浪", color: "rgba(148, 163, 184, 0.22)" },
  { value: 1, zh: "中等 Moderate", color: "#ffd166" },
  { value: 2, zh: "強烈 Strong", color: "#ff8c1a" },
  { value: 3, zh: "嚴重 Severe", color: "#e53935" },
  { value: 4, zh: "極端 Extreme", color: "#c2185b" },
];

/** CRW 5 級白化警報（BAA 0–7），配色依 CRW 官方藍→黃→橘→紅→深紅 */
export const TW_CRW_BAA_LEVELS: readonly TwMarineHeatClass[] = [
  { value: 0, zh: "無壓力", color: "rgba(186, 230, 253, 0.25)" },
  { value: 1, zh: "觀察", color: "#fff000" },
  { value: 2, zh: "警告", color: "#faaa0a" },
  { value: 3, zh: "警報 1 級", color: "#f00000" },
  { value: 4, zh: "警報 2 級", color: "#c80000" },
  { value: 5, zh: "警報 3 級", color: "#a3004a" },
  { value: 6, zh: "警報 4 級", color: "#8e24aa" },
  { value: 7, zh: "警報 5 級", color: "#5e35b1" },
];

/** DHW 月最大值分級（°C-weeks）；value＝下限，第 0 級只含 0 */
export const TW_CRW_DHW_CLASSES: readonly TwMarineHeatClass[] = [
  { value: 0, zh: "0", color: "rgba(186, 230, 253, 0.25)" },
  { value: 0.1, zh: "0–4", color: "#fff3a0" },
  { value: 4, zh: "4–8", color: "#faaa0a" },
  { value: 8, zh: "8–12", color: "#f00000" },
  { value: 12, zh: "12–16", color: "#a3004a" },
  { value: 16, zh: "16–20", color: "#8e24aa" },
  { value: 20, zh: "≥ 20", color: "#5e35b1" },
];

/** 珊瑚層的兩種檢視（select 值順序＝索引） */
export const TW_CRW_VIEWS = [
  { value: "baa", zh: "白化警報等級" },
  { value: "dhw", zh: "累積熱壓力 DHW" },
] as const;

/** 多選 bitmask（全選＝undefined 或全部位元）→ 某一級要不要畫 */
export function enabled(mask: number | undefined, i: number): boolean {
  return mask === undefined || !Number.isFinite(mask) || (Math.trunc(mask) & (1 << i)) !== 0;
}

/**
 * 整數值分級的 step：每級放在 [v−0.5, 下一級−0.5)；關掉的級畫透明；缺值 255 畫未涵蓋灰。
 * thresholds[i] 是第 i 級的起點（raster 值）。
 */
function stepExpr(thresholds: readonly number[], classes: readonly TwMarineHeatClass[], mask: number | undefined, lastEnd: number): unknown[] {
  const expr: unknown[] = ["step", ["raster-value"], TRANSPARENT];
  classes.forEach((c, i) => {
    expr.push(thresholds[i]! - 0.5, enabled(mask, i) ? c.color : TRANSPARENT);
  });
  if (lastEnd + 0.5 < TW_MARINE_HEAT_MISSING - 0.5) expr.push(lastEnd + 0.5, TRANSPARENT);
  expr.push(TW_MARINE_HEAT_MISSING - 0.5, TW_MARINE_HEAT_UNCOVERED_COLOR);
  return expr;
}

/** 海洋熱浪：L 通道 */
export function twMhwRasterColor(levelMask?: number): unknown[] {
  return stepExpr(TW_MHW_LEVELS.map((l) => l.value), TW_MHW_LEVELS, levelMask, 4);
}

/** 珊瑚警報：G 通道 0–7 */
export function twCrwBaaRasterColor(levelMask?: number): unknown[] {
  return stepExpr(TW_CRW_BAA_LEVELS.map((l) => l.value), TW_CRW_BAA_LEVELS, levelMask, 7);
}

/** 珊瑚 DHW：R 通道＝DHW×10（254＝≥25.4）；0 級只含 R=0 */
export function twCrwDhwRasterColor(classMask?: number): unknown[] {
  const thresholds = TW_CRW_DHW_CLASSES.map((c, i) => (i === 0 ? 0 : i === 1 ? 1 : c.value * 10));
  return stepExpr(thresholds, TW_CRW_DHW_CLASSES, classMask, 254);
}

/** DHW 月最大值 → 分級索引（和 twCrwDhwRasterColor 同一組門檻：raster 值＝DHW×10 四捨五入，上限 254） */
export function twCrwDhwClassIndex(dhw: number): number {
  const raster = Math.min(254, Math.round(dhw * 10));
  const thresholds = TW_CRW_DHW_CLASSES.map((c, i) => (i === 0 ? 0 : i === 1 ? 1 : c.value * 10));
  let idx = 0;
  thresholds.forEach((t, i) => { if (raster >= t) idx = i; });
  return idx;
}

/** raster paint（不含 raster-opacity 以外的動態欄位） */
export function twMarineHeatRasterPaint(channel: "r" | "g", color: unknown[], opacity: number): Record<string, unknown> {
  return {
    "raster-opacity": opacity,
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-color-mix": channel === "r" ? [JMA_IMAGERY_MIX_R, 0, 0, 0] : [0, JMA_IMAGERY_MIX_R, 0, 0],
    "raster-color-range": [...JMA_IMAGERY_RASTER_COLOR_RANGE],
    "raster-color": color,
  };
}

/** 選單索引 → 期別 YYYY-MM（索引超界退回預設） */
export function twMarineHeatPeriod(key: TwMarineHeatLayerKey, yearIdx?: number, monthIdx?: number): string {
  const p = TW_MARINE_HEAT_PRODUCTS[key];
  const y = (yearIdx !== undefined ? p.years[yearIdx] : undefined) ?? p.defaultYear;
  const m = (monthIdx !== undefined ? TW_MARINE_HEAT_MONTHS[monthIdx] : undefined) ?? p.defaultMonth;
  return `${y}-${m}`;
}
