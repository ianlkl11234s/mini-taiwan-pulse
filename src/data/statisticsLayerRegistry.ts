import type { LayerVisibility } from "../types";
import { STATISTICS_KEYS, type StatisticsLayerKey } from "./regionalStatisticsRecipes";

/** Statistics tab 的圖層角色是 UI 行為契約，不從 tab 的顯示陣列推測。 */
export const STATISTICS_TAB_LAYER_ROLES = {
  statsWasteCounty: "choropleth",
  statsRecyclingCounty: "choropleth",
  statsWasteRecyclingRate: "choropleth",
  statsResidentialElectricity: "choropleth",
  statsRiceHarvest: "choropleth",
  statsBirthsTownship: "choropleth",
  statsPigWaterCounty: "choropleth",
  statsWaterSupplyHistorical: "choropleth",
  statsMaritimeSubsidyCounty: "choropleth",
  statsCivilAeronauticsSubsidyCounty: "choropleth",
  statsOffstreetSmallCarParkingSpacesCount: "choropleth",
  statsOnstreetSmallCarParkingSpacesCount: "choropleth",
  statsMotorcycleRegisteredCount: "choropleth",
  statsAutomobileRegisteredCount: "choropleth",
  statsAutomobileLicenseHoldersCount: "choropleth",
  statsMotorcycleLicenseHoldersCount: "choropleth",
  crimeAreaMonthly: "choropleth",
  countyBoundary: "boundary",
  townshipBoundary: "boundary",
} as const satisfies Partial<Record<keyof LayerVisibility, "choropleth" | "boundary">>;

export const STATISTICS_CHOROPLETH_KEYS = [
  ...STATISTICS_KEYS,
  "crimeAreaMonthly",
] as const satisfies readonly (keyof LayerVisibility)[];

export type StatisticsChoroplethKey = typeof STATISTICS_CHOROPLETH_KEYS[number];

export function isStatisticsChoropleth(key: string): key is StatisticsChoroplethKey {
  return (STATISTICS_CHOROPLETH_KEYS as readonly string[]).includes(key);
}

/** Recipes 是資料載入契約；此處只表達其在 Statistics UI 裡的呈現角色。 */
export function isRecipeStatisticsChoropleth(key: string): key is StatisticsLayerKey {
  return (STATISTICS_KEYS as readonly string[]).includes(key);
}
