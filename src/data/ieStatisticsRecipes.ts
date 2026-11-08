// 愛爾蘭統計（2026-11-07 統計面板加愛爾蘭）：地方政府 31＋選舉分區 3,420，5 dataset、29 recipe、38 個 exact selector。
// 人口（2022 普查人口、密度、都市人口比、年齡結構）／社經（私人家戶、住宅權屬、RTB 平均月租、教育與勞動）。
// RTB 租金只有地方政府層、10 年（2016–2025），都柏林 4 區與 Cork、Galway 市／郡 8 區標未涵蓋。
// 交付 JSON 由 scripts/statistics/build_ie_statistics_recipes.py 從 analytics docs/handoff/ie-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// recipe 帶 country: "IE"，目錄與統計分頁依國家分（layerCatalog IE_STATISTICS_TAB_THEMES）。
import catalogJson from "./ieStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const IE_ENABLED_STATISTICS_KEYS = [
  "statsIePopulationLa", "statsIePopulationEd", "statsIePopulationDensityLa",
  "statsIePopulationDensityEd", "statsIeUrbanShareLa", "statsIeUrbanShareEd",
  "statsIeAgeYoungShareLa", "statsIeAgeYoungShareEd", "statsIeAgeWorkingShareLa",
  "statsIeAgeWorkingShareEd", "statsIeAgeOldShareLa", "statsIeAgeOldShareEd",
  "statsIeHouseholdsLa", "statsIeHouseholdsEd", "statsIeOwnerOccupiedLa",
  "statsIeOwnerOccupiedEd", "statsIePrivateRentedLa", "statsIePrivateRentedEd",
  "statsIeSocialRentedLa", "statsIeSocialRentedEd", "statsIeAverageRentLa",
  "statsIeDegreeShareLa", "statsIeDegreeShareEd", "statsIeUnemploymentRateLa",
  "statsIeUnemploymentRateEd", "statsIeParticipationRateLa", "statsIeParticipationRateEd",
  "statsIeEmploymentRateLa", "statsIeEmploymentRateEd",
] as const;
export type IeStatisticsLayerKey = typeof IE_ENABLED_STATISTICS_KEYS[number];

export const IE_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
