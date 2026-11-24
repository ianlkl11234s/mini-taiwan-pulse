// 日本國家包：hosts.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LayerHookEntry } from "../../layers/layerHookRegistry";
import { JpAdminHost, JpAirportsHost, JpBusStopsHost, JpEvacuationSitesHost, JpExpresswaysHost, JpGsiTerrainHost, JpInlandFloodAreasHost, JpLandslideWarningAreasHost, JpMajorRoadsHost, JpMedicalHost, JpMunicipalRoadsHost, JpNationalForestsHost, JpPoliceFacilitiesHost, JpPopulationMeshHost, JpPublicOfficesHost, JpRailwaysHost, JpSchoolsHost, JpStationsHost, JpTourismHost, JpWaterHost, JpWelfareFacilitiesHost, JpZoningUseDistrictsHost } from "./japanHosts";
import { GibsSnowCoverHost, JmaAmedasHost, JmaAnaRainDaysHost, JmaAnaRiskInundHoursHost, JmaAnaRiskLandHoursHost, JmaAnaSnowDaysHost, JmaAnaSnowFirstHost, JmaHimawariHost, JmaQuakesHost, JmaRadarHost, JmaRasrfHost, JmaRiskFloodHost, JmaRiskInundHost, JmaRiskLandHost, JmaSeaIceHost, JmaSnowDepthHost, JmaSstHost, JmaUvIndexHost, JmaVolcanoesHost, JmaWarningsHost } from "./jmaHosts";
import { JmaAutumnLeavesHost, JmaLightningHost, JmaRainySeasonHost, JmaSakuraHost, JmaSnowcapHost, JmaWbgtHost } from "./jmaPointHosts";
import { JpReligionHost } from "./jpReligionHost";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("JP", n)。 */
export const JP_PACK_HOST_SLOTS: Readonly<Record<number, readonly LayerHookEntry[]>> = {
  1: [
  { id: "useJpWaterLayers", keys: ["jpWaterDams", "jpWaterLakes", "jpWaterRivers", "jpWaterSupplyFacilities", "jpWaterSupplyAreas", "jpWaterSewerFacilities", "jpWaterGroundwaterSites", "jpWaterNilimDams", "jpWaterAgriculturalPonds", "jpWaterFloodHazard", "jpWaterLocalFacilities", "jpWaterQualityStations", "jpWaterLevelStations"], Host: JpWaterHost },
  { id: "useJpMedicalLayers", keys: [
    "jpMedicalHospitals", "jpMedicalClinics", "jpMedicalDental", "jpMedicalMaternity", "jpMedicalPharmacies",
    "jpCarePlanning", "jpCareHomeVisit", "jpCareDayServices", "jpCareResidential", "jpCareCombined", "jpCareEquipment",
    "jpMedicalAreasPrimary", "jpMedicalAreasSecondary", "jpMedicalAreasTertiary",
  ], Host: JpMedicalHost },
  ],
  2: [
  {
    id: "useJpReligionLayers",
    keys: ["jpReligionGsi", "jpReligionOsm", "jpReligionWikidata"],
    Host: JpReligionHost,
  },
  {
    id: "useJpAdminLayers",
    keys: ["jpAdminPrefecture", "jpAdminBoundaries"],
    Host: JpAdminHost,
  },
  { id: "useJpStationsLayer", keys: ["jpStations"], Host: JpStationsHost },
  { id: "useJpAirportsLayer", keys: ["jpAirports"], Host: JpAirportsHost },
  { id: "useJpRailwaysLayer", keys: ["jpRailways"], Host: JpRailwaysHost },
  { id: "useJpPoliceFacilitiesLayer", keys: ["jpPoliceFacilities"], Host: JpPoliceFacilitiesHost },
  { id: "useJpSchoolsLayer", keys: ["jpSchools"], Host: JpSchoolsHost },
  { id: "useJpEvacuationSitesLayer", keys: ["jpEvacuationSites"], Host: JpEvacuationSitesHost },
  { id: "useJpPublicOfficesLayer", keys: ["jpPublicOffices"], Host: JpPublicOfficesHost },
  { id: "useJpBusStopsLayer", keys: ["jpBusStops"], Host: JpBusStopsHost },
  { id: "useJpLandslideWarningAreasLayer", keys: ["jpLandslideWarningAreas"], Host: JpLandslideWarningAreasHost },
  { id: "useJpInlandFloodAreasLayer", keys: ["jpInlandFloodAreas"], Host: JpInlandFloodAreasHost },
  { id: "useJpZoningUseDistrictsLayer", keys: ["jpZoningUseDistricts"], Host: JpZoningUseDistrictsHost },
  { id: "useJpNationalForestsLayer", keys: ["jpNationalForests"], Host: JpNationalForestsHost },
  { id: "useJpWelfareFacilitiesLayer", keys: ["jpWelfareDisability", "jpWelfareChild"], Host: JpWelfareFacilitiesHost },
  { id: "useJpMajorRoadsLayer", keys: ["jpMajorRoads"], Host: JpMajorRoadsHost },
  { id: "useJpMunicipalRoadsLayer", keys: ["jpMunicipalRoads"], Host: JpMunicipalRoadsHost },
  { id: "useJpExpresswaysLayer", keys: ["jpExpressways"], Host: JpExpresswaysHost },
  ],
  3: [
  { id: "useJpGsiTerrainLayers", keys: ["jpGsiHillshade", "jpGsiRelief"], Host: JpGsiTerrainHost },
  { id: "useJpPopulationMeshLayer", keys: ["jpPopulationMesh1km"], Host: JpPopulationMeshHost },
  ],
  4: [
  // 日本氣象廳即時 4 層（gis-platform migration 435）：當下快照
  { id: "useJmaLiveLayer:jmaAmedas", keys: ["jmaAmedas"], Host: JmaAmedasHost },
  { id: "useJmaWarningsLayer", keys: ["jmaWarnings"], Host: JmaWarningsHost },
  { id: "useJmaLiveLayer:jmaQuakes", keys: ["jmaQuakes"], Host: JmaQuakesHost },
  { id: "useJmaLiveLayer:jmaVolcanoes", keys: ["jmaVolcanoes"], Host: JmaVolcanoesHost },
  { id: "useLightningLayer:jma", keys: ["jmaLightning"], Host: JmaLightningHost },
  { id: "useJmaLiveLayer:jmaWbgt", keys: ["jmaWbgt"], Host: JmaWbgtHost },
  { id: "useJmaLiveLayer:jmaSnowcap", keys: ["jmaSnowcap"], Host: JmaSnowcapHost },
  { id: "useJmaLiveLayer:jmaAutumnLeaves", keys: ["jmaAutumnLeaves"], Host: JmaAutumnLeavesHost },
  { id: "useJmaLiveLayer:jmaSakura", keys: ["jmaSakura"], Host: JmaSakuraHost },
  { id: "useJmaRainySeasonLayer", keys: ["jmaRainySeason"], Host: JmaRainySeasonHost },
  { id: "useJmaImageryLayer:jmaSnowDepth", keys: ["jmaSnowDepth"], Host: JmaSnowDepthHost },
  { id: "useJmaImageryLayer:jmaRadar", keys: ["jmaRadar"], Host: JmaRadarHost },
  { id: "useJmaImageryLayer:jmaRasrf", keys: ["jmaRasrf"], Host: JmaRasrfHost },
  { id: "useJmaImageryLayer:jmaRiskLand", keys: ["jmaRiskLand"], Host: JmaRiskLandHost },
  { id: "useJmaImageryLayer:jmaRiskInund", keys: ["jmaRiskInund"], Host: JmaRiskInundHost },
  { id: "useJmaImageryLayer:jmaUvIndex", keys: ["jmaUvIndex"], Host: JmaUvIndexHost },
  { id: "useJmaImageryLayer:jmaSst", keys: ["jmaSst"], Host: JmaSstHost },
  { id: "useJmaImageryLayer:jmaSeaIce", keys: ["jmaSeaIce"], Host: JmaSeaIceHost },
  { id: "useJmaImageryLayer:jmaHimawari", keys: ["jmaHimawari"], Host: JmaHimawariHost },
  { id: "useJmaImageryLayer:jmaAnaSnowFirst", keys: ["jmaAnaSnowFirst"], Host: JmaAnaSnowFirstHost },
  { id: "useJmaImageryLayer:jmaAnaSnowDays", keys: ["jmaAnaSnowDays"], Host: JmaAnaSnowDaysHost },
  { id: "useJmaImageryLayer:jmaAnaRainDays", keys: ["jmaAnaRainDays"], Host: JmaAnaRainDaysHost },
  { id: "useJmaImageryLayer:jmaAnaRiskLandHours", keys: ["jmaAnaRiskLandHours"], Host: JmaAnaRiskLandHoursHost },
  { id: "useJmaImageryLayer:jmaAnaRiskInundHours", keys: ["jmaAnaRiskInundHours"], Host: JmaAnaRiskInundHoursHost },
  { id: "useGibsSnowCoverLayer", keys: ["gibsSnowCover"], Host: GibsSnowCoverHost },
  { id: "useJmaRiskFloodLayer", keys: ["jmaRiskFlood"], Host: JmaRiskFloodHost },
  {
    id: "useJpTourismLayers",
    keys: [
      "jpAccommodationCanonical", "jpAccommodationJta", "jpAccommodationLocal", "jpAccommodationOsm",
      "jpNaturalParksNational", "jpNaturalParksQuasiNational", "jpNaturalParksPrefectural",
      "jpNatureConservationArea", "jpPrimitiveNatureEnvironmentArea", "jpNatureConservationSpecialDistrict",
      "jpWildlifeProtectionNational", "jpWildlifeSpecialProtectionDistrict", "jpWildlifeSpecialProtectionDesignatedArea",
      "jpWorldHeritageCultural", "jpWorldHeritageNatural", "jpWorldNaturalHeritageHistorical",
      "jpRamsarSites", "jpMarineEbsaCoastal",
    ],
    Host: JpTourismHost,
  },
  ],
  // <codemod:append JP_PACK_HOST_SLOTS>
};
