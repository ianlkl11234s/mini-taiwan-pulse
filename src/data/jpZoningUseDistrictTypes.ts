import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";

/**
 * 日本用途地域（国土数値情報 A55 都市計画決定情報 令和6年度版）的 13 類、色票與篩選 SSOT —— hook／legend／popup／params 共用。
 * 配色沿用台灣都市計畫土地使用分區（urbanZoningTypes.ts）的錨定色語意：住居＝黃 #f2c94c、商業＝紅 #eb5757、工業＝紫 #9b6dd6；
 * 同系內各類只改「混白比例」區分，不新增色相（田園住居地域沿用台灣農業色 #b5cc6a）。
 * 契約見 taipei-gis-analytics/docs/handoff/jp-wave3-landuse-forest.md、docs/data-catalog/world/jp_zoning_use_districts.md。
 */
const ANCHOR = { residential: "#f2c94c", commercial: "#eb5757", industrial: "#9b6dd6", rural: "#b5cc6a" } as const;

/** 把 hex 與白色依比例混合（t=0 原色、t=1 白）；只用來從錨定色派生同系色階。 */
export function mixWithWhite(hex: string, t: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export type JpZoningGroup = "residential" | "commercial" | "industrial";

export interface JpZoningClass {
  code: number;
  ja: string;
  label: string;
  group: JpZoningGroup;
  color: string;
}

export const JP_ZONING_CLASSES = [
  { code: 1, ja: "第１種低層住居専用地域", label: "第一種低層住居專用地域", group: "residential", color: mixWithWhite(ANCHOR.residential, 0.6) },
  { code: 2, ja: "第２種低層住居専用地域", label: "第二種低層住居專用地域", group: "residential", color: mixWithWhite(ANCHOR.residential, 0.5) },
  { code: 3, ja: "第１種中高層住居専用地域", label: "第一種中高層住居專用地域", group: "residential", color: mixWithWhite(ANCHOR.residential, 0.4) },
  { code: 4, ja: "第２種中高層住居専用地域", label: "第二種中高層住居專用地域", group: "residential", color: mixWithWhite(ANCHOR.residential, 0.3) },
  { code: 5, ja: "第１種住居地域", label: "第一種住居地域", group: "residential", color: mixWithWhite(ANCHOR.residential, 0.2) },
  { code: 6, ja: "第２種住居地域", label: "第二種住居地域", group: "residential", color: mixWithWhite(ANCHOR.residential, 0.1) },
  { code: 7, ja: "準住居地域", label: "準住居地域", group: "residential", color: ANCHOR.residential },
  { code: 8, ja: "田園住居地域", label: "田園住居地域", group: "residential", color: ANCHOR.rural },
  { code: 9, ja: "近隣商業地域", label: "近鄰商業地域", group: "commercial", color: mixWithWhite(ANCHOR.commercial, 0.35) },
  { code: 10, ja: "商業地域", label: "商業地域", group: "commercial", color: ANCHOR.commercial },
  { code: 11, ja: "準工業地域", label: "準工業地域", group: "industrial", color: mixWithWhite(ANCHOR.industrial, 0.4) },
  { code: 12, ja: "工業地域", label: "工業地域", group: "industrial", color: mixWithWhite(ANCHOR.industrial, 0.15) },
  { code: 13, ja: "工業専用地域", label: "工業專用地域", group: "industrial", color: ANCHOR.industrial },
] as const satisfies readonly JpZoningClass[];

export const JP_ZONING_LAYER_COLOR = ANCHOR.residential;
export const JP_ZONING_MISSING_COLOR = "#9e9e9e";

export const JP_ZONING_GROUPS = [
  { value: "residential", label: "住居系（1–8）", codes: [1, 8] },
  { value: "commercial", label: "商業系（9–10）", codes: [9, 10] },
  { value: "industrial", label: "工業系（11–13）", codes: [11, 13] },
] as const;

export const JP_ZONING_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "youto_code"],
  ...JP_ZONING_CLASSES.flatMap((c) => [c.code, c.color]),
  JP_ZONING_MISSING_COLOR,
] as unknown as ExpressionSpecification;

/**
 * select index：0=全部、1–3=住居／商業／工業系（依 `JP_ZONING_GROUPS`）、4–16=13 類單選（依 code 順序）。
 * 無效 index fail closed。tile 沒有 youto_group，所以大類用 youto_code 範圍篩選。
 */
export function jpZoningFilter(index: number): FilterSpecification | null {
  if (index === 0) return null;
  const g = JP_ZONING_GROUPS[index - 1];
  if (g) {
    return ["all", [">=", ["get", "youto_code"], g.codes[0]], ["<=", ["get", "youto_code"], g.codes[1]]] as unknown as FilterSpecification;
  }
  const c = JP_ZONING_CLASSES[index - 1 - JP_ZONING_GROUPS.length];
  return c
    ? ["==", ["get", "youto_code"], c.code] as unknown as FilterSpecification
    : ["literal", false] as unknown as FilterSpecification;
}

export const JP_ZONING_ATTRIBUTION =
  "出典：国土数値情報（都市計画決定情報）（国土交通省）を加工して作成";
export const JP_ZONING_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A55-2024.html";
export const JP_ZONING_LICENSE = "CC BY 4.0 / PDL1.0";
/** 令和6年度版（2025-11 更新）；各市町村資料時點不同。 */
export const JP_ZONING_DATA_AS_OF = "令和6年度版（2025-11）";
export const JP_ZONING_FEATURE_COUNT = 102_244;
