// 南韓統計（2026-10-31 統計面板多國化）：道級 16＋市郡區 256，3 dataset、33 recipe、33 個 exact selector。
// 人口（住民登錄人口 2026-09、SGIS 2024 人口密度與高齡化、首爾生活人口 2026-07）／社經（SGIS 2024 家戶住宅、事業體）。
// 交付 JSON 由 scripts/statistics/build_kr_statistics_recipes.py 從 analytics docs/handoff/kr-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// recipe 帶 country: "KR"，目錄與統計分頁依國家分（layerCatalog KR_STATISTICS_TAB_THEMES）。
import catalogJson from "./krStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const KR_ENABLED_STATISTICS_KEYS = [
  "statsKrPopulationSido", "statsKrPopulationSgg", "statsKrPopulationMaleSido",
  "statsKrPopulationMaleSgg", "statsKrPopulationFemaleSido", "statsKrPopulationFemaleSgg",
  "statsKrSexRatioSido", "statsKrSexRatioSgg", "statsKrAgeYoungShareSido",
  "statsKrAgeYoungShareSgg", "statsKrAgeWorkingShareSido", "statsKrAgeWorkingShareSgg",
  "statsKrAgeOldShareSido", "statsKrAgeOldShareSgg", "statsKrPopulationDensitySido",
  "statsKrPopulationDensitySgg", "statsKrMeanAgeSido", "statsKrMeanAgeSgg",
  "statsKrAgingIndexSido", "statsKrAgingIndexSgg", "statsKrSeoulLivingPopSgg",
  "statsKrSeoulLivingPopDaySgg", "statsKrSeoulLivingPopNightSgg", "statsKrSeoulDayNightRatioSgg",
  "statsKrHouseholdsSido", "statsKrHouseholdsSgg", "statsKrHouseholdSizeSgg",
  "statsKrDwellingsSido", "statsKrDwellingsSgg", "statsKrEstablishmentsSido",
  "statsKrEstablishmentsSgg", "statsKrEmployeesSido", "statsKrEmployeesSgg",
] as const;
export type KrStatisticsLayerKey = typeof KR_ENABLED_STATISTICS_KEYS[number];

export const KR_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
