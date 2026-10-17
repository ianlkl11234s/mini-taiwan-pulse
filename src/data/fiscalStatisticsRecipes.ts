// 財稅與消費統計（地方財政、綜所稅所得、營業稅、信用卡、電子發票、工商普查、存放款）；22 recipe、565 個 exact selector（atlas 批次 2026-10-12）。
// 交付 JSON 由 scripts/statistics/build_atlas_statistics_recipes.py 從 analytics atlas 交付產生；
// 首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 共用的查詢、期別白名單與圖例邏輯在 atlasStatisticsRecipes.ts；本檔只宣告本家族的 key 順序（群組內原始數在前）。
import catalogJson from "./fiscalStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

export const FISCAL_ENABLED_STATISTICS_KEYS = [
  "statsFiscalLocalRevenue", "statsFiscalLocalExpenditure", "statsIncomeTaxUnits",
  "statsIncomeTaxTotal", "statsIncomeTaxMean", "statsIncomeTaxMedian",
  "statsIncomeTaxQ1", "statsIncomeTaxQ3", "statsVatDeclarers",
  "statsVatSales", "statsVatTaxPayable", "statsCreditCardResidentAmount",
  "statsCreditCardCrossCountyAmount", "statsCreditCardCrossCountyShare", "statsCreditCardCards",
  "statsCreditCardLocationAmount", "statsEinvoiceAvgTicket", "statsCensusPersonsEngaged",
  "statsCensusEmployeePayroll", "statsCensusEstablishments", "statsBankDeposits",
  "statsBankLoans",
] as const;
export type FiscalStatisticsLayerKey = typeof FISCAL_ENABLED_STATISTICS_KEYS[number];

export const FISCAL_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
