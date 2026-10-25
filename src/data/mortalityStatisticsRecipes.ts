// 死因統計（G20，2026-10-24）：衛福部統計處死因統計（data.gov.tw 5965），縣市（97–114 年）與鄉鎮（100–114 年逐年＋三段 5 年合計），
// 6 recipe 同一群組「死因統計」（鄉鎮 5 年平均粗死亡率在前＝預設；縣市／鄉鎮、率／人數、逐年／5 年在群組選單切換），死因 43 值、人數另有性別。
// 交付 JSON 由 scripts/statistics/build_mortality_statistics_recipes.py 從 analytics docs/handoff/mortality-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶派生目錄（不含 release_options 與 `delivery` 收據），3,863 個 exact selector 在開圖層／期別選單時
// 由 statisticsRecipeDetails 按需載入（同臺北市局處統計）。不遮蔽（Roadmap 第二批決定 #5），0＝該期無死亡，不是無資料。
import catalogJson from "./mortalityStatisticsRecipes.catalog.json";
import type { AtlasRecipeCatalogDocument } from "./atlasStatisticsTypes";

export const MORTALITY_ENABLED_STATISTICS_KEYS = [
  "statsMortalityCauseTownship", "statsMortalityDeaths5yrTownship",
  "statsMortalityRateTownship", "statsMortalityDeathsTownship",
  "statsMortalityCauseCounty", "statsMortalityDeathsCounty",
] as const;
export type MortalityStatisticsLayerKey = typeof MORTALITY_ENABLED_STATISTICS_KEYS[number];

/** 首屏目錄（不含 release_options）；完整 selector 用 statisticsRecipeDetails 的 atlasLazyRecipeDetailsDocument("mortality")。 */
export const MORTALITY_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeCatalogDocument;
