/**
 * 日本雨水出水（内水）浸水想定區域（国土数値情報 A51 令和7年度）的浸水深級距與出典 SSOT。
 * 色階由色盤選單（layerPalette `gridRampFor`，預設 PuBu）取得，不在這裡寫死顏色；級距由淺到深共 8 級。
 * 契約見 taipei-gis-analytics/docs/handoff/jp-wave2-hazard.md、docs/data-catalog/world/jp_inland_flood_areas.md。
 */
export interface JpInlandFloodDepthClass {
  rank: number;
  value: string;
  label: string;
}

export const JP_INLAND_FLOOD_DEPTH_CLASSES = [
  { rank: 1, value: "lt_0_3m", label: "未滿 0.3 m" },
  { rank: 2, value: "0_3_to_0_5m", label: "0.3–0.5 m" },
  { rank: 3, value: "0_5_to_1m", label: "0.5–1 m" },
  { rank: 4, value: "1_to_3m", label: "1–3 m" },
  { rank: 5, value: "3_to_5m", label: "3–5 m" },
  { rank: 6, value: "5_to_10m", label: "5–10 m" },
  { rank: 7, value: "10_to_20m", label: "10–20 m" },
  { rank: 8, value: "gte_20m", label: "20 m 以上" },
] as const satisfies readonly JpInlandFloodDepthClass[];

export const JP_INLAND_FLOOD_STEPS = JP_INLAND_FLOOD_DEPTH_CLASSES.length;
/** 圖例色票示意色（popup 標題用；實際圖面色隨色盤選單）。 */
export const JP_INLAND_FLOOD_LAYER_COLOR = "#2685bb";

/** depth_rank 1–8 → 色階（由淺到深）；無效 rank 用透明，不畫成任何一級。 */
export function jpInlandFloodFillColor(colors: readonly string[]): unknown[] {
  return ["match", ["get", "depth_rank"],
    ...JP_INLAND_FLOOD_DEPTH_CLASSES.flatMap((c, i) => [c.rank, colors[i] ?? colors[colors.length - 1]]),
    "rgba(0,0,0,0)"];
}

export const JP_INLAND_FLOOD_ATTRIBUTION =
  "出典：国土数値情報（雨水出水（内水）浸水想定区域データ）（国土交通省）を加工して作成";
export const JP_INLAND_FLOOD_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A51-2025.html";
export const JP_INLAND_FLOOD_LICENSE = "CC BY 4.0 / PDL1.0";
/** 令和7年度版（2026-05 更新）。 */
export const JP_INLAND_FLOOD_DATA_AS_OF = "令和7年度版（2026-05）";
export const JP_INLAND_FLOOD_FEATURE_COUNT = 202_357;
export const JP_INLAND_FLOOD_MUNICIPALITY_COUNT = 28;
export const JP_INLAND_FLOOD_PREFECTURE_COUNT = 22;
