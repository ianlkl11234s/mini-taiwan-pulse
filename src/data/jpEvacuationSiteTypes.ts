import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";

/** 日本避難場所的法定種類；兩者意義不同，不可相加。 */
export interface JpEvacuationSiteType {
  value: "emergency_site" | "shelter";
  label: string;
  color: string;
}

/** Map、legend 與 popup 共用的場所類別／色票 SSOT（紅＝緊急避難場所、藍＝避難所）。 */
export const JP_EVACUATION_SITE_TYPES = [
  { value: "emergency_site", label: "指定緊急避難場所", color: "#ef4444" },
  { value: "shelter", label: "指定避難所", color: "#3b82f6" },
] as const satisfies readonly JpEvacuationSiteType[];

export const JP_EVACUATION_LAYER_COLOR = JP_EVACUATION_SITE_TYPES[0].color;

/**
 * 篩選選項（select index 1–9）：8 種災害種別對應 PMTiles 的 hazard_* 布林（僅緊急避難場所有值，
 * 指定避難所為 null），最後一項為指定福祉避難所（is_welfare_shelter，僅避難所有值）。
 * 災害與福祉互斥（不同場所類型），故合成單一 select，避免選到空集合。
 */
export const JP_EVACUATION_FILTERS = [
  { value: "flood", label: "洪水", field: "hazard_flood" },
  { value: "landslide", label: "崖崩れ等", field: "hazard_landslide" },
  { value: "storm_surge", label: "高潮", field: "hazard_storm_surge" },
  { value: "earthquake", label: "地震", field: "hazard_earthquake" },
  { value: "tsunami", label: "津波", field: "hazard_tsunami" },
  { value: "large_fire", label: "大規模な火事", field: "hazard_large_fire" },
  { value: "inland_flood", label: "内水氾濫", field: "hazard_inland_flood" },
  { value: "volcano", label: "火山現象", field: "hazard_volcano" },
  { value: "welfare", label: "只看指定福祉避難所", field: "is_welfare_shelter" },
] as const;

/** popup 列出的災害種別（不含福祉）；順序同 PMTiles 欄位。 */
export const JP_EVACUATION_HAZARDS = JP_EVACUATION_FILTERS.filter((f) => f.value !== "welfare");

/** PMTiles `site_type` → 點位色彩；未知未來分類保留中性灰。 */
export const JP_EVACUATION_SITE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "site_type"],
  ...JP_EVACUATION_SITE_TYPES.flatMap((type) => [type.value, type.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

/** 0=全部；1–9 依 `JP_EVACUATION_FILTERS` 順序。無效 index fail closed。 */
export function jpEvacuationFilter(index: number): FilterSpecification | null {
  if (index === 0) return null;
  const f = JP_EVACUATION_FILTERS[index - 1];
  return f
    ? ["==", ["get", f.field], true] as unknown as FilterSpecification
    : ["literal", false] as unknown as FilterSpecification;
}

export const JP_EVACUATION_ATTRIBUTION =
  "出典：国土地理院「指定緊急避難場所・指定避難所データ」を加工して作成";

export const JP_EVACUATION_SOURCE_URL = "https://hinanmap.gsi.go.jp/";
export const JP_EVACUATION_LICENSE = "PDL1.0";

/** 檔案時點（GSI 全國彙整 CSV）；資料依市町村自願登錄，可能非最新。 */
export const JP_EVACUATION_DATA_AS_OF = "2026-10-19";
export const JP_EVACUATION_POINT_COUNT = 199_346;
