/**
 * urbanHeatTypes.ts — 都市熱島 Urban Heat（urbanHeat）雙模式上色的 SSOT
 *
 * 資料源：Landsat 8/9 Collection-2 Level-2 地表溫度（ST_B10），2019–2025 暖季
 * （5–9 月）上午約 10:20 過境的 193 景 median 合成，60m 網格切成 raster PMTiles。
 * 上游契約（值編碼 / 品質 baseline / 已知坑 10 條）：
 *   taipei-gis-analytics/docs/handoff/urban_heat_lst.md
 *   taipei-gis-analytics/data/intermediate/environment/urban_heat_lst/output/
 *     urban_heat_lst_encoding.json（機器可讀版，本檔常數與其 decode 欄位同源）
 *
 * ── 通道編碼（⚠️ 硬編的資料契約，上游改量化參數 = breaking change）──
 *   R = 熱島強度 ΔT     ΔT(K) = R/5 − 30      值域 −30 ~ +21 K，精度 0.2 K
 *   G = 絕對地表溫度     °C   = G/4 + 10      值域 10 ~ 73.75 °C，精度 0.25 °C
 *   B = 保留（恆 0）
 *   A = 有效遮罩（255 有效 / 0 nodata：海、常年雲、有效觀測 < 5）
 *   ⚠️ nodata 一律靠 A 判斷 —— R=0 是合法的 −30K，不是空值。
 *
 * ── raster-color-mix 的係數作用在「正規化 0–1」的 texture 取樣值上 ──
 * 所以物理 decode 斜率要 ×255 補償：mix[R] = 255 × (每 DN 的物理增量)。
 * 本檔 51 = 255/5（ΔT 每 DN 0.2K）、63.75 = 255/4（°C 每 DN 0.25°C），offset 不變。
 * 這與既有 canopyHeight 的寫法同一套（6.375 = 255/40），並經瀏覽器實測驗證
 * （2026-07-30：誤用未 ×255 的物理斜率會讓全島飽和在 range 下限、單色無漸層）。
 * raster-value 仍是物理值，`raster-color` 的 stop 直接寫物理值。
 *
 * ── 值域策略 ──
 * `range` 用「通道完整值域」讓色帶 tabulate 不失真；顯示值域（stop 首尾）另外收窄到
 * 資料的都市可辨識區段。色帶 texture 是 CLAMP_TO_EDGE，超出首尾 stop 的像元自動
 * 飽和在端點色 —— 山地大片深負 ΔT 一起貼藍端是預期行為（見 handoff §4「為什麼
 * ΔT 中位數是 −8K」：背景是低海拔農地，ΔT<0 多半只是海拔高，不是「涼爽都市」）。
 */

export interface UrbanHeatStop {
  /** 物理值（ΔT 用 K、絕對溫度用 °C） */
  value: number;
  color: string;
}

export interface UrbanHeatTick {
  value: number;
  label: string;
}

export interface UrbanHeatMode {
  /** select value；index 對齊 overlayParams 的 urbanHeatModeIdx */
  value: string;
  label: string;
  /** raster-color-mix：[R, G, B, offset]，係數 = 物理斜率 ×255（見檔頭） */
  mix: readonly [number, number, number, number];
  /** raster-color-range：色帶 tabulate 的物理值域 = 該通道完整值域 */
  range: readonly [number, number];
  /** 色帶 stop（物理值 → 色碼）；首尾即顯示值域，超出者飽和 */
  stops: readonly UrbanHeatStop[];
  /** 圖例刻度（位置依 stops 首尾線性換算） */
  ticks: readonly UrbanHeatTick[];
  /** 圖例標題右側單位 */
  unit: string;
  /** 圖例底下的模式說明 */
  note: string;
}

/**
 * A. 熱島強度 ΔT（發散色階，白鎖 0 K）
 * 顯示值域 −10 ~ +8 K：資料 P2/P50/P98 = −20.5 / −8.0 / +6.8 K，
 * 但山地佔國土七成、深負值一大片，全展開會把都市端壓成一坨。收窄到 −10~+8
 * 讓平原內部（都心 +5~+8K vs 周邊農地 0K）拉開對比，山區飽和在藍端可接受。
 * 色票 = ColorBrewer RdBu 9-class（反轉，冷藍→白→熱紅）。
 */
const URBAN_HEAT_DT_MODE: UrbanHeatMode = {
  value: "0",
  label: "熱島強度 ΔT",
  mix: [51, 0, 0, -30], // ΔT = R_DN/5 − 30；51 = 255/5
  range: [-30, 21],
  stops: [
    { value: -10, color: "#2166ac" },
    { value: -7.5, color: "#4393c3" },
    { value: -5, color: "#92c5de" },
    { value: -2.5, color: "#d1e5f0" },
    { value: 0, color: "#f7f7f7" }, // ⭐ 白 = 與低海拔農地背景同溫
    { value: 2, color: "#fddbc7" },
    { value: 4, color: "#f4a582" },
    { value: 6, color: "#d6604d" },
    { value: 8, color: "#b2182b" },
  ],
  ticks: [
    { value: -10, label: "≤ −10" },
    { value: 0, label: "0" },
    { value: 8, label: "≥ +8" },
  ],
  unit: "K",
  note: "相對低海拔農地背景；負值多半是海拔高，不等於涼爽都市",
};

/**
 * B. 絕對地表溫度（循序色階，類 inferno 深紫→橘→黃）
 * 顯示值域 22 ~ 48 °C ≈ 資料 P2–P98（21.4 / 48.2）。
 * 適合看「材質差異」（柏油 vs 綠地）；跨年份不可比（各景天氣基線不同 → 看 ΔT）。
 */
const URBAN_HEAT_LST_MODE: UrbanHeatMode = {
  value: "1",
  label: "絕對地表溫度",
  mix: [0, 63.75, 0, 10], // °C = G_DN/4 + 10；63.75 = 255/4
  range: [10, 73.75],
  stops: [
    { value: 22, color: "#1b0c41" },
    { value: 26, color: "#4a0c6b" },
    { value: 30, color: "#781c6d" },
    { value: 34, color: "#a52c60" },
    { value: 38, color: "#cf4446" },
    { value: 42, color: "#ed6925" },
    { value: 45, color: "#fb9b06" },
    { value: 48, color: "#fcffa4" },
  ],
  ticks: [
    { value: 22, label: "≤ 22" },
    { value: 35, label: "35" },
    { value: 48, label: "≥ 48" },
  ],
  unit: "°C",
  note: "多年暖季上午 10:20 median · 地表溫度不是氣溫",
};

/** 顯示模式；index 對齊 overlayParams 的 urbanHeatModeIdx。預設 0 = 熱島強度 ΔT。 */
export const URBAN_HEAT_MODES: readonly UrbanHeatMode[] = [
  URBAN_HEAT_DT_MODE,
  URBAN_HEAT_LST_MODE,
];

export function resolveUrbanHeatMode(modeIdx: number): UrbanHeatMode {
  return URBAN_HEAT_MODES[modeIdx] ?? URBAN_HEAT_MODES[0]!;
}

/** `raster-color` 表達式：raster-value 已是物理值，stop 直接寫物理值。 */
export function urbanHeatRasterColor(modeIdx: number): unknown[] {
  const mode = resolveUrbanHeatMode(modeIdx);
  return [
    "interpolate",
    ["linear"],
    ["raster-value"],
    ...mode.stops.flatMap((s) => [s.value, s.color]),
  ];
}

/** 顯示值域（= stop 首尾），圖例換算刻度位置用。 */
export function urbanHeatDisplayDomain(mode: UrbanHeatMode): [number, number] {
  return [mode.stops[0]!.value, mode.stops[mode.stops.length - 1]!.value];
}

/** 物理值 → 圖例漸層條上的百分比位置（0–100）。 */
export function urbanHeatStopPercent(mode: UrbanHeatMode, value: number): number {
  const [lo, hi] = urbanHeatDisplayDomain(mode);
  return ((value - lo) / (hi - lo)) * 100;
}

/** 圖例漸層條的 CSS `linear-gradient` stop 串（位置照物理值等比，與圖層同源）。 */
export function urbanHeatLegendGradient(mode: UrbanHeatMode): string {
  return mode.stops
    .map((s) => `${s.color} ${urbanHeatStopPercent(mode, s.value).toFixed(1)}%`)
    .join(", ");
}

/** 圖例／feature 文件共用的資料來源註記（handoff §1 授權要求：標 USGS）。 */
export const URBAN_HEAT_CREDIT = "Landsat 8/9 地表溫度 · 2019–2025 暖季合成 · USGS";
/** ⚠️ 覆蓋限制：上游 Landsat ST 產品在澎湖 94% 陸地就是 nodata（handoff §6.7）。 */
export const URBAN_HEAT_COVERAGE_NOTE = "不含澎湖（上游無資料）";
