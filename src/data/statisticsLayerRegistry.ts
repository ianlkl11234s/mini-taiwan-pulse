import { COMPARISON_STATISTICS_KEYS } from './comparisonStatisticsKeys';
import type { LayerVisibility } from "../types";
import { STATISTICS_KEYS, STATISTICS_RENDER_KEYS, type StatisticsLayerKey } from "./regionalStatisticsRecipes";
import { EDUCATION_PRESENTATION_VIEW_KEYS } from "./statisticsPresentationViews";
import { AGRI_ENABLED_STATISTICS_RECIPES, AGRI_EXISTING_LAYER_REFERENCES, type AgriStatisticsLayerKey } from "./agriStatisticsRecipes";
import { SOCIAL_ENABLED_STATISTICS_RECIPES, type SocialStatisticsLayerKey } from "./socialStatisticsRecipes";
import { LABOR_ENABLED_STATISTICS_RECIPES, type LaborStatisticsLayerKey } from "./laborStatisticsRecipes";
import { ENVIRONMENT_ENABLED_STATISTICS_RECIPES, type EnvironmentStatisticsLayerKey } from "./environmentStatisticsRecipes";
import { DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES, type DemographicsStatisticsLayerKey } from "./demographicsStatisticsRecipes";
import { ADDICTION_ENABLED_STATISTICS_RECIPES, type AddictionStatisticsLayerKey } from "./addictionStatisticsRecipes";
import { LANDSLIDE_ENABLED_STATISTICS_RECIPES, type LandslideStatisticsLayerKey } from "./landslideStatisticsRecipes";

const AGRI_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  AGRI_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<AgriStatisticsLayerKey, "choropleth">;
const SOCIAL_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  SOCIAL_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<SocialStatisticsLayerKey, "choropleth">;
const LABOR_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  LABOR_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<LaborStatisticsLayerKey, "choropleth">;

const ENVIRONMENT_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  ENVIRONMENT_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<EnvironmentStatisticsLayerKey, "choropleth">;

const DEMOGRAPHICS_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  DEMOGRAPHICS_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<DemographicsStatisticsLayerKey, "choropleth">;

const ADDICTION_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  ADDICTION_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<AddictionStatisticsLayerKey, "choropleth">;

const LANDSLIDE_STATISTICS_TAB_LAYER_ROLES = Object.fromEntries(
  LANDSLIDE_ENABLED_STATISTICS_RECIPES.map((recipe) => [recipe.layer_key, "choropleth"]),
) as Record<LandslideStatisticsLayerKey, "choropleth">;

/** Index-only existing recipes are for StatisticsDetails navigation, never sidebar registration. */
export { AGRI_EXISTING_LAYER_REFERENCES };

/** Statistics tab 的圖層角色是 UI 行為契約，不從 tab 的顯示陣列推測。 */
export const STATISTICS_TAB_LAYER_ROLES = {
  ...Object.fromEntries(COMPARISON_STATISTICS_KEYS.map(key => [key, "choropleth"])),
  ...AGRI_STATISTICS_TAB_LAYER_ROLES,
  ...SOCIAL_STATISTICS_TAB_LAYER_ROLES,
  ...LABOR_STATISTICS_TAB_LAYER_ROLES,
  ...ENVIRONMENT_STATISTICS_TAB_LAYER_ROLES,
  ...DEMOGRAPHICS_STATISTICS_TAB_LAYER_ROLES,
  ...ADDICTION_STATISTICS_TAB_LAYER_ROLES,
  ...LANDSLIDE_STATISTICS_TAB_LAYER_ROLES,
  ...Object.fromEntries(EDUCATION_PRESENTATION_VIEW_KEYS.map(key => [key, "choropleth"])),
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
  statsTaipeiTrafficViolationCitations: "choropleth",
  statsTaichungRoadNoiseMonitoringStations: "choropleth",
  statsBusOperatingRouteLengthKm: "choropleth", statsBusApprovedRouteCount: "choropleth", statsUrbanBusOperatorCount: "choropleth", statsBusOperatingVehicleCount: "choropleth", statsBusAccessibleVehicleCount: "choropleth", statsBusElectricVehicleCount: "choropleth", statsBusOperatingTripCount: "choropleth", statsBusOperatingVehicleKm: "choropleth", statsTmrtStationOutboundCounty: "choropleth",
  statsTaipeiUrbanRentalStations: "choropleth", statsTaipeiUrbanRentalTrips: "choropleth", statsTaipeiRiversideRentalStations: "choropleth", statsTaipeiRiversideBicycles: "choropleth", statsTaipeiRiversideRentalTrips: "choropleth",
  statsA1AccidentCount: "choropleth", statsA1DeathCount: "choropleth", statsA1InjuryCount: "choropleth",
  statsAirportTakeoffsLandings: "choropleth", statsAirportPassengerMovements: "choropleth", statsAirportCargoTonnes: "choropleth",
  statsTaoyuanAirportArrivals: "choropleth", statsTaoyuanAirportDepartures: "choropleth", statsTaoyuanAirportTransit: "choropleth", statsTaoyuanAirportPassengerMovements: "choropleth",
  statsOffstreetSmallCarParkingSpacesCount: "choropleth",
  statsOnstreetSmallCarParkingSpacesCount: "choropleth",
  statsMotorcycleRegisteredCount: "choropleth",
  statsAutomobileRegisteredCount: "choropleth",
  statsAutomobileLicenseHoldersCount: "choropleth",
  statsMotorcycleLicenseHoldersCount: "choropleth",
  crimeAreaMonthly: "choropleth",
  propertyValueAdmin: "choropleth",
  countyBoundary: "boundary",
  townshipBoundary: "boundary",
} as const satisfies Partial<Record<keyof LayerVisibility, "choropleth" | "boundary">>;

export const STATISTICS_CHOROPLETH_KEYS = [
  ...STATISTICS_RENDER_KEYS,
  "crimeAreaMonthly",
  "propertyValueAdmin",
] as const satisfies readonly (keyof LayerVisibility)[];

export type StatisticsChoroplethKey = typeof STATISTICS_CHOROPLETH_KEYS[number];

export function isStatisticsChoropleth(key: string): key is StatisticsChoroplethKey {
  return (STATISTICS_CHOROPLETH_KEYS as readonly string[]).includes(key);
}

/** Recipes 是資料載入契約；此處只表達其在 Statistics UI 裡的呈現角色。 */
export function isRecipeStatisticsChoropleth(key: string): key is StatisticsLayerKey {
  return (STATISTICS_KEYS as readonly string[]).includes(key);
}
