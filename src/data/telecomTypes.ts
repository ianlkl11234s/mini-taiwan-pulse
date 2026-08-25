/**
 * 全球通訊圖層共用色票。
 * PCH IXP Directory 的 region 值供 overlay、legend、popup 三處共用。
 */
export const IXP_REGIONS = [
  { value: "Africa", label: "非洲 Africa", color: "#F59E0B" },
  { value: "Asia-Pacific", label: "亞太 Asia-Pacific", color: "#22C55E" },
  { value: "Europe", label: "歐洲 Europe", color: "#60A5FA" },
  { value: "Latin America", label: "拉丁美洲 Latin America", color: "#F472B6" },
  { value: "North America", label: "北美 North America", color: "#A78BFA" },
] as const;

export const IXP_UNKNOWN_COLOR = "#94A3B8";

export const IXP_REGION_COLOR_EXPR = [
  "match", ["get", "region"],
  ...IXP_REGIONS.flatMap((region) => [region.value, region.color]),
  IXP_UNKNOWN_COLOR,
] as unknown as string;

export function ixpRegionColor(region: string): string {
  return IXP_REGIONS.find((entry) => entry.value === region)?.color ?? IXP_UNKNOWN_COLOR;
}

export const ANFR_OPERATORS = [
  { value: "ORANGE", label: "Orange", color: "#F97316" },
  { value: "FREE MOBILE", label: "Free Mobile", color: "#2563EB" },
  { value: "BOUYGUES TELECOM", label: "Bouygues Telecom", color: "#06B6D4" },
  { value: "SFR", label: "SFR", color: "#EF4444" },
  { value: "other", label: "Other", color: "#94A3B8" },
] as const;
export const ANFR_OPERATOR_COLOR_EXPR = [
  "match", ["at", 0, ["get", "operators"]],
  ...ANFR_OPERATORS.slice(0, 4).flatMap((operator) => [operator.value, operator.color]),
  ANFR_OPERATORS[4].color,
] as unknown as string;
export function anfrOperatorColor(operator: string): string {
  return ANFR_OPERATORS.find((entry) => entry.value === operator)?.color ?? ANFR_OPERATORS[4].color;
}

export const OSM_COMMUNICATION_TYPES = [
  { value: "mobile_phone", label: "行動電話 Mobile", color: "#38BDF8" },
  { value: "radio", label: "廣播 Radio", color: "#A78BFA" },
  { value: "television", label: "電視 Television", color: "#F472B6" },
  { value: "microwave", label: "微波 Microwave", color: "#F59E0B" },
  { value: "general", label: "其他通訊 General", color: "#94A3B8" },
] as const;

export const OSM_COMMUNICATION_COLOR_EXPR = [
  "match", ["get", "site_kind"],
  "mobile_phone", "#38BDF8",
  "radio", "#A78BFA",
  "television", "#F472B6",
  "microwave", "#F59E0B",
  "#94A3B8",
] as unknown as string;

export function osmCommunicationColor(siteKind: string): string {
  return OSM_COMMUNICATION_TYPES.find((entry) => entry.value === siteKind)?.color ?? OSM_COMMUNICATION_TYPES[4].color;
}

export const RIPE_ATLAS_NODE_TYPES = [
  { value: "anchor", label: "錨點 Anchor", color: "#F59E0B" },
  { value: "probe", label: "一般探針 Probe", color: "#22D3EE" },
] as const;

export const RIPE_ATLAS_NODE_COLOR_EXPR = [
  "match", ["to-string", ["get", "is_anchor"]],
  "true", "#F59E0B",
  "1", "#F59E0B",
  "#22D3EE",
] as unknown as string;

export function ripeAtlasNodeColor(isAnchor: unknown): string {
  return isAnchor === true || isAnchor === 1 || isAnchor === "true" || isAnchor === "1"
    ? RIPE_ATLAS_NODE_TYPES[0].color
    : RIPE_ATLAS_NODE_TYPES[1].color;
}

/**
 * Ookla Speedtest performance grid colour ramp (download kbps → low/high).
 * The grid is a user-measurement sample, not a carrier coverage surface.
 */
/**
 * Ookla grid 的整層常數 —— 產物走 `--slim`，這些值不再逐格重複（24k 格時是
 * 純負擔），改由 pipeline 寫進 FeatureCollection metadata、由前端這份常數顯示。
 */
export const OOKLA_GRID_META = {
  period: "2026-Q1",
  sourceTileZoom: 16,
  devicesMethod: "z16 tile 加總，未跨 tile 去重",
  coverageCaveat: "空格不代表沒有網路；只顯示觀測到的 Speedtest 樣本",
  sampleBias: "Speedtest 使用者不是隨機母體，不能當成人口或 coverage 推估",
  attribution:
    "© Ookla · Ookla、Speedtest 及相關標誌為 Ookla, LLC 商標 · CC BY-NC-SA 4.0 · 非商業／相同方式分享",
} as const;

/** 全球層的三段解析度：z6 約 500km、z8 約 156km、z10 約 78km（同一份 GeoJSON，靠 `z` 過濾）。 */
export const OOKLA_GLOBAL_ZOOMS = [
  { value: 6, label: "粗 z6（約 500 km）" },
  { value: 8, label: "中 z8（約 156 km）" },
  { value: 10, label: "細 z10（約 78 km）" },
] as const;

/**
 * 樣本數驅動的透明度：z16 原生格大量是個位數測試，一次測速不該與數萬次
 * 在圖面上等權。乘在 opacity 上，不改色階本身。
 */
export const OOKLA_TESTS_ALPHA_EXPR = [
  "interpolate", ["linear"], ["to-number", ["get", "tests"], 0],
  1, 0.5, 10, 0.72, 100, 0.9, 1000, 1,
] as unknown as string;

/**
 * 兩套色階，由「配色」param 切換：
 *   soft  = RdYlBu（原版，柔和好看，但中段淡黃／淡橘在暗底半透明下容易糊成灰白）
 *   vivid = 號誌式高飽和（藍→青→綠→黃→橙→桃紅），全球視角辨識度優先
 * 兩套的級距值一模一樣，換的只是顏色。
 */
export const OOKLA_SPEED_COLORS_SOFT = [
  { value: 0, label: "< 1 Mbps", color: "#313695" },
  { value: 1_000, label: "1–5 Mbps", color: "#4575B4" },
  { value: 5_000, label: "5–25 Mbps", color: "#74ADD1" },
  { value: 25_000, label: "25–50 Mbps", color: "#ABD9E9" },
  { value: 50_000, label: "50–100 Mbps", color: "#FEE090" },
  { value: 100_000, label: "100–250 Mbps", color: "#FDAE61" },
  { value: 250_000, label: "250–500 Mbps", color: "#F46D43" },
  { value: 500_000, label: "≥ 500 Mbps", color: "#D73027" },
] as const;

export const OOKLA_SPEED_COLORS_VIVID = [
  { value: 0, label: "< 1 Mbps", color: "#3B0F70" },
  { value: 1_000, label: "1–5 Mbps", color: "#3B4CC0" },
  { value: 5_000, label: "5–25 Mbps", color: "#00A5CF" },
  { value: 25_000, label: "25–50 Mbps", color: "#00C49A" },
  { value: 50_000, label: "50–100 Mbps", color: "#7DDA3E" },
  { value: 100_000, label: "100–250 Mbps", color: "#FFD11A" },
  { value: 250_000, label: "250–500 Mbps", color: "#FF7A1A" },
  { value: 500_000, label: "≥ 500 Mbps", color: "#FF2D55" },
] as const;

/** 配色 select 的選項；index 對應 `${key}Palette` 的編碼值。 */
export const OOKLA_PALETTES = [
  { value: "soft", label: "柔和 RdYlBu", stops: OOKLA_SPEED_COLORS_SOFT },
  { value: "vivid", label: "高對比", stops: OOKLA_SPEED_COLORS_VIVID },
] as const;

/** legend／popup 取當前色階：param 未設時回柔和版（預設）。 */
export function ooklaSpeedStops(paletteIdx?: number) {
  return (OOKLA_PALETTES[paletteIdx ?? 0] ?? OOKLA_PALETTES[0]).stops;
}

/** 舊名保留給既有 import（＝預設的柔和版）。 */
export const OOKLA_SPEED_COLORS = OOKLA_SPEED_COLORS_SOFT;

const speedColorExpr = (stops: readonly { value: number; color: string }[]) => ([
  "interpolate", ["linear"], ["to-number", ["get", "avg_d_kbps"], 0],
  ...stops.flatMap((stop) => [stop.value, stop.color]),
] as unknown as string);

export const OOKLA_SPEED_COLOR_EXPR_SOFT = speedColorExpr(OOKLA_SPEED_COLORS_SOFT);
export const OOKLA_SPEED_COLOR_EXPR_VIVID = speedColorExpr(OOKLA_SPEED_COLORS_VIVID);
export const OOKLA_SPEED_COLOR_EXPR = OOKLA_SPEED_COLOR_EXPR_SOFT;

/** paint 端依 `${key}Palette` 取色階運算式。 */
export function ooklaSpeedColorExpr(paletteIdx?: number) {
  return paletteIdx === 1 ? OOKLA_SPEED_COLOR_EXPR_VIVID : OOKLA_SPEED_COLOR_EXPR_SOFT;
}
