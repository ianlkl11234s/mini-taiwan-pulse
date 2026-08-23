/**
 * 海底等深線 GEBCO 2025（等深線 11 級 + 深度分帶 12 級）的顏色、分級單一真實來源。
 * 給 overlayRegistry 配色（fill-color / line-color 表達式）、LegendPanel 圖例、
 * featureInfo popup 三處共用（同 buildingsGbaTypes.ts / urbanHeatTypes.ts 慣例）。
 *
 * 資料源：GEBCO 2025 Grid（15 arc-second ≈ 450m），`public/base_map/gebco_isobath.pmtiles`，
 * tippecanoe source-layer `isobath`，z4–12。
 * feature 兩種，靠 `kind` 屬性區分：
 *   `kind="line"`：LineString 等深線，`depth_m`（整數負值，11 種）
 *   `kind="band"`：Polygon 深度分帶（環差、自帶 hole，陸地已挖空），`dmin`/`dmax`（整數負值，12 種）
 * 授權 Public Domain，圖例仍須署名 GEBCO（見 `ISOBATH_ATTRIBUTION`）。
 *
 * ⚠️ 表達式不得含 `["zoom"]`：zoom 只能在最外層 interpolate/step（見 streetTreeColors.ts 註）。
 */

export interface IsobathBand {
  /** 較深的下界（含），整數負值 */
  dmin: number;
  /** 較淺的上界（不含，band 最後一級為 0），整數負值或 0 */
  dmax: number;
}

// 12 深度分帶（由深到淺；tippecanoe band polygon 的 dmin/dmax 契約）
export const ISOBATH_BANDS: IsobathBand[] = [
  { dmin: -7000, dmax: -6000 },
  { dmin: -6000, dmax: -5000 },
  { dmin: -5000, dmax: -4000 },
  { dmin: -4000, dmax: -3000 },
  { dmin: -3000, dmax: -2000 },
  { dmin: -2000, dmax: -1000 },
  { dmin: -1000, dmax: -500 },
  { dmin: -500, dmax: -200 },
  { dmin: -200, dmax: -100 },
  { dmin: -100, dmax: -50 },
  { dmin: -50, dmax: -20 },
  { dmin: -20, dmax: 0 },
];

// 11 級等深線（由深到淺）——剛好等於上面 band 的 dmin 子集（缺 -7000，等深線無此級）
export const ISOBATH_LINE_DEPTHS: number[] = [
  -6000, -5000, -4000, -3000, -2000, -1000, -500, -200, -100, -50, -20,
];

type IsobathModeIdx = 0 | 1 | 2;

// 模式 0：單色藍（反向：深處最亮）——暗色底圖上一般深藍會融進黑底看不見最深處，
// 故深度越深給越亮的顏色，越淺給越暗的顏色。
const MODE0_COLORS: string[] = [
  "#f0faff", "#d6eefb", "#b0dcf5", "#86c8ee", "#5eaee0", "#3b8ec9",
  "#1d6fae", "#0c568f", "#0a4272", "#083055", "#06203a", "#04121f",
];

// 模式 1：Haxby（海洋學製圖標準色階，深藍→青→黃→橘）
const MODE1_COLORS: string[] = [
  "#0A0079", "#1300A0", "#1F49C8", "#2E86E0", "#3FA9E8", "#56C4E4",
  "#71D9D4", "#8FE0B8", "#B0E096", "#D0DC79", "#E8D26B", "#F0B268",
];

// 模式 2：Turbo（彩虹漸層，最大反差；12 個取樣點近似 turbo colormap）
const MODE2_COLORS: string[] = [
  "#30123B", "#414FB0", "#3B82F5", "#18B4E0", "#1FDFCB", "#4FF06C",
  "#A4FC3B", "#E1DA37", "#FDB92E", "#FB7E21", "#E6491B", "#B91C1C",
];

const ISOBATH_MODE_COLORS: Record<IsobathModeIdx, string[]> = {
  0: MODE0_COLORS,
  1: MODE1_COLORS,
  2: MODE2_COLORS,
};

/** 顯示模式 select 選項；index 對齊 overlayRegistry 讀的 isobathModeIdx */
export const ISOBATH_MODES = [
  { label: "單色藍（反向強調）", value: "0" },
  { label: "Haxby", value: "1" },
  { label: "Turbo", value: "2" },
] as const;

function paletteForMode(modeIdx: number): string[] {
  return ISOBATH_MODE_COLORS[modeIdx as IsobathModeIdx] ?? MODE0_COLORS;
}

/** band.dmin（或等深線 depth_m，兩者共用同一組深度斷點）→ ISOBATH_BANDS 的位置 */
function bandIndexForDepth(depth: number): number {
  return ISOBATH_BANDS.findIndex((b) => b.dmin === depth);
}

/** 深度分帶 fill-color：依 `dmin` match 12 級（⚠️ 不含 ["zoom"]） */
export function isobathBandColorExpr(modeIdx: number): unknown[] {
  const palette = paletteForMode(modeIdx);
  const expr: unknown[] = ["match", ["get", "dmin"]];
  ISOBATH_BANDS.forEach((b, i) => expr.push(b.dmin, palette[i]!));
  expr.push(palette[palette.length - 1]!); // fallback（理論不會落到這裡）
  return expr;
}

/** 等深線 line-color：依 `depth_m` match 11 級，與相鄰 band 邊界同色（⚠️ 不含 ["zoom"]） */
export function isobathLineColorExpr(modeIdx: number): unknown[] {
  const palette = paletteForMode(modeIdx);
  const expr: unknown[] = ["match", ["get", "depth_m"]];
  ISOBATH_LINE_DEPTHS.forEach((depth) => {
    const i = bandIndexForDepth(depth);
    expr.push(depth, palette[i >= 0 ? i : 0]!);
  });
  expr.push(palette[palette.length - 1]!); // fallback
  return expr;
}

/** 深度分帶色（純 JS 版，供 featureInfo popup / 圖例 dot 上色，不進 mapbox 表達式） */
export function isobathBandColor(dmin: number, modeIdx: number): string {
  const palette = paletteForMode(modeIdx);
  const i = bandIndexForDepth(dmin);
  return palette[i >= 0 ? i : 0]!;
}

/** 等深線色（純 JS 版，與相鄰 band 邊界同色） */
export function isobathLineColor(depth: number, modeIdx: number): string {
  return isobathBandColor(depth, modeIdx);
}

/** 深度區間顯示字串，例："6,000–7,000 m" */
export function formatIsobathRange(dmin: number, dmax: number): string {
  const fmt = (n: number) => Math.abs(n).toLocaleString("zh-TW");
  return `${fmt(dmax)}–${fmt(dmin)} m`;
}

/** 圖例列（12 級，由深到淺）；隨 modeIdx 換色 */
export function isobathLegendRows(modeIdx: number): { color: string; label: string }[] {
  const palette = paletteForMode(modeIdx);
  return ISOBATH_BANDS.map((b, i) => ({
    color: palette[i]!,
    label: formatIsobathRange(b.dmin, b.dmax),
  }));
}

// 圖例／popup 必掛署名（Public Domain 但仍需標示來源）
export const ISOBATH_ATTRIBUTION =
  "GEBCO 2025 Grid（15 arc-second）· GEBCO Bathymetric Compilation Group · Public Domain";
