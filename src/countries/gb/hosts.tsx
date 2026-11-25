// 英國國家包：hosts.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LayerHookEntry } from "../../layers/layerHookRegistry";
import { GbAdminHost, GbAquacultureHost, GbArtsVenuesHost, GbBathingWatersHost, GbBridgesTunnelsHost, GbBrownfieldHost, GbCareHomesHost, GbCareServicesHost, GbCoastalErosionHost, GbCompaniesHost, GbCourtsHost, GbCulturalFacilitiesHost, GbEarthquakesHost, GbFireStationsHost, GbFloodDefencesHost, GbForestRecreationHost, GbFuelStationsHost, GbFuneralHost, GbGroundStabilityHost, GbHealthFacilitiesHost, GbHydroStationsHost, GbLandslideHost, GbLondonBikePointsHost, GbLondonChargingZonesHost, GbLondonJamCamsHost, GbLondonRailHost, GbMajorRoadsHost, GbManufacturingHost, GbMarineProtectedAreasHost, GbMaritimeLimitsHost, GbNoiseHost, GbOilGasFieldsHost, GbOpenAccessLandHost, GbOpenSpaceHost, GbPlacesOfWorshipHost, GbPlanningConstraintsHost, GbPollutionInventoryEnglandHost, GbPollutionInventoryHost, GbPowerLinesHost, GbPowerPlantsHost, GbProtectedAreasHost, GbPublicFacilitiesHost, GbRadiationHost, GbRadonHost, GbRailReplayHost, GbRecyclingCentresHost, GbRenewablesHost, GbRiversHost, GbRoadFacilitiesHost, GbSchoolsHost, GbSoilParentMaterialHost, GbSubstationsHost, GbSurplusLandHost, GbTerrainHost, GbTrafficCountsAadfHost, GbTrailsHost, GbTransportHubsHost, GbTreeProtectionHost, GbVisitorExperienceHost, GbWastePermitsHost, GbWoodlandHost } from "./ukHosts";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("GB", n)。 */
export const GB_PACK_HOST_SLOTS: Readonly<Record<number, readonly LayerHookEntry[]>> = {
  1: [
  // 英國（2026-10-29 第 0b 波）
  { id: "useGbAdminLayers", keys: ["gbAdminBoundaries", "gbSmallAreaBoundaries"], Host: GbAdminHost },
  ],
  2: [
  // 英國第 1 波（海域界線、建成區、綠地三層）
  { id: "useGbMaritimeLimitsLayer", keys: ["gbMaritimeLimits"], Host: GbMaritimeLimitsHost },
  { id: "useGbOpenSpaceLayers", keys: ["gbBuiltUpAreas", "gbGreenspace", "gbSportsFacilities", "gbGolfCourses", "gbCemeteries"], Host: GbOpenSpaceHost },
  // 英國第 3 波（河川、水文測站、防洪設施、海岸侵蝕、浴場）
  { id: "useGbRiversLayer", keys: ["gbRivers"], Host: GbRiversHost },
  { id: "useGbHydroStationsLayer", keys: ["gbHydroStations"], Host: GbHydroStationsHost },
  { id: "useGbFloodDefencesLayer", keys: ["gbFloodDefenceAssets"], Host: GbFloodDefencesHost },
  { id: "useGbCoastalErosionLayer", keys: ["gbCoastalErosionRisk"], Host: GbCoastalErosionHost },
  { id: "useGbBathingWatersLayer", keys: ["gbBathingWaters"], Host: GbBathingWatersHost },
  // 英國第 4 波（交通樞紐＋站客流、倫敦軌道線＋車站、單車站、攝影機、收費區）
  { id: "useGbTransportHubsLayer", keys: ["gbTransportHubs", "gbStationUsage"], Host: GbTransportHubsHost },
  { id: "useGbLondonRailLayers", keys: ["gbLondonRailLines", "gbLondonStations"], Host: GbLondonRailHost },
  { id: "useGbLondonBikePointsLayer", keys: ["gbLondonBikePoints"], Host: GbLondonBikePointsHost },
  { id: "useGbRailReplayLayer", keys: ["gbRailReplay"], Host: GbRailReplayHost },
  { id: "useGbLondonJamCamsLayer", keys: ["gbLondonJamCams"], Host: GbLondonJamCamsHost },
  { id: "useGbLondonChargingZonesLayer", keys: ["gbLondonChargingZones"], Host: GbLondonChargingZonesHost },
  // 英國第 12 波（公司登記、製造業、殯葬、養殖、土壤母質）
  { id: "useGbCompaniesLayer", keys: ["gbCompanies"], Host: GbCompaniesHost },
  { id: "useGbManufacturingLayer", keys: ["gbManufacturing"], Host: GbManufacturingHost },
  { id: "useGbFuneralLayer", keys: ["gbFuneral"], Host: GbFuneralHost },
  { id: "useGbAquacultureLayer", keys: ["gbAquaculture"], Host: GbAquacultureHost },
  { id: "useGbSoilParentMaterialLayer", keys: ["gbSoilParentMaterial"], Host: GbSoilParentMaterialHost },
  // 英國第 11 波（規劃限制區、棕地、回收點、廢棄物許可、污染排放、噪音）
  { id: "useGbPlanningConstraintsLayer", keys: ["gbPlanningConstraints"], Host: GbPlanningConstraintsHost },
  { id: "useGbBrownfieldLayer", keys: ["gbBrownfield"], Host: GbBrownfieldHost },
  { id: "useGbRecyclingCentresLayer", keys: ["gbRecyclingCentres"], Host: GbRecyclingCentresHost },
  { id: "useGbWastePermitsLayer", keys: ["gbWastePermits"], Host: GbWastePermitsHost },
  { id: "useGbPollutionInventoryLayer", keys: ["gbPollutionInventory"], Host: GbPollutionInventoryHost },
  { id: "useGbEaPollutionInventoryLayer", keys: ["gbPollutionInventoryEngland"], Host: GbPollutionInventoryEnglandHost },
  { id: "useGbNoiseLayer", keys: ["gbNoise"], Host: GbNoiseHost },
  // 英國第 10 波（主要路網、AADF 交通計數點）
  { id: "useGbMajorRoadsLayer", keys: ["gbMajorRoads"], Host: GbMajorRoadsHost },
  { id: "useGbTrafficCountsAadfLayer", keys: ["gbTrafficCountsAadf"], Host: GbTrafficCountsAadfHost },
  // 英國第 13 波 OSM（橋梁與隧道、道路設施、公共設施、宗教場所）
  { id: "useGbBridgesTunnelsLayer", keys: ["gbBridgesTunnels"], Host: GbBridgesTunnelsHost },
  { id: "useGbRoadFacilitiesLayer", keys: ["gbRoadFacilities"], Host: GbRoadFacilitiesHost },
  { id: "useGbPublicFacilitiesLayer", keys: ["gbPublicFacilities"], Host: GbPublicFacilitiesHost },
  { id: "useGbPlacesOfWorshipLayer", keys: ["gbPlacesOfWorship"], Host: GbPlacesOfWorshipHost },
  // 英國第 5 波（保護區、海洋保護區、林地、森林遊憩、步道、開放進入地、樹木保護）
  { id: "useGbProtectedAreasLayer", keys: ["gbProtectedAreas"], Host: GbProtectedAreasHost },
  { id: "useGbMarineProtectedAreasLayer", keys: ["gbMarineProtectedAreas"], Host: GbMarineProtectedAreasHost },
  { id: "useGbWoodlandLayer", keys: ["gbWoodland"], Host: GbWoodlandHost },
  { id: "useGbForestRecreationLayer", keys: ["gbForestRecreation"], Host: GbForestRecreationHost },
  { id: "useGbTrailsLayer", keys: ["gbTrails"], Host: GbTrailsHost },
  { id: "useGbOpenAccessLandLayer", keys: ["gbOpenAccessLand"], Host: GbOpenAccessLandHost },
  { id: "useGbTreeProtectionLayer", keys: ["gbTreeProtection"], Host: GbTreeProtectionHost },
  // 英國第 6 波（電廠、再生能源、電網線、變電所、加油站、離岸油氣田）
  { id: "useGbPowerPlantsLayer", keys: ["gbPowerPlants"], Host: GbPowerPlantsHost },
  { id: "useGbRenewablesLayer", keys: ["gbRenewables"], Host: GbRenewablesHost },
  { id: "useGbPowerLinesLayer", keys: ["gbPowerLines"], Host: GbPowerLinesHost },
  { id: "useGbSubstationsLayer", keys: ["gbSubstations"], Host: GbSubstationsHost },
  { id: "useGbFuelStationsLayer", keys: ["gbFuelStations"], Host: GbFuelStationsHost },
  { id: "useGbOilGasFieldsLayer", keys: ["gbOilGasFields"], Host: GbOilGasFieldsHost },
  // 英國第 7 波（學校、醫療、照護之家、長照服務、消防站、法院）
  { id: "useGbSchoolsLayer", keys: ["gbSchools"], Host: GbSchoolsHost },
  { id: "useGbHealthFacilitiesLayer", keys: ["gbHealthFacilities"], Host: GbHealthFacilitiesHost },
  { id: "useGbCareHomesLayer", keys: ["gbCareHomes"], Host: GbCareHomesHost },
  { id: "useGbCareServicesLayer", keys: ["gbCareServices"], Host: GbCareServicesHost },
  { id: "useGbFireStationsLayer", keys: ["gbFireStations"], Host: GbFireStationsHost },
  { id: "useGbCourtsLayer", keys: ["gbCourts"], Host: GbCourtsHost },
  // 英國第 8 波（文化設施、藝文場館、觀光體驗）
  { id: "useGbCulturalFacilitiesLayer", keys: ["gbCulturalFacilities"], Host: GbCulturalFacilitiesHost },
  { id: "useGbArtsVenuesLayer", keys: ["gbArtsVenues"], Host: GbArtsVenuesHost },
  { id: "useGbVisitorExperienceLayer", keys: ["gbVisitorExperience"], Host: GbVisitorExperienceHost },
  // 英國 C003 地形（raster 兩層）、C028 公有地標售
  { id: "useGbTerrainLayers", keys: ["gbTerrainHillshade", "gbTerrainRelief"], Host: GbTerrainHost },
  { id: "useGbSurplusLandLayer", keys: ["gbSurplusLand"], Host: GbSurplusLandHost },
  // 英國第 9 波災害地質
  { id: "useGbGroundStabilityLayer", keys: ["gbGroundStability"], Host: GbGroundStabilityHost },
  { id: "useGbLandslideLayer", keys: ["gbLandslide"], Host: GbLandslideHost },
  { id: "useGbRadonLayer", keys: ["gbRadon"], Host: GbRadonHost },
  { id: "useGbRadiationLayer", keys: ["gbRadiation"], Host: GbRadiationHost },
  { id: "useGbEarthquakesLayer", keys: ["gbEarthquakes"], Host: GbEarthquakesHost },
  ],
  // <codemod:append GB_PACK_HOST_SLOTS>
};
