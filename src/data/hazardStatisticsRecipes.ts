// 災害風險統計（土石流警戒發布溪流次數、社會脆弱度）；8 recipe、63 個 exact selector（atlas 批次 2026-10-12）。
// 交付 JSON 由 scripts/statistics/build_atlas_statistics_recipes.py 從 analytics atlas 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 共用的查詢、期別白名單與圖例邏輯在 atlasStatisticsRecipes.ts；本檔只宣告本家族的 key 順序（群組內原始數在前）。
import catalogJson from "./hazardStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const HAZARD_ENABLED_STATISTICS_KEYS = [
  "statsDebrisFlowAlertStreamsCounty", "statsDebrisFlowRedAlertStreamsCounty", "statsSocialVulnerabilityCompositeCounty",
  "statsSocialVulnerabilityExposureCounty", "statsSocialVulnerabilityMitigationCounty", "statsSocialVulnerabilityResponseCounty",
  "statsSocialVulnerabilityRecoveryCounty", "statsSocialVulnerabilitySubindicatorCounty",
] as const;
export type HazardStatisticsLayerKey = typeof HAZARD_ENABLED_STATISTICS_KEYS[number];

export const HAZARD_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
