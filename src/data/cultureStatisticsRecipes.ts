// 文化統計（G23 補做，2026-10-24）：文化部文化幣可用藝文消費點（data.gov.tw 177601）中「街頭藝人」名冊登記人數，鄉鎮市區／縣市各一層、單期（下載日）。
// 名冊是登記或聯絡地址、不是表演地點；不含姓名，不做點位（Roadmap 第二批決定 #1）。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family culture 從 analytics
// docs/handoff/culture-coin-street-performers-recipes.json 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./cultureStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const CULTURE_ENABLED_STATISTICS_KEYS = [
  "statsCultureStreetPerformersTown", "statsCultureStreetPerformersCounty",
] as const;
export type CultureStatisticsLayerKey = typeof CULTURE_ENABLED_STATISTICS_KEYS[number];

export const CULTURE_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
