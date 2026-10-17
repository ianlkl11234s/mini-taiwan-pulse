// 治安統計（G17）：警政署犯罪資料 8 案類＋電信詐欺，鄉鎮／縣市 × 件數／每十萬人；36 recipe、386 個 exact selector。
// 取代舊 crimeAreaMonthly（11 年累計、無年份無分母的 PMTiles）。
// 交付 JSON 由 scripts/statistics/build_crime_statistics_recipes.py 從 analytics docs/handoff/crime-statistics-recipes.json
// 與各 release bundle 產生；首屏只帶去掉 `delivery` 收據的派生目錄（statisticsRecipeCatalog.test.ts 保證一致）。
// 共用的查詢、期別白名單與圖例邏輯在 atlasStatisticsRecipes.ts；本檔只宣告 key 順序（群組內鄉鎮在前、件數在前）。
import catalogJson from "./crimeStatisticsRecipes.catalog.json";
import type { AtlasRecipeDocument } from "./atlasStatisticsTypes";

const CASES = [
  "statsCrimeDrug", "statsCrimeResidentialBurglary", "statsCrimeMotorcycleTheft", "statsCrimeCarTheft",
  "statsCrimeRobbery", "statsCrimeSnatching", "statsCrimeSexualAssault", "statsCrimeOrganizedCrime", "statsTelecomFraud",
] as const;

export const CRIME_ENABLED_STATISTICS_KEYS = [
  "statsCrimeDrugCasesTownship", "statsCrimeDrugPer100kTownship", "statsCrimeDrugCasesCounty", "statsCrimeDrugPer100kCounty",
  "statsCrimeResidentialBurglaryCasesTownship", "statsCrimeResidentialBurglaryPer100kTownship", "statsCrimeResidentialBurglaryCasesCounty", "statsCrimeResidentialBurglaryPer100kCounty",
  "statsCrimeMotorcycleTheftCasesTownship", "statsCrimeMotorcycleTheftPer100kTownship", "statsCrimeMotorcycleTheftCasesCounty", "statsCrimeMotorcycleTheftPer100kCounty",
  "statsCrimeCarTheftCasesTownship", "statsCrimeCarTheftPer100kTownship", "statsCrimeCarTheftCasesCounty", "statsCrimeCarTheftPer100kCounty",
  "statsCrimeRobberyCasesTownship", "statsCrimeRobberyPer100kTownship", "statsCrimeRobberyCasesCounty", "statsCrimeRobberyPer100kCounty",
  "statsCrimeSnatchingCasesTownship", "statsCrimeSnatchingPer100kTownship", "statsCrimeSnatchingCasesCounty", "statsCrimeSnatchingPer100kCounty",
  "statsCrimeSexualAssaultCasesTownship", "statsCrimeSexualAssaultPer100kTownship", "statsCrimeSexualAssaultCasesCounty", "statsCrimeSexualAssaultPer100kCounty",
  "statsCrimeOrganizedCrimeCasesTownship", "statsCrimeOrganizedCrimePer100kTownship", "statsCrimeOrganizedCrimeCasesCounty", "statsCrimeOrganizedCrimePer100kCounty",
  "statsTelecomFraudCasesTownship", "statsTelecomFraudPer100kTownship", "statsTelecomFraudCasesCounty", "statsTelecomFraudPer100kCounty",
] as const satisfies ReadonlyArray<`${typeof CASES[number]}${"Cases" | "Per100k"}${"Township" | "County"}`>;
export type CrimeStatisticsLayerKey = typeof CRIME_ENABLED_STATISTICS_KEYS[number];

export const CRIME_STATISTICS_DOCUMENT = catalogJson as unknown as AtlasRecipeDocument;
