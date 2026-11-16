// 菲律賓 Layer Host（2026-11-13 第 0–1 波）。比照 hosts/irelandHosts.tsx：一個 key 一個 Host。

import { phPlantStatusFilter, usePhAdminLayers, usePhDataLayer, usePhPopulationLayers, usePhRasterLayer } from "../../hooks/usePhLayers";
import { PH_SPEC_BY_KEY, phFileSpecs } from "../../data/phDataLayers";
import { PH_RASTER_BY_KEY } from "../../data/phWavesLayers";
import type { PhDataKey, PhRasterKey } from "../../data/phDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：region、province、municipality、barangay 四層級（同一個 PMTiles，select 切換）。 */
export const PhAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePhAdminLayers");
  const p = useKeyOverlayParams("phAdminBoundaries");
  usePhAdminLayers(deps.mapRef, deps.layerVisibility.phAdminBoundaries, p.phAdminBoundariesOpacity ?? 0.85, p.phAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 人口（2024 普查）：四層級人口密度，未涵蓋畫灰。 */
export const PhPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePhPopulationLayers");
  const p = useKeyOverlayParams("phPopulation");
  usePhPopulationLayers(deps.mapRef, deps.layerVisibility.phPopulation, p.phPopulationOpacity ?? 0.7, p.phPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 規格驅動層（第 1 波 8 層＋第 2 波 3 層（規格見 data/phDataLayers.ts）。 */
function makePhDataHost(key: PhDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = PH_SPEC_BY_KEY[key];
  const hookId = `usePh${key.slice(2)}Layer`;
  const PhDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    const extra = key === "phPowerPlants" ? phPlantStatusFilter(p.phPowerPlantsStatusMask) : null;
    usePhDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? fallbackOpacity, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CategoryMask`], extra);
    return null;
  };
  return PhDataHost;
}

export const PhTransportHubsHost = makePhDataHost("phTransportHubs", 0.85);
export const PhStationsHost = makePhDataHost("phStations", 0.85);
export const PhMajorRoadsHost = makePhDataHost("phMajorRoads", 0.85);
export const PhPowerPlantsHost = makePhDataHost("phPowerPlants", 0.85);
export const PhPowerGridHost = makePhDataHost("phPowerGrid", 0.85);
export const PhRenewablesHost = makePhDataHost("phRenewables", 0.85);
export const PhFuelStationsHost = makePhDataHost("phFuelStations", 0.8);
export const PhPipelinesHost = makePhDataHost("phPipelines", 0.85);
// 第 2 波補充（2026-11-14）
export const PhBusStopsHost = makePhDataHost("phBusStops", 0.8);
export const PhUrbanRailHost = makePhDataHost("phUrbanRail", 0.85);
export const PhExpresswaysHost = makePhDataHost("phExpressways", 0.85);

// 觀光波與第 2–9 波（2026-11-16）
/** NOAH 淹水、崩塌：同一層依緯度分北中南三檔（範圍重疊、同一樣式），host 固定畫三次。 */
function makePhTripleFileHost(key: PhDataKey, fallbackOpacity: number): LayerHostComponent {
  const [a, b, c] = phFileSpecs(PH_SPEC_BY_KEY[key]);
  const hookId = `usePh${key.slice(2)}Layer`;
  const PhTripleHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    const visible = deps.layerVisibility[key];
    const opacity = p[`${key}Opacity`] ?? fallbackOpacity;
    const mask = p[`${key}CategoryMask`];
    usePhDataLayer(deps.mapRef, a!, visible, opacity, 1, deps.isDarkTheme, mask);
    usePhDataLayer(deps.mapRef, b!, visible, opacity, 1, deps.isDarkTheme, mask);
    usePhDataLayer(deps.mapRef, c!, visible, opacity, 1, deps.isDarkTheme, mask);
    return null;
  };
  return PhTripleHost;
}

function makePhRasterHost(key: PhRasterKey): LayerHostComponent {
  const spec = PH_RASTER_BY_KEY[key];
  const PhRasterHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(`usePh${key.slice(2)}Layer`);
    const p = useKeyOverlayParams(key);
    usePhRasterLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity);
    return null;
  };
  return PhRasterHost;
}

const W = (key: PhDataKey) => makePhDataHost(key, PH_SPEC_BY_KEY[key].opacity ?? 0.85);
export const PhTouristAttractionsHost = W("phTouristAttractions");
export const PhCoastIslandsHost = W("phCoastIslands");
export const PhNatureSpotsHost = W("phNatureSpots");
export const PhTourismServicesHost = W("phTourismServices");
export const PhTourismDevelopmentAreasHost = W("phTourismDevelopmentAreas");
export const PhPlaceNamesHost = W("phPlaceNames");
export const PhPovertyHost = W("phPoverty");
export const PhEarthquakesHost = W("phEarthquakes");
export const PhNoahFlood100yrHost = makePhTripleFileHost("phNoahFlood100yr", 0.6);
export const PhNoahLandslideHost = makePhTripleFileHost("phNoahLandslide", 0.6);
export const PhWaterPermitsHost = W("phWaterPermits");
export const PhLakesHost = W("phLakes");
export const PhDamsHost = W("phDams");
export const PhBridgesHost = W("phBridges");
export const PhParkingHost = W("phParking");
export const PhKmPostsHost = W("phKmPosts");
export const PhEcozonesHost = W("phEcozones");
export const PhReclamationHost = W("phReclamation");
export const PhSchoolsHost = W("phSchools");
export const PhSchoolCampusesHost = W("phSchoolCampuses");
export const PhHealthFacilitiesHost = W("phHealthFacilities");
export const PhFireStationsHost = W("phFireStations");
export const PhNcrSafeOpenSpacesHost = W("phNcrSafeOpenSpaces");
export const PhPoliceStationsHost = W("phPoliceStations");
export const PhJailsHost = W("phJails");
export const PhTreesHost = W("phTrees");
export const PhTrailsHost = W("phTrails");
export const PhKbaHost = W("phKba");
export const PhWetlandsHost = W("phWetlands");
export const PhForestryProgramsHost = W("phForestryPrograms");
export const PhCoastalResourcesHost = W("phCoastalResources");
export const PhMarineStationsHost = W("phMarineStations");
export const PhWdpcaHost = W("phWdpca");
export const PhWasteFacilitiesHost = W("phWasteFacilities");
export const PhPollutionSourcesHost = W("phPollutionSources");
export const PhArtsVenuesHost = W("phArtsVenues");
export const PhPostOfficesHost = W("phPostOffices");
export const PhPublicFacilitiesHost = W("phPublicFacilities");
export const PhFinancialServicesHost = W("phFinancialServices");
export const PhPlacesOfWorshipHost = W("phPlacesOfWorship");
export const PhSportsVenuesHost = W("phSportsVenues");
export const PhParksHost = W("phParks");
export const PhCemeteriesHost = W("phCemeteries");
export const PhFishPortsHost = W("phFishPorts");
export const PhAquacultureHost = W("phAquaculture");
export const PhTerrainHillshadeHost = makePhRasterHost("phTerrainHillshade");
export const PhTerrainReliefHost = makePhRasterHost("phTerrainRelief");
export const PhBuiltSurfaceHost = makePhRasterHost("phBuiltSurface");
export const PhForestLossHost = makePhRasterHost("phForestLoss");
