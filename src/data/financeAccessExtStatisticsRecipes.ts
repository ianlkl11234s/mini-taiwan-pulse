// 金融服務可及性延伸（G10 延伸，2026-10-24）：主計總處工商普查金融及保險業場所單位（縣市×35 行業，105／110 年）、
// 財金公司金融卡交易／跨行通匯／國際卡在台提款交易縣市分佈（月，101-01～115-09）、保發中心壽險業分支機構（縣市）、
// 財金公司金融卡特約商店名冊自算的鄉鎮商店數（下載日 2026-10-24）。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family financeAccessExt 從 analytics
// docs/handoff/finance-access-ext-statistics-recipes.json 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./financeAccessExtStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const FINANCE_ACCESS_EXT_ENABLED_STATISTICS_KEYS = [
  "statsFinanceEstablishments", "statsFinanceEstablishmentsPer10k", "statsDebitCardTxnCount", "statsDebitCardTxnShare",
  "statsLifeInsurerBranches", "statsLifeInsurerAgencyOffices",
  "statsDebitMerchantsPer10k", "statsDebitMerchantsExclBulk", "statsDebitMerchants", "statsDebitMerchantAddresses",
] as const;
export type FinanceAccessExtStatisticsLayerKey = typeof FINANCE_ACCESS_EXT_ENABLED_STATISTICS_KEYS[number];

export const FINANCE_ACCESS_EXT_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
