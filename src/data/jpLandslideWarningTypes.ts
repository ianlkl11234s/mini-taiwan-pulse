import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";

/**
 * 日本土砂災害警戒區域（国土数値情報 A33 令和7年度版）的分類、色票與篩選 SSOT —— hook／legend／popup／params 共用。
 * 色票是災害語意色（design-system spec §3.15／§3.16 資料色例外）：黃＝警戒區域、紅＝特別警戒區域，
 * 與日本官方圖例及台灣崩塌主題 DOD_RISK_OPTIONS 的黃／紅同色系。
 * 契約見 taipei-gis-analytics/docs/handoff/jp-wave2-hazard.md、docs/data-catalog/world/jp_landslide_warning_areas.md。
 */
export interface JpLandslideZone {
  value: "red" | "yellow";
  label: string;
  color: string;
}

/** 紅區在黃區之內：圖例由紅到黃、地圖上紅區疊在黃區上面（fill-sort-key）。 */
export const JP_LANDSLIDE_ZONES = [
  { value: "red", label: "特別警戒區域（レッドゾーン）", color: "#b91c1c" },
  { value: "yellow", label: "警戒區域（イエローゾーン）", color: "#facc15" },
] as const satisfies readonly JpLandslideZone[];

export const JP_LANDSLIDE_LAYER_COLOR = JP_LANDSLIDE_ZONES[0].color;
export const JP_LANDSLIDE_ZONE_MISSING_COLOR = "#94a3b8";

export const JP_LANDSLIDE_PHENOMENA = [
  { value: "steep_slope_failure", label: "急傾斜地崩壞（急傾斜地の崩壊）" },
  { value: "debris_flow", label: "土石流" },
  { value: "landslide", label: "地滑り" },
] as const;

export const JP_LANDSLIDE_DESIGNATIONS = [
  { value: "designated", label: "指定済" },
  { value: "pre_designation", label: "指定前（基礎調査結果公表，尚未正式指定）" },
] as const;

export const JP_LANDSLIDE_ZONE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "zone_class"],
  ...JP_LANDSLIDE_ZONES.flatMap((z) => [z.value, z.color]),
  JP_LANDSLIDE_ZONE_MISSING_COLOR,
] as unknown as ExpressionSpecification;

/** 紅區 1、黃區 0：同一個 tile layer 內紅區畫在黃區上面。 */
export const JP_LANDSLIDE_SORT_KEY: ExpressionSpecification = [
  "match", ["get", "zone_class"], "red", 1, 0,
] as unknown as ExpressionSpecification;

/**
 * 篩選：zoneIdx 0=全部、1=只看特別警戒（紅）、2=只看警戒（黃）；
 * phenomenonIdx 0=全部、1–3 依 `JP_LANDSLIDE_PHENOMENA` 順序單選。無效 index fail closed。
 */
export function jpLandslideFilter(zoneIdx: number, phenomenonIdx: number): FilterSpecification | null {
  const clauses: unknown[] = [];
  if (zoneIdx === 1 || zoneIdx === 2) {
    clauses.push(["==", ["get", "zone_class"], zoneIdx === 1 ? "red" : "yellow"]);
  } else if (zoneIdx !== 0) {
    return ["literal", false] as unknown as FilterSpecification;
  }
  if (phenomenonIdx >= 1) {
    const p = JP_LANDSLIDE_PHENOMENA[phenomenonIdx - 1];
    if (!p) return ["literal", false] as unknown as FilterSpecification;
    clauses.push(["==", ["get", "phenomenon_en"], p.value]);
  } else if (phenomenonIdx !== 0) {
    return ["literal", false] as unknown as FilterSpecification;
  }
  if (clauses.length === 0) return null;
  return (clauses.length === 1 ? clauses[0] : ["all", ...clauses]) as unknown as FilterSpecification;
}

export const JP_LANDSLIDE_ATTRIBUTION =
  "出典：国土数値情報（土砂災害警戒区域データ）（国土交通省）および各都道府県の原典資料を加工して作成";
export const JP_LANDSLIDE_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A33-2025.html";
export const JP_LANDSLIDE_LICENSE = "CC BY 4.0（一部制限）/ PDL1.0";
/** 令和7年度版資料基準；各縣整備時點不一（最舊群馬 2024-03 底）。 */
export const JP_LANDSLIDE_DATA_AS_OF = "2025-08-01";
export const JP_LANDSLIDE_FEATURE_COUNT = 1_793_171;
