import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";

/** 市町村役場等及び公的集会施設（国土数値情報 P05）的設施分類；順序同 P05_002 碼 1–5。 */
export interface JpPublicOfficeClass {
  value: "main_office" | "branch_office" | "other_service" | "public_hall" | "assembly_facility";
  label: string;
  color: string;
  count: number;
}

/** Map、legend 與 popup 共用的分類／色票 SSOT（沿用日本點層既有色票）。 */
export const JP_PUBLIC_OFFICE_CLASSES = [
  { value: "main_office", label: "市區町村本廳", color: "#7c3aed", count: 1_908 },
  { value: "branch_office", label: "支所・出張所", color: "#2563eb", count: 4_272 },
  { value: "other_service", label: "其他行政服務", color: "#14b8a6", count: 2_562 },
  { value: "public_hall", label: "公立公民館", color: "#f59e0b", count: 21_302 },
  { value: "assembly_facility", label: "集會施設", color: "#94a3b8", count: 49_488 },
] as const satisfies readonly (JpPublicOfficeClass)[];

export const JP_PUBLIC_OFFICE_LAYER_COLOR = JP_PUBLIC_OFFICE_CLASSES[0].color;

/** 預設隱藏的分類（佔 62%，全開會蓋住前四類）。 */
export const JP_PUBLIC_OFFICE_HIDDEN_BY_DEFAULT = "assembly_facility";

export const JP_PUBLIC_OFFICE_CLASS_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "facility_class"],
  ...JP_PUBLIC_OFFICE_CLASSES.flatMap((c) => [c.value, c.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

/**
 * select index：0=預設（不含集會施設）、1=全部、2–6 依 `JP_PUBLIC_OFFICE_CLASSES` 順序單選一類。
 * 無效 index fail closed。預設就有 filter，所以 addLayer 一律帶 filter。
 */
export function jpPublicOfficeFilter(index: number): FilterSpecification | null {
  if (index === 0) return ["!=", ["get", "facility_class"], JP_PUBLIC_OFFICE_HIDDEN_BY_DEFAULT] as unknown as FilterSpecification;
  if (index === 1) return null;
  const c = JP_PUBLIC_OFFICE_CLASSES[index - 2];
  return c
    ? ["==", ["get", "facility_class"], c.value] as unknown as FilterSpecification
    : ["literal", false] as unknown as FilterSpecification;
}

export const JP_PUBLIC_OFFICE_ATTRIBUTION =
  "出典：国土数値情報（市町村役場等及び公的集会施設データ）（国土交通省）を加工して作成";

/** 資料基準年月；之後的合併、閉館沒有反映。 */
export const JP_PUBLIC_OFFICE_DATA_AS_OF = "2022-04";
export const JP_PUBLIC_OFFICE_POINT_COUNT = 79_532;
