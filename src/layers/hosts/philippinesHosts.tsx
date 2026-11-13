// 菲律賓 Layer Host（2026-11-13 第 0–1 波）。比照 hosts/irelandHosts.tsx：一個 key 一個 Host。

import { phPlantStatusFilter, usePhAdminLayers, usePhDataLayer, usePhPopulationLayers } from "../../hooks/usePhLayers";
import { PH_SPEC_BY_KEY } from "../../data/phDataLayers";
import type { PhDataKey } from "../../data/phDataKeys";
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

/** 規格驅動 8 層（規格見 data/phDataLayers.ts）。 */
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
