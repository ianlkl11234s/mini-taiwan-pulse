// 台灣圖層延伸 B2 統計（2026-11-20）：新住民子女就讀國中小（鄉鎮，108–114 學年；人數與占比）、鄉鎮前二十大姓
// （2023、2018 年 6 月；第一大姓為類別圖例）、各縣市現存坑洞數（94–113 年）。各層的 tab_theme 併入既有統計主題
// （人口與教育、災害風險）。交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family twExtB2
// 從 analytics docs/topic-research/tw_layer_ext_20261120/b2/r2/b2-recipes.json 與 release bundle 產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./twExtB2StatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const TW_EXT_B2_ENABLED_STATISTICS_KEYS = [
  "statsNrcStudentsTownship", "statsNrcStudentsElementaryTownship", "statsNrcStudentsJuniorTownship", "statsNrcShareTotalTownship", "statsNrcShareElementaryTownship",
  "statsSurnameTop1Township", "statsSurnameTop1ShareTownship", "statsSurnameShareTownship",
  "statsAbandonedPitsCounty",
] as const;
export type TwExtB2StatisticsLayerKey = typeof TW_EXT_B2_ENABLED_STATISTICS_KEYS[number];

export const TW_EXT_B2_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
