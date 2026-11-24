// 印尼 Layer Host（2026-11-23 第 0–4 波）。比照 hosts/thailandHosts.tsx：一個 key 一個 Host；規格驅動層重用 usePhDataLayer。

import { usePhDataLayer } from "../../hooks/intlPhSpecLayers";
import { useIdAdminLayers, useIdPopulationLayers, useIdRasterLayer, useIdRuralDevelopmentLayers } from "../../hooks/useIdLayers";
import { ID_RASTER_BY_KEY } from "../../data/idWavesLayers";
import { ID_SPEC_BY_KEY } from "../../data/idDataLayers";
import type { IdDataKey, IdRasterKey } from "../../data/idDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：國界、省、縣市三層級（同一個 PMTiles，select 切換）。 */
export const IdAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIdAdminLayers");
  const p = useKeyOverlayParams("idAdminBoundaries");
  useIdAdminLayers(deps.mapRef, deps.layerVisibility.idAdminBoundaries, p.idAdminBoundariesOpacity ?? 0.85, p.idAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 人口（2020 推估）：省、縣市兩層級人口密度。 */
export const IdPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIdPopulationLayers");
  const p = useKeyOverlayParams("idPopulation");
  useIdPopulationLayers(deps.mapRef, deps.layerVisibility.idPopulation, p.idPopulationOpacity ?? 0.7, p.idPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 農村發展指數 IDM 2024：省、縣市兩層級，無村縣市畫灰「未涵蓋」。 */
export const IdRuralDevelopmentHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIdRuralDevelopmentLayers");
  const p = useKeyOverlayParams("idRuralDevelopment");
  useIdRuralDevelopmentLayers(deps.mapRef, deps.layerVisibility.idRuralDevelopment, p.idRuralDevelopmentOpacity ?? 0.7, p.idRuralDevelopmentLevelIdx, deps.isDarkTheme);
  return null;
};

/** 規格驅動 19 層（規格見 data/idWavesLayers.ts），預設透明度取 spec.opacity。 */
function makeIdDataHost(key: IdDataKey): LayerHostComponent {
  const spec = ID_SPEC_BY_KEY[key];
  const hookId = `useId${key.slice(2)}Layer`;
  const IdDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    usePhDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity ?? 0.85, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CategoryMask`]);
    return null;
  };
  return IdDataHost;
}

export const IdStationsHost = makeIdDataHost("idStations");
export const IdRailLinesHost = makeIdDataHost("idRailLines");
export const IdTransportHubsHost = makeIdDataHost("idTransportHubs");
export const IdPowerPlantsHost = makeIdDataHost("idPowerPlants");
export const IdPowerGridHost = makeIdDataHost("idPowerGrid");
export const IdRenewablesHost = makeIdDataHost("idRenewables");
export const IdFuelStationsHost = makeIdDataHost("idFuelStations");
export const IdPlaceNamesHost = makeIdDataHost("idPlaceNames");
export const IdOuterIslandsHost = makeIdDataHost("idOuterIslands");
export const IdFaultsHost = makeIdDataHost("idFaults");
export const IdMountainRescueHost = makeIdDataHost("idMountainRescue");
export const IdDibiHydrometHost = makeIdDataHost("idDibiHydromet");
export const IdBridgesHost = makeIdDataHost("idBridges");
export const IdWaterFacilitiesHost = makeIdDataHost("idWaterFacilities");
export const IdWatershedsHost = makeIdDataHost("idWatersheds");
export const IdSubsidenceHost = makeIdDataHost("idSubsidence");
export const IdNatureSpotsHost = makeIdDataHost("idNatureSpots");
export const IdConservationForestHost = makeIdDataHost("idConservationForest");
export const IdCampsHost = makeIdDataHost("idCamps");

// 第 5–9 波（2026-11-24）
export const IdSchoolsHost = makeIdDataHost("idSchools");
export const IdHealthFacilitiesHost = makeIdDataHost("idHealthFacilities");
export const IdFireStationsHost = makeIdDataHost("idFireStations");
export const IdPoliceStationsHost = makeIdDataHost("idPoliceStations");
export const IdPrisonsCourtsHost = makeIdDataHost("idPrisonsCourts");
export const IdImmigrationOfficesHost = makeIdDataHost("idImmigrationOffices");
export const IdTransjakartaHost = makeIdDataHost("idTransjakarta");
export const IdSpecialEconomicZonesHost = makeIdDataHost("idSpecialEconomicZones");
export const IdIknHost = makeIdDataHost("idIkn");
export const IdPostOfficesHost = makeIdDataHost("idPostOffices");
export const IdMarketsHost = makeIdDataHost("idMarkets");
export const IdBanksHost = makeIdDataHost("idBanks");
export const IdCulturalFacilitiesHost = makeIdDataHost("idCulturalFacilities");
export const IdHeritageSitesHost = makeIdDataHost("idHeritageSites");
export const IdCommTowersHost = makeIdDataHost("idCommTowers");
export const IdPlacesOfWorshipHost = makeIdDataHost("idPlacesOfWorship");
export const IdExperiencesHost = makeIdDataHost("idExperiences");
export const IdAccommodationHost = makeIdDataHost("idAccommodation");
export const IdWeatherStationsHost = makeIdDataHost("idWeatherStations");
export const IdFactoriesHost = makeIdDataHost("idFactories");
export const IdSportsVenuesHost = makeIdDataHost("idSportsVenues");
export const IdParksHost = makeIdDataHost("idParks");
export const IdCemeteriesHost = makeIdDataHost("idCemeteries");
export const IdAquacultureHost = makeIdDataHost("idAquaculture");
export const IdFarmlandHost = makeIdDataHost("idFarmland");
export const IdVeterinaryHost = makeIdDataHost("idVeterinary");

function makeIdRasterHost(key: IdRasterKey): LayerHostComponent {
  const spec = ID_RASTER_BY_KEY[key];
  const IdRasterHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(`useId${key.slice(2)}Layer`);
    const p = useKeyOverlayParams(key);
    useIdRasterLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity);
    return null;
  };
  return IdRasterHost;
}
export const IdTerrainHillshadeHost = makeIdRasterHost("idTerrainHillshade");
export const IdTerrainReliefHost = makeIdRasterHost("idTerrainRelief");
export const IdInariskLandslideHost = makeIdRasterHost("idInariskLandslide");
export const IdInariskFloodHost = makeIdRasterHost("idInariskFlood");
export const IdInariskMultiHost = makeIdRasterHost("idInariskMulti");
