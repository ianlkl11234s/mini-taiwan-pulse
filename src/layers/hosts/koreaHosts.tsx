// 南韓 Layer Host（2026-10-31 第 0 波起）。clone hosts/ukHosts.tsx 的 GbAdminHost 慣例。

import { useKrAdminLayers } from "../../hooks/useKrAdminLayers";
import { useKrAirportsLayer, useKrBusStopsLayer, useKrNationalRoadsLayer, useKrPortsLayer, useKrRailLinesLayer, useKrRailStationsLayer } from "../../hooks/useKrTransportLayers";
import { useKrFuelStationsLayer, useKrOilGasLayer, useKrPowerLinesLayer, useKrPowerPlantsLayer, useKrPowerTowersLayer, useKrRenewablesLayer, useKrSubstationsLayer } from "../../hooks/useKrEnergyLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 南韓行政邊界：시·도／시군구／행정동 三層級（同一個 PMTiles，select 切換）。 */
export const KrAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrAdminLayers");
  const p = useKeyOverlayParams("krAdminBoundaries");
  const level = p.krAdminBoundariesLevelIdx;
  useKrAdminLayers(
    deps.mapRef,
    deps.layerVisibility.krAdminBoundaries,
    p.krAdminBoundariesOpacity ?? 0.85,
    level === 1 || level === 2 ? level : 0,
    deps.isDarkTheme,
  );
  return null;
};

/** 南韓第 1 波（國土基礎）：交通 6 層、能源 7 個 key（電網三層共用 kr_power_grid.pmtiles）。 */
export const KrBusStopsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrBusStopsLayer");
  const p = useKeyOverlayParams("krBusStops");
  useKrBusStopsLayer(deps.mapRef, deps.layerVisibility.krBusStops, p.krBusStopsOpacity ?? 0.6, p.krBusStopsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrRailStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrRailStationsLayer");
  const p = useKeyOverlayParams("krRailStations");
  useKrRailStationsLayer(deps.mapRef, deps.layerVisibility.krRailStations, p.krRailStationsOpacity ?? 0.8, p.krRailStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrAirportsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrAirportsLayer");
  const p = useKeyOverlayParams("krAirports");
  useKrAirportsLayer(deps.mapRef, deps.layerVisibility.krAirports, p.krAirportsOpacity ?? 0.85, p.krAirportsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrPortsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrPortsLayer");
  const p = useKeyOverlayParams("krPorts");
  useKrPortsLayer(deps.mapRef, deps.layerVisibility.krPorts, p.krPortsOpacity ?? 0.45, deps.isDarkTheme);
  return null;
};

export const KrNationalRoadsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrNationalRoadsLayer");
  const p = useKeyOverlayParams("krNationalRoads");
  useKrNationalRoadsLayer(deps.mapRef, deps.layerVisibility.krNationalRoads, p.krNationalRoadsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const KrRailLinesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrRailLinesLayer");
  const p = useKeyOverlayParams("krRailLines");
  useKrRailLinesLayer(deps.mapRef, deps.layerVisibility.krRailLines, p.krRailLinesOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const KrFuelStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrFuelStationsLayer");
  const p = useKeyOverlayParams("krFuelStations");
  useKrFuelStationsLayer(deps.mapRef, deps.layerVisibility.krFuelStations, p.krFuelStationsOpacity ?? 0.75, p.krFuelStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrPowerPlantsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrPowerPlantsLayer");
  const p = useKeyOverlayParams("krPowerPlants");
  useKrPowerPlantsLayer(deps.mapRef, deps.layerVisibility.krPowerPlants, p.krPowerPlantsOpacity ?? 0.8, p.krPowerPlantsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrRenewablesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrRenewablesLayer");
  const p = useKeyOverlayParams("krRenewables");
  useKrRenewablesLayer(deps.mapRef, deps.layerVisibility.krRenewables, p.krRenewablesOpacity ?? 0.75, p.krRenewablesScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrPowerLinesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrPowerLinesLayer");
  const p = useKeyOverlayParams("krPowerLines");
  useKrPowerLinesLayer(deps.mapRef, deps.layerVisibility.krPowerLines, p.krPowerLinesOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const KrSubstationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrSubstationsLayer");
  const p = useKeyOverlayParams("krSubstations");
  useKrSubstationsLayer(deps.mapRef, deps.layerVisibility.krSubstations, p.krSubstationsOpacity ?? 0.75, p.krSubstationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrPowerTowersHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrPowerTowersLayer");
  const p = useKeyOverlayParams("krPowerTowers");
  useKrPowerTowersLayer(deps.mapRef, deps.layerVisibility.krPowerTowers, p.krPowerTowersOpacity ?? 0.6, p.krPowerTowersScale ?? 1, deps.isDarkTheme);
  return null;
};

export const KrOilGasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrOilGasLayer");
  const p = useKeyOverlayParams("krOilGas");
  useKrOilGasLayer(deps.mapRef, deps.layerVisibility.krOilGas, p.krOilGasOpacity ?? 0.6, deps.isDarkTheme);
  return null;
};
