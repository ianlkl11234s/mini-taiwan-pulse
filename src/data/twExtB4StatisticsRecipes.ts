// 台灣圖層延伸 B4 統計（2026-11-20）：109 年普查常住人口（鄉鎮，6 指標，含「常住減戶籍」以 0 為界的雙色）、原住民族別人口（鄉鎮，
// 9 期；最多族為類別圖例）、住宅用電（台電表燈非營業用，鄉鎮／縣市，105–114 年）、公司登記動態（縣市，2010–2025 年）、
// 未參加健保比（鄉鎮／縣市，113 年 12 月）、工商普查鄉鎮（110 年）。各層的 tab_theme 併入既有統計主題（人口與教育、
// 環境與資源「住宅用電」、醫療與長照、財稅與消費）。交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py
// --family twExtB4 從 analytics docs/topic-research/tw_layer_ext_20261120/b4/r2/b4-recipes.json 與 release bundle 產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./twExtB4StatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const TW_EXT_B4_ENABLED_STATISTICS_KEYS = [
  "statsCensusResidentVsRegisteredPctTownship", "statsCensusResidentMinusRegisteredTownship", "statsCensusResidentPopulationTownship", "statsCensusElderlyShareTownship", "statsCensusCollegeShareTownship", "statsCensusMovedFromOtherCountyShareTownship",
  "statsIndigenousTribeTop1Township", "statsIndigenousTribeTop1ShareTownship", "statsIndigenousTribePopulationTownship", "statsIndigenousTribeShareTownship",
  "statsResidentialKwhPerCustomerTownship", "statsResidentialKwhTownship", "statsResidentialKwhPerCustomerCounty", "statsResidentialKwhCounty",
  "statsCompanyDissolvedPer1000County", "statsCompanyNewCounty", "statsCompanyDissolvedCounty", "statsCompanyExistingCounty",
  "statsNhiUninsuredShareTownship", "statsNhiUninsuredShareCounty",
  "statsIndustryEstablishmentsTownship", "statsIndustryPersonsEngagedTownship", "statsIndustryProductionValueTownship",
] as const;
export type TwExtB4StatisticsLayerKey = typeof TW_EXT_B4_ENABLED_STATISTICS_KEYS[number];

export const TW_EXT_B4_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
