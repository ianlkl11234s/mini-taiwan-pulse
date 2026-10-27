import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";
import { mixWithWhite } from "./jpZoningUseDistrictTypes";

/**
 * 日本主要道路（国土数値情報 N13 2024年度版，jp_major_roads）與高速道路（N06 令和7年版，jp_expressways）的
 * 分類、色票、篩選 SSOT —— hook／legend／popup／params 共用。
 * N13 tile 只帶代碼（road_class_code、width_class、toll、road_state），顯示名在這裡查表（照 analytics data-catalog「前端查表對照」）。
 * 道路等級對應 L-1 線寬三階（map-layers L-5：高速＝強調、國道＝標準、都道府縣道＝細）；有料不另編碼樣式（L-2 虛線不含此語意），只在 popup 與篩選。
 */
export interface JpRoadClass {
  code: number;
  value: "expressway" | "national" | "prefectural";
  ja: string;
  label: string;
  color: string;
  /** L-1 線寬階（map/mapStyleScale LINE_WIDTH 的 key；此檔被 layerManifest 引用，不 import map/ 以免 vite config 載入鏈拉進 i18n）。 */
  tier: "thin" | "standard" | "emphasis";
  /** line-sort-key：數字大的畫在上面（高速 > 國道 > 縣道）。 */
  sort: number;
}

export const JP_ROAD_CLASSES = [
  { code: 4, value: "expressway", ja: "高速自動車国道等", label: "高速道路等", color: "#16a34a", tier: "emphasis", sort: 2 },
  { code: 1, value: "national", ja: "国道", label: "國道", color: "#dc2626", tier: "standard", sort: 1 },
  { code: 2, value: "prefectural", ja: "都道府県道", label: "都道府縣道", color: "#f59e0b", tier: "thin", sort: 0 },
] as const satisfies readonly JpRoadClass[];

export const JP_ROAD_OTHER_COLOR = "#94a3b8";
export const JP_ROAD_LAYER_COLOR = JP_ROAD_CLASSES[1].color;

export const JP_ROAD_WIDTH_CLASSES: Readonly<Record<string, string>> = {
  lt_3m: "3m未満", "3_to_5_5m": "3m–5.5m未満", "5_5_to_13m": "5.5m–13m未満",
  "13_to_19_5m": "13m–19.5m未満", gte_19_5m: "19.5m以上", unknown: "不明",
};
export const JP_ROAD_STATES: Readonly<Record<string, string>> = {
  normal: "通常部", bridge_viaduct: "橋・高架", tunnel: "トンネル", snow_shed: "雪囲い",
};

export const JP_ROAD_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "road_class_code"],
  ...JP_ROAD_CLASSES.flatMap((c) => [c.code, c.color]),
  JP_ROAD_OTHER_COLOR,
] as unknown as ExpressionSpecification;

export const JP_ROAD_SORT_KEY: ExpressionSpecification = [
  "match", ["get", "road_class_code"],
  ...JP_ROAD_CLASSES.flatMap((c) => [c.code, c.sort]),
  0,
] as unknown as ExpressionSpecification;

export const JP_ROAD_FILTER_OPTIONS = [
  ...JP_ROAD_CLASSES.map((c) => ({ value: c.value, label: c.label })),
  { value: "toll", label: "只看有料道路" },
] as const;

/** select index：0=全部、1–3＝高速／國道／都道府縣道、4＝只看有料；無效 index fail closed。 */
export function jpRoadFilter(index: number): FilterSpecification | null {
  if (index === 0) return null;
  const c = JP_ROAD_CLASSES[index - 1];
  if (c) return ["==", ["get", "road_class_code"], c.code] as unknown as FilterSpecification;
  if (index === JP_ROAD_CLASSES.length + 1) return ["==", ["get", "toll"], true] as unknown as FilterSpecification;
  return ["literal", false] as unknown as FilterSpecification;
}

export const JP_ROAD_ATTRIBUTION = "出典：国土数値情報（道路データ）（国土交通省）を加工して作成";
export const JP_ROAD_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N13-2024.html";
export const JP_ROAD_LICENSE = "CC BY 4.0 / PDL1.0";
export const JP_ROAD_DATA_AS_OF = "2024年度版（2024-09 時點）";
export const JP_ROAD_FEATURE_COUNT = 1_838_441;

// ── 高速道路（N06）────────────────────────────────────────────

export interface JpExpresswayCategory { value: string; ja: string; label: string; color: string }

export const JP_EXPRESSWAY_CATEGORIES = [
  { value: "national_expressway", ja: "高速自動車国道", label: "高速自動車國道", color: "#16a34a" },
  { value: "parallel_expressway", ja: "高速自動車国道に並行する自動車専用道路", label: "與高速自動車國道並行的汽車專用道", color: "#65a30d" },
  { value: "national_route_expressway", ja: "一般国道の自動車専用道路", label: "一般國道的汽車專用道", color: "#0d9488" },
  { value: "urban_expressway", ja: "指定都市高速道路", label: "指定都市高速道路（首都高等）", color: "#7c3aed" },
  { value: "honshu_shikoku_expressway", ja: "本州四国連絡高速道路", label: "本州四國聯絡高速道路", color: "#0284c7" },
] as const satisfies readonly JpExpresswayCategory[];
export const JP_EXPRESSWAY_OTHER = { value: "other", ja: "その他の道路", label: "其他道路", color: "#94a3b8" } as const;
export const JP_EXPRESSWAY_LAYER_COLOR = JP_EXPRESSWAY_CATEGORIES[0].color;

export const JP_EXPRESSWAY_SERVICE_STATUS: Readonly<Record<string, { ja: string; label: string }>> = {
  complete: { ja: "完成供用", label: "完成供用" },
  provisional: { ja: "暫定供用", label: "暫定供用（多為單側一車道）" },
  switched_to_national_expressway: { ja: "高速自動車国道に切り替えて供用", label: "改為高速自動車國道供用" },
  switched_to_national_route: { ja: "一般国道に切り替えて供用", label: "改為一般國道供用" },
};
/** 暫定供用用同色淡化（混白），不用虛線（L-2 虛線不含此語意）。 */
export const JP_EXPRESSWAY_PROVISIONAL_MIX = 0.5;

const categoryColorExpr = (mix: number) => [
  "match", ["get", "road_category_en"],
  ...JP_EXPRESSWAY_CATEGORIES.flatMap((c) => [c.value, mix > 0 ? mixWithWhite(c.color, mix) : c.color]),
  mix > 0 ? mixWithWhite(JP_EXPRESSWAY_OTHER.color, mix) : JP_EXPRESSWAY_OTHER.color,
];

export const JP_EXPRESSWAY_COLOR_EXPRESSION: ExpressionSpecification = [
  "case", ["==", ["get", "service_status_en"], "provisional"],
  categoryColorExpr(JP_EXPRESSWAY_PROVISIONAL_MIX),
  categoryColorExpr(0),
] as unknown as ExpressionSpecification;

export const JP_EXPRESSWAY_JUNCTION_TYPES = [
  { value: "interchange", ja: "一般インターチェンジ", label: "交流道（IC）", color: "#eab308" },
  { value: "junction", ja: "ジャンクション", label: "系統交流道（JCT）", color: "#e11d48" },
  { value: "smart_interchange", ja: "スマートインターチェンジ", label: "ETC 專用交流道（SIC）", color: "#0ea5e9" },
  { value: "other", ja: "その他の接合部", label: "其他接合部", color: "#94a3b8" },
] as const;

export const JP_EXPRESSWAY_JUNCTION_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "junction_type_en"],
  ...JP_EXPRESSWAY_JUNCTION_TYPES.flatMap((j) => [j.value, j.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

/** IC／JCT 點從 z9 起顯示。 */
export const JP_EXPRESSWAY_JUNCTION_MINZOOM = 9;

/** select index：0=全部、1–5 路線種別；無效 index fail closed（只篩線，IC 點不受影響）。 */
export function jpExpresswayFilter(index: number): FilterSpecification | null {
  if (index === 0) return null;
  const c = JP_EXPRESSWAY_CATEGORIES[index - 1];
  return c
    ? ["==", ["get", "road_category_en"], c.value] as unknown as FilterSpecification
    : ["literal", false] as unknown as FilterSpecification;
}

export const JP_EXPRESSWAY_ATTRIBUTION = "出典：国土数値情報（高速道路時系列データ）（国土交通省）を加工して作成";
export const JP_EXPRESSWAY_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N06-2025.html";
export const JP_EXPRESSWAY_LICENSE = "CC BY 4.0 / PDL1.0（只當最新現況使用）";
export const JP_EXPRESSWAY_DATA_AS_OF = "2025-12-31";
export const JP_EXPRESSWAY_SEGMENT_COUNT = 1_289;
export const JP_EXPRESSWAY_JUNCTION_COUNT = 2_384;
