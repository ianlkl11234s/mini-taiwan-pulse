import { allMultiSelectBitmask, multiSelectFilter, selectedMultiSelectValues } from "./multiSelectMapbox";

export const PUBLIC_TOILET_TYPE_OPTIONS = [
  { value: "商業營業場所", label: "商業營業場所" },
  { value: "民眾洽公場所", label: "民眾洽公場所" },
  { value: "社福機構、集會場所", label: "社福／集會場所" },
  { value: "公園", label: "公園" },
  { value: "交通", label: "交通場站" },
  { value: "文化育樂活動場所", label: "文化育樂場所" },
  { value: "宗教禮儀場所", label: "宗教禮儀場所" },
  { value: "觀光地區及風景區", label: "觀光／風景區" },
  { value: "休閒娛樂場所", label: "休閒娛樂場所" },
  { value: "其他", label: "其他" },
  { value: "", label: "未分類" },
] as const;

export const RECYCLING_MATERIAL_OPTIONS = [
  { value: "paper", label: "紙類／紙容器" },
  { value: "plastic", label: "塑膠／寶特瓶" },
  { value: "glass", label: "玻璃" },
  { value: "metal", label: "金屬／鐵鋁罐" },
  { value: "clothing", label: "衣物／鞋類" },
  { value: "electronics", label: "電池／電子電器" },
  { value: "organic", label: "廢油／綠色廢棄物" },
] as const;

export const DISASTER_SHELTER_TYPE_OPTIONS = [
  { value: "水災", label: "水災" },
  { value: "震災", label: "震災" },
  { value: "土石流", label: "土石流" },
  { value: "海嘯", label: "海嘯" },
  { value: "核子事故", label: "核子事故" },
  { value: "坡地災害", label: "坡地災害" },
  { value: "__unspecified__", label: "未註明" },
] as const;

export const ACCESSIBLE_FACILITY_TYPE_OPTIONS = [
  { value: "accessible_poi", label: "其他無障礙 POI" },
  { value: "path", label: "路徑" },
  { value: "toilet", label: "公廁" },
  { value: "park", label: "公園" },
  { value: "entrance", label: "出入口" },
  { value: "playground", label: "遊戲場" },
] as const;

export const ACCESSIBILITY_STATUS_OPTIONS = [
  { value: "yes", label: "可無障礙使用" },
  { value: "limited", label: "部分可使用" },
  { value: "no", label: "不可無障礙使用" },
  { value: "unknown", label: "未標註／未知" },
] as const;

export const BICYCLE_SUPPORT_SERVICE_OPTIONS = [
  { value: "repair", label: "維修" },
  { value: "air", label: "打氣" },
  { value: "parking", label: "停車" },
  { value: "water", label: "飲水" },
  { value: "toilet", label: "公廁" },
] as const;

const valuesOf = (options: readonly { value: string }[]) => options.map((option) => option.value);

export const PUBLIC_TOILET_TYPE_VALUES = valuesOf(PUBLIC_TOILET_TYPE_OPTIONS);
export const RECYCLING_MATERIAL_VALUES = valuesOf(RECYCLING_MATERIAL_OPTIONS);
export const DISASTER_SHELTER_TYPE_VALUES = valuesOf(DISASTER_SHELTER_TYPE_OPTIONS);
export const ACCESSIBLE_FACILITY_TYPE_VALUES = valuesOf(ACCESSIBLE_FACILITY_TYPE_OPTIONS);
export const ACCESSIBILITY_STATUS_VALUES = valuesOf(ACCESSIBILITY_STATUS_OPTIONS);
export const BICYCLE_SUPPORT_SERVICE_VALUES = valuesOf(BICYCLE_SUPPORT_SERVICE_OPTIONS);

const noFeatures = (property: string): unknown[] => ["==", ["get", property], "__multi_select_none__"];

export function publicToiletTypeFilter(mask = allMultiSelectBitmask(PUBLIC_TOILET_TYPE_VALUES)): unknown[] {
  return multiSelectFilter("type2", mask, PUBLIC_TOILET_TYPE_VALUES);
}

const MATERIAL_GROUP_TOKENS: Record<string, readonly string[]> = {
  paper: ["paper", "newspaper", "magazines", "books", "cardboard", "paper_packaging", "beverage_cartons"],
  plastic: ["plastic", "PET", "plastic_bottles", "plastic_packaging"],
  glass: ["glass", "glass_bottles"],
  metal: ["aluminium", "cans", "metal", "scrap_metal"],
  clothing: ["clothes", "shoes"],
  electronics: ["batteries", "computers", "electronics", "electrical_appliances", "mobile_phones", "small_appliances"],
  organic: ["cooking_oil", "green_waste"],
};

export function recyclingMaterialFilter(mask = allMultiSelectBitmask(RECYCLING_MATERIAL_VALUES)): unknown[] {
  const selected = selectedMultiSelectValues(mask, RECYCLING_MATERIAL_VALUES);
  if (selected.length === RECYCLING_MATERIAL_VALUES.length) return ["has", "feature_type"];
  if (selected.length === 0) return noFeatures("feature_type");
  const tokens = [...new Set(selected.flatMap((group) => MATERIAL_GROUP_TOKENS[group] ?? []))];
  return ["any", ...tokens.map((token) => [
    "in", token, ["coalesce", ["get", "materials"], ["literal", []]],
  ])];
}

export function disasterShelterTypeFilter(mask = allMultiSelectBitmask(DISASTER_SHELTER_TYPE_VALUES)): unknown[] {
  const selected = selectedMultiSelectValues(mask, DISASTER_SHELTER_TYPE_VALUES);
  if (selected.length === DISASTER_SHELTER_TYPE_VALUES.length) return ["has", "name"];
  if (selected.length === 0) return noFeatures("name");
  const text = ["coalesce", ["get", "disaster_types_text"], ""];
  return ["any", ...selected.map((value) => value === "__unspecified__"
    ? ["==", text, ""]
    : [">=", ["index-of", value, text], 0])];
}

export function accessibleFacilityFilter(
  typeMask = allMultiSelectBitmask(ACCESSIBLE_FACILITY_TYPE_VALUES),
  statusMask = allMultiSelectBitmask(ACCESSIBILITY_STATUS_VALUES),
): unknown[] {
  return ["all",
    multiSelectFilter("feature_type", typeMask, ACCESSIBLE_FACILITY_TYPE_VALUES),
    multiSelectFilter("accessibility_status", statusMask, ACCESSIBILITY_STATUS_VALUES),
  ];
}

export function bicycleSupportServiceFilter(mask = allMultiSelectBitmask(BICYCLE_SUPPORT_SERVICE_VALUES)): unknown[] {
  const selected = selectedMultiSelectValues(mask, BICYCLE_SUPPORT_SERVICE_VALUES);
  if (selected.length === BICYCLE_SUPPORT_SERVICE_VALUES.length) return ["has", "feature_type"];
  if (selected.length === 0) return noFeatures("feature_type");
  return ["any", ...selected.map((service) => ["==", ["get", `has_${service}`], true])];
}
