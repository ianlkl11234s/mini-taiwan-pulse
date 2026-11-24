// 泰國 Layer Host（2026-11-22 第 0–1 波）。比照 hosts/vietnamHosts.tsx：一個 key 一個 Host；規格驅動層重用 usePhDataLayer。

import { usePhDataLayer } from "../../hooks/intlPhSpecLayers";
import { useThAdminLayers, useThPopulationLayers, useThRasterLayer } from "../../hooks/useThLayers";
import { TH_RASTER_BY_KEY } from "../../data/thWavesLayers";
import { selectedMultiSelectValues } from "../../data/multiSelectMapbox";
import { TH_SPEC_BY_KEY, TH_STATUS_IDS, thStatusFilter } from "../../data/thDataLayers";
import type { ThDataKey, ThRasterKey } from "../../data/thDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：國界、府、amphoe、tambon 四層級（同一個 PMTiles，select 切換）。 */
export const ThAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useThAdminLayers");
  const p = useKeyOverlayParams("thAdminBoundaries");
  useThAdminLayers(deps.mapRef, deps.layerVisibility.thAdminBoundaries, p.thAdminBoundariesOpacity ?? 0.85, p.thAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 人口（DOPA 戶籍登記）：府、amphoe 兩層級人口密度，未涵蓋畫灰。 */
export const ThPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useThPopulationLayers");
  const p = useKeyOverlayParams("thPopulation");
  useThPopulationLayers(deps.mapRef, deps.layerVisibility.thPopulation, p.thPopulationOpacity ?? 0.7, p.thPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 規格驅動 8 層（規格見 data/thDataLayers.ts）；電廠另有狀態多選。 */
function makeThDataHost(key: ThDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = TH_SPEC_BY_KEY[key];
  const hookId = `useTh${key.slice(2)}Layer`;
  const ThDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    const statusMask = p[`${key}StatusMask`];
    const status = statusMask === undefined || !Number.isFinite(statusMask) ? undefined : selectedMultiSelectValues(statusMask, TH_STATUS_IDS);
    usePhDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? fallbackOpacity, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CategoryMask`], thStatusFilter(spec, status));
    return null;
  };
  return ThDataHost;
}

export const ThTransportHubsHost = makeThDataHost("thTransportHubs", 0.85);
export const ThStationsHost = makeThDataHost("thStations", 0.85);
export const ThMajorRoadsHost = makeThDataHost("thMajorRoads", 0.85);
export const ThPowerPlantsHost = makeThDataHost("thPowerPlants", 0.85);
export const ThPowerGridHost = makeThDataHost("thPowerGrid", 0.85);
export const ThRenewablesHost = makeThDataHost("thRenewables", 0.85);
export const ThFuelStationsHost = makeThDataHost("thFuelStations", 0.8);
export const ThPipelinesHost = makeThDataHost("thPipelines", 0.85);

// ── 第 2–4 波（2026-11-22）：規格在 thWavesLayers.ts，預設透明度取 spec.opacity
const W = (key: ThDataKey) => makeThDataHost(key, TH_SPEC_BY_KEY[key].opacity ?? 0.85);
export const ThPlaceNamesHost = W("thPlaceNames");
export const ThElectionConstituenciesHost = W("thElectionConstituencies");
export const ThHighlandVillagesHost = W("thHighlandVillages");
export const ThProvinceSocioeconomicHost = W("thProvinceSocioeconomic");
export const ThFootbridgesHost = W("thFootbridges");
export const ThRailCrossingsHost = W("thRailCrossings");
export const ThRoadAccidentsHost = W("thRoadAccidents");
export const ThEecHost = W("thEec");
export const ThFloodHistoryHost = W("thFloodHistory");
export const ThBasinsHost = W("thBasins");
export const ThIrrigationProjectsHost = W("thIrrigationProjects");
export const ThLandslideSafePointsHost = W("thLandslideSafePoints");
export const ThLandfillsHost = W("thLandfills");

function makeThRasterHost(key: ThRasterKey): LayerHostComponent {
  const spec = TH_RASTER_BY_KEY[key];
  const ThRasterHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(`useTh${key.slice(2)}Layer`);
    const p = useKeyOverlayParams(key);
    useThRasterLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity);
    return null;
  };
  return ThRasterHost;
}
export const ThTerrainHillshadeHost = makeThRasterHost("thTerrainHillshade");
export const ThTerrainReliefHost = makeThRasterHost("thTerrainRelief");

// ── 第 5–7 波（2026-11-22）：規格在 thWaves5Layers.ts
export const ThSchoolsHost = W("thSchools");
export const ThKindergartensHost = W("thKindergartens");
export const ThElderlyHousingHost = W("thElderlyHousing");
export const ThHealthFacilitiesHost = W("thHealthFacilities");
export const ThPoliceStationsHost = W("thPoliceStations");
export const ThJailsCourtsHost = W("thJailsCourts");
export const ThNatureSpotsHost = W("thNatureSpots");
export const ThNationalReservedForestsHost = W("thNationalReservedForests");
export const ThNationalParksHost = W("thNationalParks");
export const ThRamsarSitesHost = W("thRamsarSites");
export const ThForestParksHost = W("thForestParks");
export const ThMuseumsLibrariesHost = W("thMuseumsLibraries");
export const ThArtsEventsHost = W("thArtsEvents");
export const ThHistoricSitesHost = W("thHistoricSites");
export const ThExperiencesHost = W("thExperiences");
export const ThAccommodationHost = W("thAccommodation");
export const ThBanksHost = W("thBanks");
export const ThPlacesOfWorshipHost = W("thPlacesOfWorship");
export const ThPostOfficesHost = W("thPostOffices");

// ── 第 8–9 波（2026-11-23）：規格在 thWaves8Layers.ts
export const ThAirQualityStationsHost = W("thAirQualityStations");
export const ThWeatherStationsHost = W("thWeatherStations");
export const ThMarineHabitatsHost = W("thMarineHabitats");
export const ThMarineProtectedAreasHost = W("thMarineProtectedAreas");
export const ThSeaLevelStationsHost = W("thSeaLevelStations");
export const ThCoastalChangeHost = W("thCoastalChange");
export const ThSportsVenuesHost = W("thSportsVenues");
export const ThParksHost = W("thParks");
export const ThFactoriesHost = W("thFactories");
export const ThFarmMarketsHost = W("thFarmMarkets");
export const ThCropsHost = W("thCrops");
export const ThVeterinaryHost = W("thVeterinary");
export const ThSoilPhHost = makeThRasterHost("thSoilPh");
export const ThSoilOrganicCarbonHost = makeThRasterHost("thSoilOrganicCarbon");
