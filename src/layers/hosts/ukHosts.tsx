// 英國 Layer Host（2026-10-29 第 0b 波起）。clone hosts/japanHosts.tsx 的 JpAdminHost 慣例。

import { useGbAdminLayers } from "../../hooks/useGbAdminLayers";
import { useGbMaritimeLimitsLayer } from "../../hooks/useGbMaritimeLimitsLayer";
import { useGbOpenSpaceLayers } from "../../hooks/useGbOpenSpaceLayers";
import { useGbBathingWatersLayer, useGbCoastalErosionLayer, useGbFloodDefencesLayer, useGbHydroStationsLayer, useGbRiversLayer } from "../../hooks/useGbWaterLayers";
import { useGbLondonBikePointsLayer, useGbLondonChargingZonesLayer, useGbLondonJamCamsLayer, useGbLondonRailLinesLayer, useGbLondonStationsLayer, useGbStationUsageLayer, useGbTransportHubsLayer } from "../../hooks/useGbTransportLayers";
import { useGbArtsVenuesLayer, useGbCulturalFacilitiesLayer, useGbVisitorExperienceLayer } from "../../hooks/useGbCultureLayers";
import { useGbSurplusLandLayer, useGbTerrainLayer } from "../../hooks/useGbLandLayers";
import { useGbEarthquakesLayer, useGbGroundStabilityLayer, useGbLandslideLayer, useGbRadiationLayer, useGbRadonLayer } from "../../hooks/useGbHazardLayers";
import { useGbCareHomesLayer, useGbCareServicesLayer, useGbCourtsLayer, useGbFireStationsLayer, useGbHealthFacilitiesLayer, useGbSchoolsLayer } from "../../hooks/useGbCivicLayers";
import { useGbFuelStationsLayer, useGbOilGasFieldsLayer, useGbPowerLinesLayer, useGbPowerPlantsLayer, useGbRenewablesLayer, useGbSubstationsLayer } from "../../hooks/useGbEnergyLayers";
import { useGbForestRecreationLayer, useGbMarineProtectedAreasLayer, useGbOpenAccessLandLayer, useGbProtectedAreasLayer, useGbTrailsLayer, useGbTreeProtectionLayer, useGbWoodlandLayer } from "../../hooks/useGbNatureLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 英國行政邊界：LAD ＋ 四地統計小區（各自獨立的 PMTiles polygon 圖層）。 */
export const GbAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbAdminLayers");
  const lad = useKeyOverlayParams("gbAdminBoundaries");
  const small = useKeyOverlayParams("gbSmallAreaBoundaries");
  useGbAdminLayers(
    deps.mapRef,
    { visible: deps.layerVisibility.gbAdminBoundaries, opacity: lad.gbAdminBoundariesOpacity ?? 0.85 },
    {
      visible: deps.layerVisibility.gbSmallAreaBoundaries,
      opacity: small.gbSmallAreaBoundariesOpacity ?? 0.85,
      niLevel: small.gbSmallAreaBoundariesNiLevelIdx === 1 ? 1 : 0,
    },
    deps.isDarkTheme,
  );
  return null;
};

/** 英國海域界線（第 1 波 C002，UKHO）：PMTiles line，依界線類型分色。 */
export const GbMaritimeLimitsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbMaritimeLimitsLayer");
  const p = useKeyOverlayParams("gbMaritimeLimits");
  useGbMaritimeLimitsLayer(deps.mapRef, deps.layerVisibility.gbMaritimeLimits, p.gbMaritimeLimitsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

/** 英國建成區＋綠地三層（公園、運動場、墓園；後三者共用 gb_greenspace.pmtiles）。 */
export const GbOpenSpaceHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbOpenSpaceLayers");
  const builtUp = useKeyOverlayParams("gbBuiltUpAreas");
  const park = useKeyOverlayParams("gbGreenspace");
  const sports = useKeyOverlayParams("gbSportsFacilities");
  const burial = useKeyOverlayParams("gbCemeteries");
  useGbOpenSpaceLayers(deps.mapRef, {
    gbBuiltUpAreas: { visible: deps.layerVisibility.gbBuiltUpAreas, opacity: builtUp.gbBuiltUpAreasOpacity ?? 0.7 },
    gbGreenspace: { visible: deps.layerVisibility.gbGreenspace, opacity: park.gbGreenspaceOpacity ?? 0.7 },
    gbSportsFacilities: { visible: deps.layerVisibility.gbSportsFacilities, opacity: sports.gbSportsFacilitiesOpacity ?? 0.7 },
    gbCemeteries: { visible: deps.layerVisibility.gbCemeteries, opacity: burial.gbCemeteriesOpacity ?? 0.7 },
  });
  return null;
};

/** 英國第 3 波：河川、水文測站、防洪設施、海岸侵蝕、浴場（各自一個 PMTiles source）。 */
export const GbRiversHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbRiversLayer");
  const p = useKeyOverlayParams("gbRivers");
  useGbRiversLayer(deps.mapRef, deps.layerVisibility.gbRivers, p.gbRiversOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const GbHydroStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbHydroStationsLayer");
  const p = useKeyOverlayParams("gbHydroStations");
  useGbHydroStationsLayer(deps.mapRef, deps.layerVisibility.gbHydroStations, p.gbHydroStationsOpacity ?? 0.8, p.gbHydroStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbFloodDefencesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbFloodDefencesLayer");
  const p = useKeyOverlayParams("gbFloodDefenceAssets");
  useGbFloodDefencesLayer(deps.mapRef, deps.layerVisibility.gbFloodDefenceAssets, p.gbFloodDefenceAssetsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const GbCoastalErosionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbCoastalErosionLayer");
  const p = useKeyOverlayParams("gbCoastalErosionRisk");
  useGbCoastalErosionLayer(deps.mapRef, deps.layerVisibility.gbCoastalErosionRisk, p.gbCoastalErosionRiskOpacity ?? 0.7, p.gbCoastalErosionRiskPeriodIdx ?? 0, deps.isDarkTheme);
  return null;
};

export const GbBathingWatersHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbBathingWatersLayer");
  const p = useKeyOverlayParams("gbBathingWaters");
  useGbBathingWatersLayer(deps.mapRef, deps.layerVisibility.gbBathingWaters, p.gbBathingWatersOpacity ?? 0.85, p.gbBathingWatersScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國第 4 波：交通樞紐＋站客流（共用 gb_transport_hubs）、倫敦軌道線＋車站（共用 gb_london_rail）、單車站、攝影機、收費區。 */
export const GbTransportHubsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbTransportHubsLayer");
  const hubs = useKeyOverlayParams("gbTransportHubs");
  const usage = useKeyOverlayParams("gbStationUsage");
  useGbTransportHubsLayer(deps.mapRef, deps.layerVisibility.gbTransportHubs, hubs.gbTransportHubsOpacity ?? 0.8, hubs.gbTransportHubsScale ?? 1, deps.isDarkTheme);
  useGbStationUsageLayer(deps.mapRef, deps.layerVisibility.gbStationUsage, usage.gbStationUsageOpacity ?? 0.8, usage.gbStationUsageScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbLondonRailHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbLondonRailLayers");
  const lines = useKeyOverlayParams("gbLondonRailLines");
  const stations = useKeyOverlayParams("gbLondonStations");
  useGbLondonRailLinesLayer(deps.mapRef, deps.layerVisibility.gbLondonRailLines, lines.gbLondonRailLinesOpacity ?? 0.85, deps.isDarkTheme);
  useGbLondonStationsLayer(deps.mapRef, deps.layerVisibility.gbLondonStations, stations.gbLondonStationsOpacity ?? 0.85, stations.gbLondonStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbLondonBikePointsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbLondonBikePointsLayer");
  const p = useKeyOverlayParams("gbLondonBikePoints");
  useGbLondonBikePointsLayer(deps.mapRef, deps.layerVisibility.gbLondonBikePoints, p.gbLondonBikePointsOpacity ?? 0.85, p.gbLondonBikePointsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbLondonJamCamsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbLondonJamCamsLayer");
  const p = useKeyOverlayParams("gbLondonJamCams");
  useGbLondonJamCamsLayer(deps.mapRef, deps.layerVisibility.gbLondonJamCams, p.gbLondonJamCamsOpacity ?? 0.85, p.gbLondonJamCamsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbLondonChargingZonesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbLondonChargingZonesLayer");
  const p = useKeyOverlayParams("gbLondonChargingZones");
  useGbLondonChargingZonesLayer(deps.mapRef, deps.layerVisibility.gbLondonChargingZones, p.gbLondonChargingZonesOpacity ?? 0.7, deps.isDarkTheme);
  return null;
};

/** 英國第 5 波：保護區、海洋保護區、林地、森林遊憩、步道、開放進入地、樹木保護（各自一個 PMTiles）。 */
export const GbProtectedAreasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbProtectedAreasLayer");
  const p = useKeyOverlayParams("gbProtectedAreas");
  useGbProtectedAreasLayer(deps.mapRef, deps.layerVisibility.gbProtectedAreas, p.gbProtectedAreasOpacity ?? 0.45, p.gbProtectedAreasGroupIdx ?? 0, deps.isDarkTheme);
  return null;
};

export const GbMarineProtectedAreasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbMarineProtectedAreasLayer");
  const p = useKeyOverlayParams("gbMarineProtectedAreas");
  useGbMarineProtectedAreasLayer(deps.mapRef, deps.layerVisibility.gbMarineProtectedAreas, p.gbMarineProtectedAreasOpacity ?? 0.5, deps.isDarkTheme);
  return null;
};

export const GbWoodlandHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbWoodlandLayer");
  const p = useKeyOverlayParams("gbWoodland");
  useGbWoodlandLayer(deps.mapRef, deps.layerVisibility.gbWoodland, p.gbWoodlandOpacity ?? 0.7, deps.isDarkTheme);
  return null;
};

export const GbForestRecreationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbForestRecreationLayer");
  const p = useKeyOverlayParams("gbForestRecreation");
  useGbForestRecreationLayer(deps.mapRef, deps.layerVisibility.gbForestRecreation, p.gbForestRecreationOpacity ?? 0.75, p.gbForestRecreationScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbTrailsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbTrailsLayer");
  const p = useKeyOverlayParams("gbTrails");
  useGbTrailsLayer(deps.mapRef, deps.layerVisibility.gbTrails, p.gbTrailsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const GbOpenAccessLandHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbOpenAccessLandLayer");
  const p = useKeyOverlayParams("gbOpenAccessLand");
  useGbOpenAccessLandLayer(deps.mapRef, deps.layerVisibility.gbOpenAccessLand, p.gbOpenAccessLandOpacity ?? 0.6, deps.isDarkTheme);
  return null;
};

export const GbTreeProtectionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbTreeProtectionLayer");
  const p = useKeyOverlayParams("gbTreeProtection");
  useGbTreeProtectionLayer(deps.mapRef, deps.layerVisibility.gbTreeProtection, p.gbTreeProtectionOpacity ?? 0.7, p.gbTreeProtectionScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國第 6 波：電廠、再生能源、電網線、變電所（後兩者共用 gb_power_grid.pmtiles）、加油站、離岸油氣田。 */
export const GbPowerPlantsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbPowerPlantsLayer");
  const p = useKeyOverlayParams("gbPowerPlants");
  useGbPowerPlantsLayer(deps.mapRef, deps.layerVisibility.gbPowerPlants, p.gbPowerPlantsOpacity ?? 0.8, p.gbPowerPlantsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbRenewablesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbRenewablesLayer");
  const p = useKeyOverlayParams("gbRenewables");
  useGbRenewablesLayer(deps.mapRef, deps.layerVisibility.gbRenewables, p.gbRenewablesOpacity ?? 0.75, p.gbRenewablesScale ?? 1, p.gbRenewablesStatusIdx ?? 0, deps.isDarkTheme);
  return null;
};

export const GbPowerLinesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbPowerLinesLayer");
  const p = useKeyOverlayParams("gbPowerLines");
  useGbPowerLinesLayer(deps.mapRef, deps.layerVisibility.gbPowerLines, p.gbPowerLinesOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const GbSubstationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbSubstationsLayer");
  const p = useKeyOverlayParams("gbSubstations");
  useGbSubstationsLayer(deps.mapRef, deps.layerVisibility.gbSubstations, p.gbSubstationsOpacity ?? 0.75, p.gbSubstationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbFuelStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbFuelStationsLayer");
  const p = useKeyOverlayParams("gbFuelStations");
  useGbFuelStationsLayer(deps.mapRef, deps.layerVisibility.gbFuelStations, p.gbFuelStationsOpacity ?? 0.8, p.gbFuelStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbOilGasFieldsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbOilGasFieldsLayer");
  const p = useKeyOverlayParams("gbOilGasFields");
  useGbOilGasFieldsLayer(deps.mapRef, deps.layerVisibility.gbOilGasFields, p.gbOilGasFieldsOpacity ?? 0.6, deps.isDarkTheme);
  return null;
};

/** 英國第 7 波：學校、醫療、照護之家、長照服務（後兩者共用 gb_care_services.pmtiles）、消防站、法院。 */
export const GbSchoolsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbSchoolsLayer");
  const p = useKeyOverlayParams("gbSchools");
  useGbSchoolsLayer(deps.mapRef, deps.layerVisibility.gbSchools, p.gbSchoolsOpacity ?? 0.8, p.gbSchoolsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbHealthFacilitiesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbHealthFacilitiesLayer");
  const p = useKeyOverlayParams("gbHealthFacilities");
  useGbHealthFacilitiesLayer(deps.mapRef, deps.layerVisibility.gbHealthFacilities, p.gbHealthFacilitiesOpacity ?? 0.8, p.gbHealthFacilitiesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbCareHomesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbCareHomesLayer");
  const p = useKeyOverlayParams("gbCareHomes");
  useGbCareHomesLayer(deps.mapRef, deps.layerVisibility.gbCareHomes, p.gbCareHomesOpacity ?? 0.8, p.gbCareHomesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbCareServicesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbCareServicesLayer");
  const p = useKeyOverlayParams("gbCareServices");
  useGbCareServicesLayer(deps.mapRef, deps.layerVisibility.gbCareServices, p.gbCareServicesOpacity ?? 0.8, p.gbCareServicesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbFireStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbFireStationsLayer");
  const p = useKeyOverlayParams("gbFireStations");
  useGbFireStationsLayer(deps.mapRef, deps.layerVisibility.gbFireStations, p.gbFireStationsOpacity ?? 0.85, p.gbFireStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbCourtsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbCourtsLayer");
  const p = useKeyOverlayParams("gbCourts");
  useGbCourtsLayer(deps.mapRef, deps.layerVisibility.gbCourts, p.gbCourtsOpacity ?? 0.85, p.gbCourtsScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國第 8 波：文化設施、藝文場館、觀光體驗。 */
export const GbCulturalFacilitiesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbCulturalFacilitiesLayer");
  const p = useKeyOverlayParams("gbCulturalFacilities");
  useGbCulturalFacilitiesLayer(deps.mapRef, deps.layerVisibility.gbCulturalFacilities, p.gbCulturalFacilitiesOpacity ?? 0.8, p.gbCulturalFacilitiesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbArtsVenuesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbArtsVenuesLayer");
  const p = useKeyOverlayParams("gbArtsVenues");
  useGbArtsVenuesLayer(deps.mapRef, deps.layerVisibility.gbArtsVenues, p.gbArtsVenuesOpacity ?? 0.8, p.gbArtsVenuesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbVisitorExperienceHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbVisitorExperienceLayer");
  const p = useKeyOverlayParams("gbVisitorExperience");
  useGbVisitorExperienceLayer(deps.mapRef, deps.layerVisibility.gbVisitorExperience, p.gbVisitorExperienceOpacity ?? 0.8, p.gbVisitorExperienceScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國 C003 地形兩層（raster，只有透明度）：先掛色別標高、再掛山體陰影（陰影疊在上面）。 */
export const GbTerrainHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbTerrainLayers");
  const h = useKeyOverlayParams("gbTerrainHillshade");
  const r = useKeyOverlayParams("gbTerrainRelief");
  useGbTerrainLayer(deps.mapRef, "gbTerrainRelief", deps.layerVisibility.gbTerrainRelief, r.gbTerrainReliefOpacity ?? 0.7);
  useGbTerrainLayer(deps.mapRef, "gbTerrainHillshade", deps.layerVisibility.gbTerrainHillshade, h.gbTerrainHillshadeOpacity ?? 0.5);
  return null;
};

/** 英國 C028 公有地標售。 */
export const GbSurplusLandHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbSurplusLandLayer");
  const p = useKeyOverlayParams("gbSurplusLand");
  useGbSurplusLandLayer(deps.mapRef, deps.layerVisibility.gbSurplusLand, p.gbSurplusLandOpacity ?? 0.9, p.gbSurplusLandScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國第 9 波：GeoSure 地質災害易發性（災害選單，一次一種）。 */
export const GbGroundStabilityHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbGroundStabilityLayer");
  const p = useKeyOverlayParams("gbGroundStability");
  useGbGroundStabilityLayer(deps.mapRef, deps.layerVisibility.gbGroundStability, p.gbGroundStabilityOpacity ?? 0.55, p.gbGroundStabilityHazardIdx ?? 0, deps.isDarkTheme);
  return null;
};

/** 英國第 9 波：山崩紀錄點。 */
export const GbLandslideHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbLandslideLayer");
  const p = useKeyOverlayParams("gbLandslide");
  useGbLandslideLayer(deps.mapRef, deps.layerVisibility.gbLandslide, p.gbLandslideOpacity ?? 0.7, p.gbLandslideScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國第 9 波：氡氣指示圖（1 km 網格，色階隨底圖）。 */
export const GbRadonHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbRadonLayer");
  const p = useKeyOverlayParams("gbRadon");
  useGbRadonLayer(deps.mapRef, deps.layerVisibility.gbRadon, p.gbRadonOpacity ?? 0.7, deps.isDarkTheme);
  return null;
};

/** 英國第 9 波：環境加馬劑量率固定站。 */
export const GbRadiationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbRadiationLayer");
  const p = useKeyOverlayParams("gbRadiation");
  useGbRadiationLayer(deps.mapRef, deps.layerVisibility.gbRadiation, p.gbRadiationOpacity ?? 0.9, p.gbRadiationScale ?? 1, deps.isDarkTheme);
  return null;
};

/** 英國第 9 波：地震目錄（儀器記錄實心、歷史地震空心）。 */
export const GbEarthquakesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbEarthquakesLayer");
  const p = useKeyOverlayParams("gbEarthquakes");
  useGbEarthquakesLayer(deps.mapRef, deps.layerVisibility.gbEarthquakes, p.gbEarthquakesOpacity ?? 0.8, p.gbEarthquakesScale ?? 1, deps.isDarkTheme);
  return null;
};
