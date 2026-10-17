// 疾病與健康統計（結核病、癌症發生與篩檢、出生健康、疫苗、醫療利用）；19 recipe、1530 個 exact selector（atlas 批次 2026-10-12）。
// 交付 JSON 由 scripts/statistics/build_atlas_statistics_recipes.py 從 analytics atlas 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 共用的查詢、期別白名單與圖例邏輯在 atlasStatisticsRecipes.ts；本檔只宣告本家族的 key 順序（群組內原始數在前）。
import catalogJson from "./healthStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const HEALTH_ENABLED_STATISTICS_KEYS = [
  "statsHealthTbNewCases", "statsHealthTbNewCasesPer100kHrp", "statsHealthTbNewCasesTownship",
  "statsHealthTbIncidencePer100kTownship", "statsHealthTbDeaths", "statsHealthTbDeathRate",
  "statsHealthCancerNewCases", "statsHealthCancerIncidenceAsr", "statsHealthCancerIncidenceCrude",
  "statsHealthBreastScreening2yr", "statsHealthCervicalScreening3yr", "statsHealthColorectalScreening2yr",
  "statsHealthLiveBirthsMotherResidence", "statsHealthLowBirthWeightRate", "statsHealthBirthSexRatio",
  "statsHealthImmunizationCompletion", "statsHealthOutpatientVisitRate", "statsHealthMentalOutpatientPer1000",
  "statsHealthHospitalAlos",
] as const;
export type HealthStatisticsLayerKey = typeof HEALTH_ENABLED_STATISTICS_KEYS[number];

export const HEALTH_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
