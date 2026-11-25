// 英國國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { GbAquacultureLegend, GbCompaniesLegend, GbFuneralLegend, GbManufacturingLegend, GbSoilParentMaterialLegend } from "./gbBusinessAgriLegends";
import { GbCareHomesLegend, GbCareServicesLegend, GbCourtsLegend, GbFireStationsLegend, GbHealthFacilitiesLegend, GbSchoolsLegend } from "./gbCivicLegends";
import { GbArtsVenuesLegend, GbCulturalFacilitiesLegend, GbVisitorExperienceLegend } from "./gbCultureLegends";
import { GbFuelStationsLegend, GbOilGasFieldsLegend, GbPowerLinesLegend, GbPowerPlantsLegend, GbRenewablesLegend, GbSubstationsLegend } from "./gbEnergyLegends";
import { GbBrownfieldLegend, GbNoiseLegend, GbPlanningConstraintsLegend, GbPollutionInventoryEnglandLegend, GbPollutionInventoryLegend, GbRecyclingCentresLegend, GbWastePermitsLegend } from "./gbEnvPlanningLegends";
import { GbEarthquakesLegend, GbGroundStabilityLegend, GbLandslideLegend, GbRadiationLegend, GbRadonLegend } from "./gbHazardLegends";
import { GbSurplusLandLegend, GbTerrainHillshadeLegend, GbTerrainReliefLegend } from "./gbLandLegends";
import { GbForestRecreationLegend, GbMarineProtectedAreasLegend, GbOpenAccessLandLegend, GbProtectedAreasLegend, GbTrailsLegend, GbTreeProtectionLegend, GbWoodlandLegend } from "./gbNatureLegends";
import { GbBridgesTunnelsLegend, GbPlacesOfWorshipLegend, GbPublicFacilitiesLegend, GbRoadFacilitiesLegend } from "./gbOsmLegends";
import { GbLondonBikePointsLegend, GbLondonChargingZonesLegend, GbLondonJamCamsLegend, GbLondonRailLinesLegend, GbLondonStationsLegend, GbMajorRoadsLegend, GbRailReplayLegend, GbStationUsageLegend, GbTrafficCountsAadfLegend, GbTransportHubsLegend } from "./gbTransportLegends";
import { GbAdminBoundariesLegend, GbBuiltUpAreasLegend, GbGreenspaceLegend, GbMaritimeLimitsLegend, GbSmallAreaBoundariesLegend } from "./gbUrbanFormLegends";
import { GbBathingWatersLegend, GbCoastalErosionRiskLegend, GbFloodDefenceAssetsLegend, GbHydroStationsLegend, GbRiversLegend } from "./gbWaterSharedLegends";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("GB", n)。 */
export const GB_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "gbAdminBoundaries", render: () => <GbAdminBoundariesLegend /> },
  ],
  2: [
  { id: "gbSmallAreaBoundaries", render: () => <GbSmallAreaBoundariesLegend /> },
  { id: "gbMaritimeLimits", render: () => <GbMaritimeLimitsLegend /> },
  { id: "gbBuiltUpAreas", render: () => <GbBuiltUpAreasLegend /> },
  { id: "gbGreenspace", render: () => <GbGreenspaceLegend layerKey="gbGreenspace" /> },
  { id: "gbSportsFacilities", render: () => <GbGreenspaceLegend layerKey="gbSportsFacilities" /> },
  { id: "gbGolfCourses", render: () => <GbGreenspaceLegend layerKey="gbGolfCourses" /> },
  { id: "gbCemeteries", render: () => <GbGreenspaceLegend layerKey="gbCemeteries" /> },
  { id: "gbRivers", render: () => <GbRiversLegend /> },
  { id: "gbHydroStations", render: () => <GbHydroStationsLegend /> },
  { id: "gbFloodDefenceAssets", render: () => <GbFloodDefenceAssetsLegend /> },
  { id: "gbCoastalErosionRisk", render: () => <GbCoastalErosionRiskLegend /> },
  { id: "gbBathingWaters", render: () => <GbBathingWatersLegend /> },
  { id: "gbTransportHubs", render: () => <GbTransportHubsLegend /> },
  { id: "gbStationUsage", render: () => <GbStationUsageLegend /> },
  { id: "gbLondonRailLines", render: () => <GbLondonRailLinesLegend /> },
  { id: "gbRailReplay", render: () => <GbRailReplayLegend /> },
  { id: "gbLondonStations", render: () => <GbLondonStationsLegend /> },
  { id: "gbLondonBikePoints", render: () => <GbLondonBikePointsLegend /> },
  { id: "gbLondonJamCams", render: () => <GbLondonJamCamsLegend /> },
  { id: "gbLondonChargingZones", render: () => <GbLondonChargingZonesLegend /> },
  { id: "gbMajorRoads", render: () => <GbMajorRoadsLegend /> },
  { id: "gbBridgesTunnels", render: () => <GbBridgesTunnelsLegend /> },
  { id: "gbRoadFacilities", render: () => <GbRoadFacilitiesLegend /> },
  { id: "gbPublicFacilities", render: () => <GbPublicFacilitiesLegend /> },
  { id: "gbPlacesOfWorship", render: () => <GbPlacesOfWorshipLegend /> },
  { id: "gbCompanies", render: () => <GbCompaniesLegend /> },
  { id: "gbManufacturing", render: () => <GbManufacturingLegend /> },
  { id: "gbFuneral", render: () => <GbFuneralLegend /> },
  { id: "gbAquaculture", render: () => <GbAquacultureLegend /> },
  { id: "gbSoilParentMaterial", render: () => <GbSoilParentMaterialLegend /> },
  { id: "gbPlanningConstraints", render: () => <GbPlanningConstraintsLegend /> },
  { id: "gbBrownfield", render: () => <GbBrownfieldLegend /> },
  { id: "gbRecyclingCentres", render: () => <GbRecyclingCentresLegend /> },
  { id: "gbWastePermits", render: () => <GbWastePermitsLegend /> },
  { id: "gbPollutionInventory", render: () => <GbPollutionInventoryLegend /> },
  { id: "gbPollutionInventoryEngland", render: () => <GbPollutionInventoryEnglandLegend /> },
  { id: "gbNoise", render: () => <GbNoiseLegend /> },
  { id: "gbTrafficCountsAadf", render: () => <GbTrafficCountsAadfLegend /> },
  { id: "gbProtectedAreas", render: () => <GbProtectedAreasLegend /> },
  { id: "gbMarineProtectedAreas", render: () => <GbMarineProtectedAreasLegend /> },
  { id: "gbWoodland", render: () => <GbWoodlandLegend /> },
  { id: "gbForestRecreation", render: () => <GbForestRecreationLegend /> },
  { id: "gbTrails", render: () => <GbTrailsLegend /> },
  { id: "gbOpenAccessLand", render: () => <GbOpenAccessLandLegend /> },
  { id: "gbTreeProtection", render: () => <GbTreeProtectionLegend /> },
  { id: "gbPowerPlants", render: () => <GbPowerPlantsLegend /> },
  { id: "gbRenewables", render: () => <GbRenewablesLegend /> },
  { id: "gbPowerLines", render: () => <GbPowerLinesLegend /> },
  { id: "gbSubstations", render: () => <GbSubstationsLegend /> },
  { id: "gbFuelStations", render: () => <GbFuelStationsLegend /> },
  { id: "gbOilGasFields", render: () => <GbOilGasFieldsLegend /> },
  { id: "gbSchools", render: () => <GbSchoolsLegend /> },
  { id: "gbHealthFacilities", render: () => <GbHealthFacilitiesLegend /> },
  { id: "gbCareHomes", render: () => <GbCareHomesLegend /> },
  { id: "gbCareServices", render: () => <GbCareServicesLegend /> },
  { id: "gbFireStations", render: () => <GbFireStationsLegend /> },
  { id: "gbCourts", render: () => <GbCourtsLegend /> },
  { id: "gbCulturalFacilities", render: () => <GbCulturalFacilitiesLegend /> },
  { id: "gbArtsVenues", render: () => <GbArtsVenuesLegend /> },
  { id: "gbVisitorExperience", render: () => <GbVisitorExperienceLegend /> },
  { id: "gbTerrainHillshade", render: () => <GbTerrainHillshadeLegend /> },
  { id: "gbTerrainRelief", render: () => <GbTerrainReliefLegend /> },
  { id: "gbSurplusLand", render: () => <GbSurplusLandLegend /> },
  { id: "gbGroundStability", render: () => <GbGroundStabilityLegend /> },
  { id: "gbLandslide", render: () => <GbLandslideLegend /> },
  { id: "gbRadon", render: () => <GbRadonLegend /> },
  { id: "gbRadiation", render: () => <GbRadiationLegend /> },
  { id: "gbEarthquakes", render: () => <GbEarthquakesLegend /> },
  ],
  // <codemod:append GB_PACK_LEGEND_SLOTS>
};
