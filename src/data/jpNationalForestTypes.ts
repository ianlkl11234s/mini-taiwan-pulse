import type { ExpressionSpecification } from "mapbox-gl";

/**
 * 日本国有林（林野庁 国有林GISデータ 2024（令和6）年度版）的機能類型、色票與出典 SSOT。
 * 配色沿用台灣保安林（forestReserveTypes.ts）的語意色：水源涵養＝天藍、土砂＝褐、氣象害（防風）＝黃綠、
 * 自然維持（自然保育）＝綠、森林空間利用（風景）＝紫、快適環境形成（衛生保建）＝粉；空白＝中性灰。
 * 契約見 taipei-gis-analytics/docs/handoff/jp-wave3-landuse-forest.md、docs/data-catalog/world/jp_national_forests.md。
 */
export interface JpForestFunctionType {
  value: string;
  ja: string;
  label: string;
  color: string;
}

export const JP_FOREST_FUNCTION_TYPES = [
  { value: "water_conservation", ja: "水源涵養タイプ", label: "水源涵養", color: "#0EA5E9" },
  { value: "disaster_prevention_sediment", ja: "山地災害防止タイプ（土砂流出崩壊防備）", label: "山地災害防止（土砂流出崩壞防備）", color: "#92400E" },
  { value: "disaster_prevention_weather", ja: "山地災害防止タイプ（気象害防備）", label: "山地災害防止（氣象害防備）", color: "#A3E635" },
  { value: "forest_recreation", ja: "森林空間利用タイプ", label: "森林空間利用", color: "#A855F7" },
  { value: "nature_preservation", ja: "自然維持タイプ", label: "自然維持", color: "#16A34A" },
  { value: "amenity_environment", ja: "快適環境形成タイプ", label: "快適環境形成", color: "#EC4899" },
] as const satisfies readonly JpForestFunctionType[];

/** 機能類型空白（來源未分類）：中性灰，圖例單列「空白」。 */
export const JP_FOREST_BLANK_COLOR = "#94a3b8";
export const JP_FOREST_LAYER_COLOR = JP_FOREST_FUNCTION_TYPES[4].color;

export const JP_FOREST_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "function_type_en"],
  ...JP_FOREST_FUNCTION_TYPES.flatMap((f) => [f.value, f.color]),
  JP_FOREST_BLANK_COLOR,
] as unknown as ExpressionSpecification;

/** 保安林 17 種（en → 日文名）；`_planned` 後綴＝見込み地。 */
export const JP_FOREST_PROTECTION: Readonly<Record<string, string>> = {
  water_conservation: "水源かん養保安林", sediment_runoff_prevention: "土砂流出防備保安林", landslide_prevention: "土砂崩壊防備保安林",
  sand_drift_prevention: "飛砂防備保安林", windbreak: "防風保安林", flood_prevention: "水害防備保安林",
  salt_damage_prevention: "潮害防備保安林", drought_prevention: "干害防備保安林", snow_protection: "防雪保安林",
  fog_prevention: "防霧保安林", avalanche_prevention: "なだれ防止保安林", rockfall_prevention: "落石防止保安林",
  fire_prevention: "防火保安林", fish_breeding: "魚つき保安林", navigation_landmark: "航行目標保安林",
  public_health: "保健保安林", scenic_beauty: "風致保安林",
};

/** 保護林 11 種（en → 日文名）。 */
export const JP_FOREST_PROTECTED: Readonly<Record<string, string>> = {
  forest_ecosystem_reserve_core: "森林生態系保護地域保存地区", forest_ecosystem_reserve_buffer: "森林生態系保護地域保全利用地区",
  biotic_community_reserve_core: "生物群集保護林保存地区", biotic_community_reserve_buffer: "生物群集保護林保全利用地区",
  rare_population_reserve: "希少個体群保護林", forest_biological_genetic_reserve: "森林生物遺伝資源保存林",
  tree_genetic_reserve: "林木遺伝資源保存林", plant_community_reserve: "植物群落保護林",
  animal_habitat_reserve: "特定動物生息地保護林", geographic_feature_reserve: "特定地理等保護林", local_heritage_forest: "郷土の森",
};

export const JP_FOREST_PLANNED_SUFFIX = "_planned";

export const JP_FOREST_ATTRIBUTION =
  "出典：林野庁「国有林GISデータ（2024（令和6）年度版）」（G空間情報センター）を加工して作成";
export const JP_FOREST_SOURCE_URL = "https://www.geospatial.jp/ckan/dataset/nfgis-2024";
export const JP_FOREST_LICENSE = "公共データ利用規約 第1.0版（PDL1.0）";
export const JP_FOREST_DATA_AS_OF = "2024-04-01";
export const JP_FOREST_FEATURE_COUNT = 116_747;
