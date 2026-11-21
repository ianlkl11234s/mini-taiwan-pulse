// 台灣圖層延伸 B5 統計（2026-11-21）：縣市間遷徙（由內政部縣市間遷徙 OD 加總，2024、2025 年）：淨遷入人數、淨遷入率、
// 遷入人數、遷出人數。只含跨縣市戶籍遷徙（不含國外、初設戶籍），與既有「人口遷徙（縣市）」口徑不同。併入「人口與教育」的「遷徙」群組；
// 也是「縣市間遷徙流向」弧線圖層（twCountyMigrationFlows）的底色。交付 JSON 由
// scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family twExtB5 從 analytics
// docs/topic-research/tw_layer_ext_20261120/b5/r2/b5-recipes.json 與 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./twExtB5StatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const TW_EXT_B5_ENABLED_STATISTICS_KEYS = [
  "statsCountyOdNetMigration", "statsCountyOdNetMigrationRate", "statsCountyOdInMigration", "statsCountyOdOutMigration",
] as const;
export type TwExtB5StatisticsLayerKey = typeof TW_EXT_B5_ENABLED_STATISTICS_KEYS[number];

export const TW_EXT_B5_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
