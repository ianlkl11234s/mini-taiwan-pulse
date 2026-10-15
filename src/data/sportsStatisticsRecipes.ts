// 體育統計（體育運動經費、運動現況調查）；4 recipe、34 個 exact selector（atlas 批次 2026-10-12）。
// 交付 JSON 由 scripts/statistics/build_atlas_statistics_recipes.py 從 analytics atlas 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 共用的查詢、期別白名單與圖例邏輯在 atlasStatisticsRecipes.ts；本檔只宣告本家族的 key 順序（群組內原始數在前）。
import catalogJson from "./sportsStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const SPORTS_ENABLED_STATISTICS_KEYS = [
  "statsSportsBudgetTotal", "statsSportsBudgetPerCapita", "statsExerciseParticipationRate",
  "statsRegularExerciseRate",
] as const;
export type SportsStatisticsLayerKey = typeof SPORTS_ENABLED_STATISTICS_KEYS[number];

export const SPORTS_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
