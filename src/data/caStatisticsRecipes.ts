// 加拿大統計（2026-11-04 統計面板加加拿大）：省／地區 13＋普查區 293，4 dataset、24 recipe、24 個 exact selector。
// 人口（2021 普查人口、密度、年齡結構）／社經（私人家戶、2020 家戶所得中位數、2021 勞動力）。
// 交付 JSON 由 scripts/statistics/build_ca_statistics_recipes.py 從 analytics docs/handoff/ca-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// recipe 帶 country: "CA"，目錄與統計分頁依國家分（layerCatalog CA_STATISTICS_TAB_THEMES）。
import catalogJson from "./caStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const CA_ENABLED_STATISTICS_KEYS = [
  "statsCaPopulationPr", "statsCaPopulationCd", "statsCaPopulationDensityPr",
  "statsCaPopulationDensityCd", "statsCaAgeYoungSharePr", "statsCaAgeYoungShareCd",
  "statsCaAgeWorkingSharePr", "statsCaAgeWorkingShareCd", "statsCaAgeOldSharePr",
  "statsCaAgeOldShareCd", "statsCaMedianAgePr", "statsCaMedianAgeCd",
  "statsCaHouseholdsPr", "statsCaHouseholdsCd", "statsCaHouseholdIncomePr",
  "statsCaHouseholdIncomeCd", "statsCaHouseholdIncomeAfterTaxPr", "statsCaHouseholdIncomeAfterTaxCd",
  "statsCaUnemploymentRatePr", "statsCaUnemploymentRateCd", "statsCaParticipationRatePr",
  "statsCaParticipationRateCd", "statsCaEmploymentRatePr", "statsCaEmploymentRateCd",
] as const;
export type CaStatisticsLayerKey = typeof CA_ENABLED_STATISTICS_KEYS[number];

export const CA_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
