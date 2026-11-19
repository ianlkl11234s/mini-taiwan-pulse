// 縣市開放資料完整度（30 天地圖挑戰 Day 18 NULL，2026-11-18）：本站整理的政府開放資料平台目錄（2026-10-30 版）中，
// 22 縣市自己發布、同名去重後的資料集數、有座標數（依主題切換）、有座標比例、有空間資訊比例、有座標主題數；縣市單期。
// 目錄口徑：0 或偏少＝本目錄查無，不代表縣市沒有公開；自有平台不在目錄內的縣市為下限。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family openData 從 analytics
// docs/handoff/tw-opendata-completeness-recipes.json 與 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./openDataStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const OPEN_DATA_ENABLED_STATISTICS_KEYS = [
  "statsOpenDataDatasets", "statsOpenDataCoordDatasets", "statsOpenDataCoordShare", "statsOpenDataSpatialShare", "statsOpenDataThemesWithCoords",
] as const;
export type OpenDataStatisticsLayerKey = typeof OPEN_DATA_ENABLED_STATISTICS_KEYS[number];

export const OPEN_DATA_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
