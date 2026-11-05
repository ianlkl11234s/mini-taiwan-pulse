// 加拿大 Layer Host（2026-11-04 第 0＋1 波）。比照 hosts/koreaHosts.tsx：一個 key 一個 Host。

import { useCaAdminLayers } from "../../hooks/useCaAdminLayers";
import { useCaAirportsPortsLayer, useCaMajorRoadsLayer, useCaRailwaysLayer, useCaTransitStopsLayer } from "../../hooks/useCaTransportLayers";
import { useCaOilGasLayer, useCaPopulationCentresLayer, useCaPowerGridLayer, useCaPowerPlantsLayer, useCaWindTurbinesLayer } from "../../hooks/useCaEnergyLayers";
import {
  caCimdDimensionFromIdx, caRentUnitFromIdx, useCaDeprivationLayer, useCaFederalDistrictsLayer, useCaIndigenousLandsLayer, useCaPostalFsaLayer, useCaRentsLayer,
} from "../../hooks/useCaAreaLayers";
import { useCaHillshadeLayer, useCaPlaceNamesLayer } from "../../hooks/useCaTerrainLayers";
import {
  useCaAqhiStationsLayer, useCaClimateStationsLayer, useCaEarthquakesLayer, useCaNpriFacilitiesLayer, useCaPopulationGridLayer, useCaRadiationStationsLayer,
  useCaWastewaterSystemsLayer,
} from "../../hooks/useCaEnvLayers";
import { gbDisplayModeFromIdx } from "../../hooks/useGbWaterLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：省／地區、普查區、普查分區三層級（同一個 PMTiles，select 切換）。 */
export const CaAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaAdminLayers");
  const p = useKeyOverlayParams("caAdminBoundaries");
  const level = p.caAdminBoundariesLevelIdx;
  useCaAdminLayers(deps.mapRef, deps.layerVisibility.caAdminBoundaries, p.caAdminBoundariesOpacity ?? 0.85, level === 1 || level === 2 ? level : 0, deps.isDarkTheme);
  return null;
};

export const CaTransitStopsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaTransitStopsLayer");
  const p = useKeyOverlayParams("caTransitStops");
  useCaTransitStopsLayer(deps.mapRef, deps.layerVisibility.caTransitStops, p.caTransitStopsOpacity ?? 0.6, p.caTransitStopsScale ?? 1, deps.isDarkTheme, p.caTransitStopsCatMask);
  return null;
};

export const CaAirportsPortsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaAirportsPortsLayer");
  const p = useKeyOverlayParams("caAirportsPorts");
  useCaAirportsPortsLayer(deps.mapRef, deps.layerVisibility.caAirportsPorts, p.caAirportsPortsOpacity ?? 0.8, p.caAirportsPortsScale ?? 1, deps.isDarkTheme, p.caAirportsPortsCatMask, p.caAirportsPortsPortMask);
  return null;
};

export const CaMajorRoadsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaMajorRoadsLayer");
  const p = useKeyOverlayParams("caMajorRoads");
  useCaMajorRoadsLayer(deps.mapRef, deps.layerVisibility.caMajorRoads, p.caMajorRoadsOpacity ?? 0.85, deps.isDarkTheme, p.caMajorRoadsCatMask);
  return null;
};

export const CaRailwaysHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaRailwaysLayer");
  const p = useKeyOverlayParams("caRailways");
  useCaRailwaysLayer(deps.mapRef, deps.layerVisibility.caRailways, p.caRailwaysOpacity ?? 0.85, p.caRailwaysScale ?? 1, deps.isDarkTheme, p.caRailwaysCatMask, p.caRailwaysStationMask);
  return null;
};

export const CaPowerPlantsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaPowerPlantsLayer");
  const p = useKeyOverlayParams("caPowerPlants");
  useCaPowerPlantsLayer(deps.mapRef, deps.layerVisibility.caPowerPlants, p.caPowerPlantsOpacity ?? 0.8, p.caPowerPlantsScale ?? 1, deps.isDarkTheme, p.caPowerPlantsCatMask);
  return null;
};

export const CaWindTurbinesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaWindTurbinesLayer");
  const p = useKeyOverlayParams("caWindTurbines");
  useCaWindTurbinesLayer(deps.mapRef, deps.layerVisibility.caWindTurbines, p.caWindTurbinesOpacity ?? 0.8, p.caWindTurbinesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const CaPowerGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaPowerGridLayer");
  const p = useKeyOverlayParams("caPowerGrid");
  useCaPowerGridLayer(deps.mapRef, deps.layerVisibility.caPowerGrid, p.caPowerGridOpacity ?? 0.85, p.caPowerGridScale ?? 1, deps.isDarkTheme, p.caPowerGridCatMask);
  return null;
};

export const CaOilGasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaOilGasLayer");
  const p = useKeyOverlayParams("caOilGas");
  useCaOilGasLayer(deps.mapRef, deps.layerVisibility.caOilGas, p.caOilGasOpacity ?? 0.6, p.caOilGasScale ?? 1, deps.isDarkTheme, p.caOilGasPartMask, p.caOilGasPipeMask, p.caOilGasCatMask);
  return null;
};

export const CaPopulationCentresHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaPopulationCentresLayer");
  const p = useKeyOverlayParams("caPopulationCentres");
  useCaPopulationCentresLayer(
    deps.mapRef, deps.layerVisibility.caPopulationCentres, p.caPopulationCentresOpacity ?? 0.55, p.caPopulationCentresScale ?? 1, deps.isDarkTheme,
    gbDisplayModeFromIdx(p.caPopulationCentresDisplayModeIdx, "polygon"), p.caPopulationCentresCatMask,
  );
  return null;
};

// ─────────────────────────── 第 2 波（面資料與社經、地名與地形） ───────────────────────────

export const CaFederalDistrictsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaFederalDistrictsLayer");
  const p = useKeyOverlayParams("caFederalDistricts");
  useCaFederalDistrictsLayer(deps.mapRef, deps.layerVisibility.caFederalDistricts, p.caFederalDistrictsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const CaPostalFsaHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaPostalFsaLayer");
  const p = useKeyOverlayParams("caPostalFsa");
  useCaPostalFsaLayer(deps.mapRef, deps.layerVisibility.caPostalFsa, p.caPostalFsaOpacity ?? 0.7, deps.isDarkTheme, p.caPostalFsaCatMask);
  return null;
};

export const CaIndigenousLandsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaIndigenousLandsLayer");
  const p = useKeyOverlayParams("caIndigenousLands");
  useCaIndigenousLandsLayer(
    deps.mapRef, deps.layerVisibility.caIndigenousLands, p.caIndigenousLandsOpacity ?? 0.55, p.caIndigenousLandsScale ?? 1, deps.isDarkTheme,
    gbDisplayModeFromIdx(p.caIndigenousLandsDisplayModeIdx, "polygon"), p.caIndigenousLandsCatMask,
  );
  return null;
};

export const CaDeprivationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaDeprivationLayer");
  const p = useKeyOverlayParams("caDeprivation");
  useCaDeprivationLayer(deps.mapRef, deps.layerVisibility.caDeprivation, p.caDeprivationOpacity ?? 0.55, p.caDeprivationScale ?? 1, deps.isDarkTheme, caCimdDimensionFromIdx(p.caDeprivationDimensionIdx));
  return null;
};

export const CaRentsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaRentsLayer");
  const p = useKeyOverlayParams("caRents");
  useCaRentsLayer(deps.mapRef, deps.layerVisibility.caRents, p.caRentsOpacity ?? 0.55, p.caRentsScale ?? 1, deps.isDarkTheme, caRentUnitFromIdx(p.caRentsUnitIdx));
  return null;
};

export const CaPlaceNamesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaPlaceNamesLayer");
  const p = useKeyOverlayParams("caPlaceNames");
  useCaPlaceNamesLayer(deps.mapRef, deps.layerVisibility.caPlaceNames, p.caPlaceNamesOpacity ?? 0.85, p.caPlaceNamesScale ?? 1, deps.isDarkTheme, p.caPlaceNamesCatMask);
  return null;
};

export const CaHillshadeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaHillshadeLayer");
  const p = useKeyOverlayParams("caHillshade");
  useCaHillshadeLayer(deps.mapRef, deps.layerVisibility.caHillshade, p.caHillshadeOpacity ?? 0.5);
  return null;
};

// ── 第 3 波（2026-11-06）：環境氣候、災害＋GHSL 人口網格 ──

export const CaClimateStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaClimateStationsLayer");
  const p = useKeyOverlayParams("caClimateStations");
  useCaClimateStationsLayer(deps.mapRef, deps.layerVisibility.caClimateStations, p.caClimateStationsOpacity ?? 0.8, p.caClimateStationsScale ?? 1, deps.isDarkTheme, p.caClimateStationsCatMask);
  return null;
};

export const CaAqhiStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaAqhiStationsLayer");
  const p = useKeyOverlayParams("caAqhiStations");
  useCaAqhiStationsLayer(deps.mapRef, deps.layerVisibility.caAqhiStations, p.caAqhiStationsOpacity ?? 0.9, p.caAqhiStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const CaRadiationStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaRadiationStationsLayer");
  const p = useKeyOverlayParams("caRadiationStations");
  useCaRadiationStationsLayer(deps.mapRef, deps.layerVisibility.caRadiationStations, p.caRadiationStationsOpacity ?? 0.9, p.caRadiationStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const CaNpriFacilitiesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaNpriFacilitiesLayer");
  const p = useKeyOverlayParams("caNpriFacilities");
  useCaNpriFacilitiesLayer(
    deps.mapRef, deps.layerVisibility.caNpriFacilities, p.caNpriFacilitiesOpacity ?? 0.7, p.caNpriFacilitiesScale ?? 1, deps.isDarkTheme,
    p.caNpriFacilitiesCatMask, p.caNpriFacilitiesRecentMask,
  );
  return null;
};

export const CaWastewaterSystemsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaWastewaterSystemsLayer");
  const p = useKeyOverlayParams("caWastewaterSystems");
  useCaWastewaterSystemsLayer(deps.mapRef, deps.layerVisibility.caWastewaterSystems, p.caWastewaterSystemsOpacity ?? 0.85, p.caWastewaterSystemsScale ?? 1, deps.isDarkTheme, p.caWastewaterSystemsCatMask);
  return null;
};

export const CaEarthquakesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaEarthquakesLayer");
  const p = useKeyOverlayParams("caEarthquakes");
  useCaEarthquakesLayer(deps.mapRef, deps.layerVisibility.caEarthquakes, p.caEarthquakesOpacity ?? 0.7, p.caEarthquakesScale ?? 1, deps.isDarkTheme, p.caEarthquakesCatMask);
  return null;
};

export const CaPopulationGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCaPopulationGridLayer");
  const p = useKeyOverlayParams("caPopulationGrid");
  useCaPopulationGridLayer(deps.mapRef, deps.layerVisibility.caPopulationGrid, p.caPopulationGridOpacity ?? 0.6, deps.isDarkTheme);
  return null;
};
