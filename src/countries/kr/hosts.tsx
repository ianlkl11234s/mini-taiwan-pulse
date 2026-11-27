// 南韓國家包：hosts.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LayerHookEntry } from "../../layers/layerHookRegistry";
import { KrAdminHost, KrAirportsHost, KrAnimalHospitalsHost, KrBicycleParkingHost, KrBridgesHost, KrBusStopsHost, KrCemeteriesOsmHost, KrChildProtectionZonesHost, KrCivilDefenseSheltersHost, KrCivilDefenseWaterHost, KrClothingBinsHost, KrCoastalErosionFacilitiesHost, KrEcologyNaturalnessHost, KrEmergencyBellsHost, KrFestivalsHost, KrFireStationsHost, KrFishingGroundsHost, KrFuelStationsHost, KrHeritageHost, KrHospitalsPharmaciesHost, KrIndustrialComplexesHost, KrLibrariesHost, KrLocalCultureCentersHost, KrLodgingHost, KrMarineEnvSitesHost, KrMarinePollutionIncidentsHost, KrMarineProtectedAreasHost, KrMuseumsHost, KrNationalParksHost, KrNationalRoadsHost, KrNoiseSitesHost, KrNpLocationSignsHost, KrNpTrailsHost, KrOilGasHost, KrParkingLotsHost, KrPerformancesHost, KrPoliceBoxesHost, KrPopulationH3Host, KrPortsHost, KrPowerLinesHost, KrPowerPlantsHost, KrPowerTowersHost, KrProtectedTreesHost, KrPublicBicycleStationsHost, KrRailLinesHost, KrRailStationsHost, KrRenewablesHost, KrRiversOsmHost, KrRuralExperienceVillagesHost, KrSafeDeliveryBoxesHost, KrSchoolDistrictsHost, KrSchoolsHost, KrSeniorCentersHost, KrSeoulSubwayCongestionHost, KrSeoulZoningHost, KrSlaughterhousesHost, KrSluiceGatesHost, KrSpeedCamerasHost, KrSportsFacilitiesHost, KrStreetTreesHost, KrSubstationsHost, KrTerritorialSeaHost, KrTraditionalTemplesHost, KrUrbanParksHost, KrWasteDisposalRulesHost, KrWaterLevelStationsHost, KrWaterQualityStationsHost } from "./koreaHosts";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("KR", n)。 */
export const KR_PACK_HOST_SLOTS: Readonly<Record<number, readonly LayerHookEntry[]>> = {
  1: [
  // 南韓（2026-10-31 第 0 波）
  { id: "useKrAdminLayers", keys: ["krAdminBoundaries"], Host: KrAdminHost },
  { id: "useKrEcologyNaturalnessLayer", keys: ["krEcologyNaturalness"], Host: KrEcologyNaturalnessHost },
  { id: "useKrWasteDisposalRulesLayer", keys: ["krWasteDisposalRules"], Host: KrWasteDisposalRulesHost },
  // 南韓第 3–5 波（18 層，各自一個 PMTiles source）
  { id: "useKrWaterLevelStationsLayer", keys: ["krWaterLevelStations"], Host: KrWaterLevelStationsHost },
  { id: "useKrSluiceGatesLayer", keys: ["krSluiceGates"], Host: KrSluiceGatesHost },
  { id: "useKrWaterQualityStationsLayer", keys: ["krWaterQualityStations"], Host: KrWaterQualityStationsHost },
  { id: "useKrCoastalErosionFacilitiesLayer", keys: ["krCoastalErosionFacilities"], Host: KrCoastalErosionFacilitiesHost },
  { id: "useKrRiversOsmLayer", keys: ["krRiversOsm"], Host: KrRiversOsmHost },
  { id: "useKrMarinePollutionIncidentsLayer", keys: ["krMarinePollutionIncidents"], Host: KrMarinePollutionIncidentsHost },
  { id: "useKrMarineEnvSitesLayer", keys: ["krMarineEnvSites"], Host: KrMarineEnvSitesHost },
  { id: "useKrMarineProtectedAreasLayer", keys: ["krMarineProtectedAreas"], Host: KrMarineProtectedAreasHost },
  { id: "useKrPublicBicycleStationsLayer", keys: ["krPublicBicycleStations"], Host: KrPublicBicycleStationsHost },
  { id: "useKrSeoulSubwayCongestionLayer", keys: ["krSeoulSubwayCongestion"], Host: KrSeoulSubwayCongestionHost },
  { id: "useKrBridgesLayer", keys: ["krBridges"], Host: KrBridgesHost },
  { id: "useKrParkingLotsLayer", keys: ["krParkingLots"], Host: KrParkingLotsHost },
  { id: "useKrSpeedCamerasLayer", keys: ["krSpeedCameras"], Host: KrSpeedCamerasHost },
  { id: "useKrChildProtectionZonesLayer", keys: ["krChildProtectionZones"], Host: KrChildProtectionZonesHost },
  { id: "useKrNationalParksLayer", keys: ["krNationalParks"], Host: KrNationalParksHost },
  { id: "useKrNpLocationSignsLayer", keys: ["krNpLocationSigns"], Host: KrNpLocationSignsHost },
  { id: "useKrNpTrailsLayer", keys: ["krNpTrails"], Host: KrNpTrailsHost },
  { id: "useKrStreetTreesLayer", keys: ["krStreetTrees"], Host: KrStreetTreesHost },
  // 南韓第 6 波
  { id: "useKrTerritorialSeaLayer", keys: ["krTerritorialSea"], Host: KrTerritorialSeaHost },
  { id: "useKrUrbanParksLayer", keys: ["krUrbanParks"], Host: KrUrbanParksHost },
  { id: "useKrSportsFacilitiesLayer", keys: ["krSportsFacilities"], Host: KrSportsFacilitiesHost },
  { id: "useKrCemeteriesOsmLayer", keys: ["krCemeteriesOsm"], Host: KrCemeteriesOsmHost },
  { id: "useKrPopulationH3Layer", keys: ["krPopulationH3"], Host: KrPopulationH3Host },
  // 南韓第 7 波
  { id: "useKrSchoolsLayer", keys: ["krSchools"], Host: KrSchoolsHost },
  { id: "useKrSchoolDistrictsLayer", keys: ["krSchoolDistricts"], Host: KrSchoolDistrictsHost },
  { id: "useKrHospitalsPharmaciesLayer", keys: ["krHospitalsPharmacies"], Host: KrHospitalsPharmaciesHost },
  { id: "useKrFireStationsLayer", keys: ["krFireStations"], Host: KrFireStationsHost },
  { id: "useKrCivilDefenseSheltersLayer", keys: ["krCivilDefenseShelters"], Host: KrCivilDefenseSheltersHost },
  { id: "useKrPoliceBoxesLayer", keys: ["krPoliceBoxes"], Host: KrPoliceBoxesHost },
  // 南韓第 8 波
  { id: "useKrLibrariesLayer", keys: ["krLibraries"], Host: KrLibrariesHost },
  { id: "useKrMuseumsLayer", keys: ["krMuseums"], Host: KrMuseumsHost },
  { id: "useKrPerformancesLayer", keys: ["krPerformances"], Host: KrPerformancesHost },
  { id: "useKrFestivalsLayer", keys: ["krFestivals"], Host: KrFestivalsHost },
  { id: "useKrHeritageLayer", keys: ["krHeritage"], Host: KrHeritageHost },
  { id: "useKrLodgingLayer", keys: ["krLodging"], Host: KrLodgingHost },
  { id: "useKrSafeDeliveryBoxesLayer", keys: ["krSafeDeliveryBoxes"], Host: KrSafeDeliveryBoxesHost },
  { id: "useKrSeniorCentersLayer", keys: ["krSeniorCenters"], Host: KrSeniorCentersHost },
  { id: "useKrIndustrialComplexesLayer", keys: ["krIndustrialComplexes"], Host: KrIndustrialComplexesHost },
  { id: "useKrNoiseSitesLayer", keys: ["krNoiseSites"], Host: KrNoiseSitesHost },
  { id: "useKrClothingBinsLayer", keys: ["krClothingBins"], Host: KrClothingBinsHost },
  // 南韓第 10 波
  { id: "useKrAnimalHospitalsLayer", keys: ["krAnimalHospitals"], Host: KrAnimalHospitalsHost },
  { id: "useKrLocalCultureCentersLayer", keys: ["krLocalCultureCenters"], Host: KrLocalCultureCentersHost },
  { id: "useKrTraditionalTemplesLayer", keys: ["krTraditionalTemples"], Host: KrTraditionalTemplesHost },
  { id: "useKrProtectedTreesLayer", keys: ["krProtectedTrees"], Host: KrProtectedTreesHost },
  { id: "useKrFishingGroundsLayer", keys: ["krFishingGrounds"], Host: KrFishingGroundsHost },
  { id: "useKrBicycleParkingLayer", keys: ["krBicycleParking"], Host: KrBicycleParkingHost },
  { id: "useKrCivilDefenseWaterLayer", keys: ["krCivilDefenseWater"], Host: KrCivilDefenseWaterHost },
  { id: "useKrEmergencyBellsLayer", keys: ["krEmergencyBells"], Host: KrEmergencyBellsHost },
  { id: "useKrRuralExperienceVillagesLayer", keys: ["krRuralExperienceVillages"], Host: KrRuralExperienceVillagesHost },
  { id: "useKrSlaughterhousesLayer", keys: ["krSlaughterhouses"], Host: KrSlaughterhousesHost },
  { id: "useKrSeoulZoningLayer", keys: ["krSeoulZoning"], Host: KrSeoulZoningHost },
  // 南韓第 1 波（國土基礎：交通＋能源）
  { id: "useKrBusStopsLayer", keys: ["krBusStops"], Host: KrBusStopsHost },
  { id: "useKrRailStationsLayer", keys: ["krRailStations"], Host: KrRailStationsHost },
  { id: "useKrAirportsLayer", keys: ["krAirports"], Host: KrAirportsHost },
  { id: "useKrPortsLayer", keys: ["krPorts"], Host: KrPortsHost },
  { id: "useKrNationalRoadsLayer", keys: ["krNationalRoads"], Host: KrNationalRoadsHost },
  { id: "useKrRailLinesLayer", keys: ["krRailLines"], Host: KrRailLinesHost },
  { id: "useKrFuelStationsLayer", keys: ["krFuelStations"], Host: KrFuelStationsHost },
  { id: "useKrPowerPlantsLayer", keys: ["krPowerPlants"], Host: KrPowerPlantsHost },
  { id: "useKrRenewablesLayer", keys: ["krRenewables"], Host: KrRenewablesHost },
  { id: "useKrPowerLinesLayer", keys: ["krPowerLines"], Host: KrPowerLinesHost },
  { id: "useKrSubstationsLayer", keys: ["krSubstations"], Host: KrSubstationsHost },
  { id: "useKrPowerTowersLayer", keys: ["krPowerTowers"], Host: KrPowerTowersHost },
  { id: "useKrOilGasLayer", keys: ["krOilGas"], Host: KrOilGasHost },
  ],
  // <codemod:append KR_PACK_HOST_SLOTS>
};
