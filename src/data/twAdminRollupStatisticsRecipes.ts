// 村里／鄉鎮公司登記與實價登錄彙總統計（2026-11-27）：公司登記家數、每千人公司家數、地方特色產業（區位商數最高的產業大類，類別型）、
// 房屋買賣單價中位數、房屋買賣成交筆數，各有村里與鄉鎮市區兩個層級（10 層）。公司歸入「財稅與消費」，實價登錄歸入「住宅與不動產」。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family twAdminRollup 從 analytics
// docs/topic-research/tw_h3_grid/stat_bundles/admin-rollup-recipes.json 與 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./twAdminRollupStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const TW_ADMIN_ROLLUP_ENABLED_STATISTICS_KEYS = [
  "statsVillageCompanyCount", "statsVillageCompanyPer1000", "statsVillageCompanySpecialty", "statsVillageSalePriceMedian", "statsVillageSaleCount",
  "statsTownshipCompanyCount", "statsTownshipCompanyPer1000", "statsTownshipCompanySpecialty", "statsTownshipSalePriceMedian", "statsTownshipSaleCount",
] as const;
export type TwAdminRollupStatisticsLayerKey = typeof TW_ADMIN_ROLLUP_ENABLED_STATISTICS_KEYS[number];

export const TW_ADMIN_ROLLUP_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
