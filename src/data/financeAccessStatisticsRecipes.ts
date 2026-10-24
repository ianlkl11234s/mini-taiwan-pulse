// 金融服務據點與可及性（G10，2026-10-24）：財金公司 ATM 台數（縣市月別）、金管會金融服務欠缺鄉鎮第一類、
// 央行各縣市金融機構家數、財金公司名冊自算的分支數與 ATM 裝設點數（縣市／鄉鎮，下載日 2026-10-24）。
// 交付 JSON 由 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --family financeAccess 從 analytics
// docs/handoff/finance-access-statistics-recipes.json 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄。
import catalogJson from "./financeAccessStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const FINANCE_ACCESS_ENABLED_STATISTICS_KEYS = [
  "statsAtmCount", "statsAtmPer10k", "statsFinanceUnderserved", "statsFinanceUnderservedInstitutions", "statsFinancialInstitutions", "statsFinancialBranches", "statsFinancialBranchesPer10k", "statsFinancialBranchesTown", "statsFinancialBranchesPer10kTown", "statsAtmSitesTown", "statsAtmSitesPer10kTown",
] as const;
export type FinanceAccessStatisticsLayerKey = typeof FINANCE_ACCESS_ENABLED_STATISTICS_KEYS[number];

export const FINANCE_ACCESS_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
