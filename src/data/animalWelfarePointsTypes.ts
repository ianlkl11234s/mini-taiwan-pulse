/**
 * 動物福利服務點位的前端 SSOT。
 *
 * RPC 的 `point_type` 是穩定契約；顏色、sidebar filter、Mapbox paint 與圖例必須共用
 * 這份表，避免使用者看到的顏色和篩選語意漂移。
 */
import { allMultiSelectBitmask, multiSelectFilter } from "./multiSelectMapbox";

export const ANIMAL_WELFARE_POINT_TYPES = [
  { value: "veterinary_clinic", label: "動物醫院", color: "#2563eb" },
  { value: "licensed_pet_business", label: "特定寵物業", color: "#9333ea" },
  { value: "animal_protection_office", label: "動保機關", color: "#dc2626" },
  { value: "pet_registration_station", label: "寵物登記站", color: "#0891b2" },
  { value: "rabies_vaccination_site", label: "狂犬病疫苗站", color: "#16a34a" },
  { value: "veterinary_emergency", label: "動物急診", color: "#ea580c" },
  { value: "pet_friendly_place", label: "寵物友善場所", color: "#db2777" },
] as const;

export type AnimalWelfarePointType = (typeof ANIMAL_WELFARE_POINT_TYPES)[number]["value"];

export const ANIMAL_WELFARE_POINT_TYPE_VALUES = ANIMAL_WELFARE_POINT_TYPES.map((item) => item.value);

export const ANIMAL_WELFARE_POINT_TYPE_OPTIONS = ANIMAL_WELFARE_POINT_TYPES.map((item) => ({
  label: item.label,
  value: item.value,
}));

export const ANIMAL_WELFARE_POINT_COLOR_EXPR: unknown[] = [
  "match", ["get", "point_type"],
  ...ANIMAL_WELFARE_POINT_TYPES.flatMap((item) => [item.value, item.color]),
  "#64748b",
];

/** point_type 的 bitmask 多選 filter；全關回傳恆假表達式。 */
export function animalWelfarePointTypeFilter(
  typeMask = allMultiSelectBitmask(ANIMAL_WELFARE_POINT_TYPE_VALUES),
): unknown[] {
  return multiSelectFilter("point_type", typeMask, ANIMAL_WELFARE_POINT_TYPE_VALUES);
}

export function animalWelfarePointTypeMeta(pointType: unknown) {
  return ANIMAL_WELFARE_POINT_TYPES.find((item) => item.value === pointType)
    ?? { value: "unknown", label: "其他服務點", color: "#64748b" };
}
