/**
 * Atlas 統計的「外國配方家族」登記處（B1 P2，2026-11-24）：全站唯一靜態 import 各國統計配方的地方。
 * `atlasStatisticsRecipes`（共用執行程式）只依賴本檔，不再各自 import kr／gb／ca／ie 的配方，
 * 之後（P5）把配方搬進國家包時，只要把本檔改成由國家包註冊即可，共用程式不用動。
 * 順序＝原本 FAMILIES／ATLAS_ENABLED_STATISTICS_KEYS 中這四國的相對位置（GB、KR、CA、IE），不可調換。
 */
import type { AtlasRecipeCatalogDocument, AtlasRecipeDocument } from "./atlasStatisticsTypes";
import { GB_ENABLED_STATISTICS_KEYS, GB_STATISTICS_DOCUMENT } from "./gbStatisticsRecipes";
import { KR_ENABLED_STATISTICS_KEYS, KR_STATISTICS_DOCUMENT } from "./krStatisticsRecipes";
import { CA_ENABLED_STATISTICS_KEYS, CA_STATISTICS_DOCUMENT } from "./caStatisticsRecipes";
import { IE_ENABLED_STATISTICS_KEYS, IE_STATISTICS_DOCUMENT } from "./ieStatisticsRecipes";

export const ATLAS_COUNTRY_ENABLED_STATISTICS_KEYS = [
  ...GB_ENABLED_STATISTICS_KEYS, ...KR_ENABLED_STATISTICS_KEYS, ...CA_ENABLED_STATISTICS_KEYS, ...IE_ENABLED_STATISTICS_KEYS,
] as const;

export const ATLAS_COUNTRY_FAMILIES: ReadonlyArray<readonly [readonly string[], AtlasRecipeDocument | AtlasRecipeCatalogDocument]> = [
  [GB_ENABLED_STATISTICS_KEYS, GB_STATISTICS_DOCUMENT],
  [KR_ENABLED_STATISTICS_KEYS, KR_STATISTICS_DOCUMENT],
  [CA_ENABLED_STATISTICS_KEYS, CA_STATISTICS_DOCUMENT],
  [IE_ENABLED_STATISTICS_KEYS, IE_STATISTICS_DOCUMENT],
];
