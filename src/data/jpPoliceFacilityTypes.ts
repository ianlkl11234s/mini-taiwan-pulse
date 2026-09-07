import type { ExpressionSpecification } from "mapbox-gl";

/** 日本警察設施的組織層級；順序同 type select 的 index 1–4。 */
export interface JpPoliceFacilityType {
  value: "headquarters" | "police_station" | "koban" | "chuzai";
  label: string;
  color: string;
}

/** Map、legend 與 popup 共用的設施類別／色票單一真實來源。 */
export const JP_POLICE_FACILITY_TYPES = [
  { value: "headquarters", label: "警察本部", color: "#7c3aed" },
  { value: "police_station", label: "警察署", color: "#2563eb" },
  { value: "koban", label: "交番", color: "#f59e0b" },
  { value: "chuzai", label: "駐在所", color: "#14b8a6" },
] as const satisfies readonly JpPoliceFacilityType[];

/** Layer catalog 使用的代表色；由類別 SSOT 衍生。 */
export const JP_POLICE_LAYER_COLOR = JP_POLICE_FACILITY_TYPES[0].color;

/** `geom_status=degraded` 的約略位置外框色。 */
export const JP_POLICE_DEGRADED_COLOR = "#fb923c";

/** PMTiles `facility_type` → 點位色彩；未知未來分類保留中性灰。 */
export const JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "facility_type"],
  ...JP_POLICE_FACILITY_TYPES.flatMap((type) => [type.value, type.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

/** Mapbox source、legend 與 popup 共用的來源標示。 */
export const JP_POLICE_ATTRIBUTION =
  "出典：警察庁ウェブサイト「全国警察施設名称位置等」を加工して作成／位置情報：国土地理院最適化ベクトルタイル";
