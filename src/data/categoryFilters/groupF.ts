import type { CategoryFilterDef } from "../categoryFilters";

/** 電廠燃料（powerPlants／powerGenerationUnit）：legend 9 列；原值含中英文與變體，同色者合成一個選項 */
const POWER_FUEL: CategoryFilterDef = {
  property: "fuel_type",
  label: "燃料",
  options: [
    { value: ["nuclear", "核能"], zh: "核能" },
    { value: ["coal", "煤", "煤/輕柴油"], zh: "燃煤" },
    { value: ["oil", "重油"], zh: "燃油" },
    { value: ["natural_gas", "天然氣", "天然氣/煤", "燃氣", "oil_gas"], zh: "天然氣" },
    { value: ["hydro", "水"], zh: "水力" },
    { value: "solar", zh: "太陽光電" },
    { value: ["wind", "offshore_wind"], zh: "風力" },
    { value: "geothermal", zh: "地熱" },
    { value: ["biomass", "biogas", "bioenergy"], zh: "生質" },
  ],
};

/** SSOT facilities 6-layer 共用燃料（FacilityFuelLegend 9 列） */
const FAC_FUEL: CategoryFilterDef = {
  property: "fuel_type",
  label: "燃料",
  options: [
    { value: "coal", zh: "燃煤" },
    { value: "oil_gas", zh: "油氣" },
    { value: "nuclear", zh: "核能" },
    { value: "hydro", zh: "水力" },
    { value: "solar", zh: "太陽光電" },
    { value: "wind", zh: "風力" },
    { value: "bioenergy", zh: "生質" },
    { value: "geothermal", zh: "地熱" },
    { value: "waste", zh: "焚化" },
  ],
};

const STREET_TREE_SPECIES_OPTIONS = [
  { value: "樟樹", zh: "樟樹" },
  { value: "榕樹", zh: "榕樹" },
  { value: ["台灣欒樹", "臺灣欒樹"], zh: "台灣欒樹" },
  { value: "黑板樹", zh: "黑板樹" },
  { value: "茄苳", zh: "茄苳" },
  { value: "小葉欖仁", zh: "小葉欖仁" },
  { value: "楓香", zh: "楓香" },
  { value: "印度紫檀", zh: "印度紫檀" },
  { value: "大花紫薇", zh: "大花紫薇" },
  { value: "水黃皮", zh: "水黃皮" },
] as const;

const RIVERSIDE_TREE_SPECIES_OPTIONS = [
  { value: "榕樹", zh: "榕樹" },
  { value: "茄苳", zh: "茄苳" },
  { value: "垂榕", zh: "垂榕" },
  { value: "構樹", zh: "構樹" },
  { value: "桑樹", zh: "桑樹" },
  { value: "榔榆", zh: "榔榆" },
  { value: "水黃皮", zh: "水黃皮" },
  { value: "雀榕", zh: "雀榕" },
  { value: "樟樹", zh: "樟樹" },
  { value: "水柳", zh: "水柳" },
] as const;

export const CATEGORY_FILTERS_F: Record<string, CategoryFilterDef | readonly CategoryFilterDef[]> = {
  powerPoles: {
    property: "pole_type",
    label: "桿型",
    options: [
      { value: "水泥桿", zh: "水泥桿" },
      { value: "水泥併桿", zh: "水泥併桿" },
      { value: "木桿", zh: "木桿" },
      { value: "H桿", zh: "H桿" },
    ],
    other: "其他",
  },
  powerPlants: POWER_FUEL,
  powerGenerationUnit: POWER_FUEL,
  facPrimary: FAC_FUEL,
  facSecondary: FAC_FUEL,
  facOsmSupplement: FAC_FUEL,
  facPlanned: [
    FAC_FUEL,
    {
      property: "status",
      id: "Status",
      label: "狀態",
      options: [
        { value: "construction", zh: "興建中" },
        { value: "pre-construction", zh: "規劃中" },
        { value: "announced", zh: "公告中" },
      ],
    },
  ],
  osmWindTurbines: {
    property: "is_offshore",
    label: "位置",
    options: [
      { value: "true", zh: "離岸" },
      { value: ["false", ""], zh: "陸域／未標" },
    ],
  },
  streetTreesNational: {
    property: "species",
    label: "樹種",
    options: STREET_TREE_SPECIES_OPTIONS,
    other: "其他",
  },
  riversideTreesTaipei: {
    property: "species",
    label: "樹種",
    options: RIVERSIDE_TREE_SPECIES_OPTIONS,
    other: "其他",
  },
  livestockSlaughter: {
    property: "kind",
    label: "種類",
    options: [
      { value: "家畜", zh: "家畜" },
      { value: "家禽", zh: "家禽" },
    ],
  },
  parkingOffstreet: {
    property: "source_category",
    options: [
      { value: "city", zh: "縣市路外" },
      { value: "tourism", zh: "觀光景點" },
      { value: "freeway_service_area", zh: "國道服務區" },
    ],
  },
};
