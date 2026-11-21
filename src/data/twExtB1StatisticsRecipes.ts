// 台灣圖層延伸 B1 統計（2026-11-20）：疾管署法定傳染病病例數與每十萬人病例率（鄉鎮 10 病、縣市 12 病；
// 維度＝疾病×感染來源，病例數 2003–2025、比率 2018–2025）。tab_theme 併入既有「醫療與長照」的「傳染病」群組。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family twExtB1 從 analytics
// docs/topic-research/tw_layer_ext_20261120/b1/r2/b1-recipes.json 與 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./twExtB1StatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const TW_EXT_B1_ENABLED_STATISTICS_KEYS = [
  "statsHealthNotifiableCasesTownship", "statsHealthNotifiableRatePer100kTownship",
  "statsHealthNotifiableCasesCounty", "statsHealthNotifiableRatePer100kCounty",
] as const;
export type TwExtB1StatisticsLayerKey = typeof TW_EXT_B1_ENABLED_STATISTICS_KEYS[number];

export const TW_EXT_B1_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
