// 愛爾蘭 Layer Host（2026-11-07 第 0 波起）。比照 hosts/canadaHosts.tsx：一個 key 一個 Host。

import { useMemo } from "react";
import { useIeAdminLayers } from "../../hooks/useIeAdminLayers";
import { useIeBathymetryLayer } from "../../hooks/useIeBathymetryLayer";
import { useKrDataLayer } from "../../hooks/useKrDataLayers";
import { useIeCoillteForestRoadsLayer, useIeCoillteLayer } from "../../hooks/useIeCoillteLayers";
import { IE_SPEC_BY_KEY, asKrSpec, ieFloodScenarioFileAt, ieNoiseMetricFileAt } from "../../data/ieDataLayers";
import type { IeDataKey } from "../../data/ieDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：地方政府、選舉分區、統計小區三層級（同一個 PMTiles，select 切換）。 */
export const IeAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeAdminLayers");
  const p = useKeyOverlayParams("ieAdminBoundaries");
  const level = p.ieAdminBoundariesLevelIdx;
  useIeAdminLayers(deps.mapRef, deps.layerVisibility.ieAdminBoundaries, p.ieAdminBoundariesOpacity ?? 0.85, level === 1 || level === 2 ? level : 0, deps.isDarkTheme);
  return null;
};

/** 第 1 波規格驅動資料層：共用南韓 `useKrDataLayer`（規格見 data/ieDataLayers.ts）。 */
function makeIeDataHost(key: IeDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = asKrSpec(IE_SPEC_BY_KEY[key]);
  const hookId = `useIe${key.slice(2)}Layer`;
  const IeDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    useKrDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? fallbackOpacity, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CatMask`], p[`${key}DisplayModeIdx`]);
    return null;
  };
  return IeDataHost;
}

export const IeMaritimeBoundariesHost = makeIeDataHost("ieMaritimeBoundaries", 0.85);
export const IePlaceNamesHost = makeIeDataHost("iePlaceNames", 0.8);
export const IeGaeltachtHost = makeIeDataHost("ieGaeltacht", 0.6);
export const IeActivityLocationsHost = makeIeDataHost("ieActivityLocations", 0.8);
export const IeParksHost = makeIeDataHost("ieParks", 0.7);
export const IeGraveyardsHost = makeIeDataHost("ieGraveyards", 0.8);
// 第 2 波：房地產
export const IeCommercialValuationsHost = makeIeDataHost("ieCommercialValuations", 0.8);
export const IeStateAssetsHost = makeIeDataHost("ieStateAssets", 0.7);
// 第 3a 波：水資源、災害
export const IeHydrometricStationsHost = makeIeDataHost("ieHydrometricStations", 0.8);
export const IeWaterMonitoringHost = makeIeDataHost("ieWaterMonitoring", 0.8);
export const IeRiverWaterBodiesHost = makeIeDataHost("ieRiverWaterBodies", 0.85);
export const IeLakeWaterBodiesHost = makeIeDataHost("ieLakeWaterBodies", 0.7);
export const IeArterialDrainageHost = makeIeDataHost("ieArterialDrainage", 0.85);
export const IeCoastalErosionHost = makeIeDataHost("ieCoastalErosion", 0.85);
// 第 3b 波：海洋
export const IeBathingWatersHost = makeIeDataHost("ieBathingWaters", 0.9);
export const IeMarineSurveyStationsHost = makeIeDataHost("ieMarineSurveyStations", 0.8);
export const IeSeabedSurveyCoverageHost = makeIeDataHost("ieSeabedSurveyCoverage", 0.7);
export const IeProtectedMarineSitesHost = makeIeDataHost("ieProtectedMarineSites", 0.7);
export const IeOffshoreRenewablesHost = makeIeDataHost("ieOffshoreRenewables", 0.7);
// 第 4 波：交通
export const IeTransitStopsHost = makeIeDataHost("ieTransitStops", 0.8);
export const IeDublinbikesStationsHost = makeIeDataHost("ieDublinbikesStations", 0.8);
export const IeRoadRailNetworkHost = makeIeDataHost("ieRoadRailNetwork", 0.85);
export const IeRoadMarkersHost = makeIeDataHost("ieRoadMarkers", 0.8);
export const IeTrafficCountersHost = makeIeDataHost("ieTrafficCounters", 0.8);
export const IeAirportsPortsHost = makeIeDataHost("ieAirportsPorts", 0.85);
// 第 5 波：自然保護、林業、地質輻射
export const IeNationalParksHost = makeIeDataHost("ieNationalParks", 0.6);
export const IeWildAtlanticWayHost = makeIeDataHost("ieWildAtlanticWay", 0.85);
export const IeProtectedSitesHost = makeIeDataHost("ieProtectedSites", 0.6);
export const IeNationalTrailsHost = makeIeDataHost("ieNationalTrails", 0.85);
export const IeStreetTreesHost = makeIeDataHost("ieStreetTrees", 0.8);
export const IeRadiationStationsHost = makeIeDataHost("ieRadiationStations", 0.85);
export const IeLandslideEventsHost = makeIeDataHost("ieLandslideEvents", 0.8);
export const IeLandslideExtentsHost = makeIeDataHost("ieLandslideExtents", 0.7);
export const IeRadonRiskHost = makeIeDataHost("ieRadonRisk", 0.45);
// 第 6 波：能源
export const IePowerPlantsHost = makeIeDataHost("iePowerPlants", 0.9);
export const IePowerLinesHost = makeIeDataHost("iePowerLines", 0.85);
export const IeSubstationsHost = makeIeDataHost("ieSubstations", 0.85);
export const IeWindFarmsHost = makeIeDataHost("ieWindFarms", 0.85);
export const IeEvChargingHost = makeIeDataHost("ieEvCharging", 0.85);
export const IeFuelStationsHost = makeIeDataHost("ieFuelStations", 0.8);
// 第 7a 波：教育
export const IeSchoolsHost = makeIeDataHost("ieSchools", 0.85);
export const IeSchoolPlanningAreasHost = makeIeDataHost("ieSchoolPlanningAreas", 0.35);
export const IeChildcareServicesHost = makeIeDataHost("ieChildcareServices", 0.85);
// 第 8 波：文化遺產與生活據點
export const IeHeritageSitesHost = makeIeDataHost("ieHeritageSites", 0.8);
export const IeMuseumsHost = makeIeDataHost("ieMuseums", 0.85);
export const IeArtsVenuesHost = makeIeDataHost("ieArtsVenues", 0.85);
export const IePublicFacilitiesHost = makeIeDataHost("iePublicFacilities", 0.85);
export const IeReligiousSitesHost = makeIeDataHost("ieReligiousSites", 0.85);
// 第 7b 波：醫療照護、消防警政、司法
export const IeHealthFacilitiesHost = makeIeDataHost("ieHealthFacilities", 0.85);
export const IeCareHomesHost = makeIeDataHost("ieCareHomes", 0.85);
export const IeFireStationsHost = makeIeDataHost("ieFireStations", 0.9);
export const IeGardaStationsHost = makeIeDataHost("ieGardaStations", 0.85);
export const IeCourtsHost = makeIeDataHost("ieCourts", 0.9);
// 第 10 波：工商與農業
export const IeIndustrialFacilitiesHost = makeIeDataHost("ieIndustrialFacilities", 0.85);
export const IeSoilsHost = makeIeDataHost("ieSoils", 0.45);
export const IePeatSoilsHost = makeIeDataHost("iePeatSoils", 0.5);
export const IeAquacultureHost = makeIeDataHost("ieAquaculture", 0.6);
// 第 9 波：規劃與環境
export const IeZoningHost = makeIeDataHost("ieZoning", 0.7);
export const IePlanningApplicationsHost = makeIeDataHost("iePlanningApplications", 0.85);
export const IeRecyclingPointsHost = makeIeDataHost("ieRecyclingPoints", 0.85);
export const IeWasteFacilitiesHost = makeIeDataHost("ieWasteFacilities", 0.7);
export const IePrtrFacilitiesHost = makeIeDataHost("iePrtrFacilities", 0.85);

/** 策略噪音地圖：Lden／Lnight 各一支 PMTiles，依 `ieNoiseMapsMetricIdx` 換 `file`（同河川淹水）；噪音等級多選照常傳 CatMask。 */
const NOISE_SPEC = asKrSpec(IE_SPEC_BY_KEY.ieNoiseMaps);
export const IeNoiseMapsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeNoiseMapsLayer");
  const p = useKeyOverlayParams("ieNoiseMaps");
  const file = ieNoiseMetricFileAt(p.ieNoiseMapsMetricIdx);
  const spec = useMemo(() => ({ ...NOISE_SPEC, file }), [file]);
  useKrDataLayer(deps.mapRef, spec, deps.layerVisibility.ieNoiseMaps, p.ieNoiseMapsOpacity ?? 0.55, 1, deps.isDarkTheme, p.ieNoiseMapsCatMask, undefined);
  return null;
};

/** 河川淹水範圍（NIFM）：情境 × 重現期一組一支 PMTiles，依 `ieRiverFloodExtentsScenarioIdx` 換 `file`（hook 偵測檔名改變就重建 source）。 */
const FLOOD_SPEC = asKrSpec(IE_SPEC_BY_KEY.ieRiverFloodExtents);
export const IeRiverFloodExtentsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeRiverFloodExtentsLayer");
  const p = useKeyOverlayParams("ieRiverFloodExtents");
  const file = ieFloodScenarioFileAt(p.ieRiverFloodExtentsScenarioIdx);
  const spec = useMemo(() => ({ ...FLOOD_SPEC, file }), [file]);
  useKrDataLayer(deps.mapRef, spec, deps.layerVisibility.ieRiverFloodExtents, p.ieRiverFloodExtentsOpacity ?? 0.55, 1, deps.isDarkTheme, undefined, undefined);
  return null;
};

/** 海床地形（raster，只有透明度）。 */
export const IeBathymetryHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeBathymetryLayer");
  const p = useKeyOverlayParams("ieBathymetry");
  useIeBathymetryLayer(deps.mapRef, deps.layerVisibility.ieBathymetry, p.ieBathymetryOpacity ?? 0.7);
  return null;
};

/** 第 5c 波 Coillte 國有林（站主限定 owner-only RPC）：只供資料，樣式在 overlayRegistry。 */
export const IeCoillteRecreationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeCoillteRecreationLayer");
  useIeCoillteLayer(deps.mapRef, "ieCoillteRecreation", deps.layerVisibility.ieCoillteRecreation);
  return null;
};
export const IeCoillteForestRoadsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeCoillteForestRoadsLayer");
  useIeCoillteForestRoadsLayer(deps.mapRef, deps.layerVisibility.ieCoillteForestRoads);
  return null;
};
