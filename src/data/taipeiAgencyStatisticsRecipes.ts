// 臺北市局處統計（2026-10-23）：環保局垃圾清運／資源回收、衛工處污水接管、產業局工廠登記、建管處使用執照，
// 臺北市 12 區 × 月；11 recipe（layer-plan 建議上色的指標），其餘分子分母戶數與公車縣市層留在 DB／分析倉庫。
// 交付 JSON 由 scripts/statistics/build_taipei_agency_statistics_recipes.py 從 analytics
// docs/handoff/taipei-agency-statistics-recipes.json 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
// 共用的查詢、期別白名單與圖例邏輯在 atlasStatisticsRecipes.ts；本檔只宣告 key 順序（群組內合計在前）。
// 只涵蓋臺北市：其他 356 鄉鎮沒有 observation，地圖以缺值斜線＋「未涵蓋」圖例呈現，不畫成 0。
import catalogJson from "./taipeiAgencyStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS = [
  "statsTaipeiResourceRecyclingTownship", "statsTaipeiGarbageCollectedTownship",
  "statsTaipeiSewerRatePublicTownship", "statsTaipeiSewerRateLegacyTownship",
  "statsTaipeiFactoryCountTownship", "statsTaipeiFactoryCountByIndustryTownship",
  "statsTaipeiUsagePermitCountTownship", "statsTaipeiUsagePermitCountByBuildTypeTownship",
  "statsTaipeiUsagePermitBuildingCountTownship", "statsTaipeiUsagePermitHouseholdCountTownship",
  "statsTaipeiUsagePermitBuildingAreaTownship",
] as const;
export type TaipeiAgencyStatisticsLayerKey = typeof TAIPEI_AGENCY_ENABLED_STATISTICS_KEYS[number];

export const TAIPEI_AGENCY_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
