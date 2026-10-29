// 英國統計（2026-10-29 統計面板多國化）：ONS LAD 361 區（四地）8 dataset、18 recipe、100 個 exact selector。
// 人口（年中推估、城鄉）／社經（四地剝奪指數各自一組，不可跨國比較）／住宅（UK HPI 房價、PIPR 租金）。
// 交付 JSON 由 scripts/statistics/build_gb_statistics_recipes.py 從 analytics docs/handoff/gb-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// recipe 帶 country: "GB"，目錄與統計分頁依國家分（layerCatalog GB_STATISTICS_TAB_THEMES）。
import catalogJson from "./gbStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const GB_ENABLED_STATISTICS_KEYS = [
  "statsGbPopulation", "statsGbPopulationDensity", "statsGbMedianAge",
  "statsGbRuralShareEw", "statsGbFarFromTownShareEw", "statsGbRuralShareSco",
  "statsGbImdScoreEng", "statsGbImdShare10Eng",
  "statsGbWimdShare10", "statsGbWimdShare20",
  "statsGbSimdShare10", "statsGbSimdShare20",
  "statsGbNimdmShare10", "statsGbNimdmShare20",
  "statsGbHousePrice", "statsGbHousePriceChange",
  "statsGbPrivateRent", "statsGbPrivateRentChange",
] as const;
export type GbStatisticsLayerKey = typeof GB_ENABLED_STATISTICS_KEYS[number];

export const GB_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
