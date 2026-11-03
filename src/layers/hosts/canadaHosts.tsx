// 加拿大 Layer Host（2026-11-04 第 0＋1 波）。比照 hosts/koreaHosts.tsx：一個 key 一個 Host。

import { useCaAdminLayers } from "../../hooks/useCaAdminLayers";
import { useCaAirportsPortsLayer, useCaMajorRoadsLayer, useCaRailwaysLayer, useCaTransitStopsLayer } from "../../hooks/useCaTransportLayers";
import { useCaOilGasLayer, useCaPopulationCentresLayer, useCaPowerGridLayer, useCaPowerPlantsLayer, useCaWindTurbinesLayer } from "../../hooks/useCaEnergyLayers";
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
