// 中國 Layer Host（2026-11-13 第 0–1 波，站主限定）。比照 hosts/philippinesHosts.tsx：一個 key 一個 Host；
// 私人圖磚的存取判斷在 hook 內（useCnPrivateAccess），沒有權限就不掛 source。

import { cnPlantScopeFilter, cnPlantStatusFilter, useCnAdminLayers, useCnDataLayer, useCnPopulationGridLayer, useCnPopulationLayers } from "../../hooks/useCnLayers";
import { CN_SPEC_BY_KEY } from "../../data/cnDataLayers";
import type { CnDataKey } from "../../data/cnDataKeys";
import { gbAllOf } from "../../hooks/useGbWaterLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：省級、地級兩層級（同一個私人 PMTiles，select 切換）。 */
export const CnAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCnAdminLayers");
  const p = useKeyOverlayParams("cnAdminBoundaries");
  useCnAdminLayers(deps.mapRef, deps.layerVisibility.cnAdminBoundaries, p.cnAdminBoundariesOpacity ?? 0.85, p.cnAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 人口：省級 2020 普查密度、地級 GHS 模型值，未涵蓋畫灰。 */
export const CnPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCnPopulationLayers");
  const p = useKeyOverlayParams("cnPopulation");
  useCnPopulationLayers(deps.mapRef, deps.layerVisibility.cnPopulation, p.cnPopulationOpacity ?? 0.7, p.cnPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 人口網格（GHS-POP 2025 模型值，已上色 raster）。 */
export const CnPopulationGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCnPopulationGridLayer");
  const p = useKeyOverlayParams("cnPopulationGrid");
  useCnPopulationGridLayer(deps.mapRef, deps.layerVisibility.cnPopulationGrid, p.cnPopulationGridOpacity ?? 0.75);
  return null;
};

/** 規格驅動 6 層（規格見 data/cnDataLayers.ts）。 */
function makeCnDataHost(key: CnDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = CN_SPEC_BY_KEY[key];
  const hookId = `useCn${key.slice(2)}Layer`;
  const CnDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    const extra = key === "cnPowerPlants" ? gbAllOf(cnPlantStatusFilter(p.cnPowerPlantsStatusMask), cnPlantScopeFilter(p.cnPowerPlantsScopeIdx)) : null;
    useCnDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? fallbackOpacity, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CategoryMask`], extra);
    return null;
  };
  return CnDataHost;
}

export const CnBusStopsHost = makeCnDataHost("cnBusStops", 0.8);
export const CnTransportHubsHost = makeCnDataHost("cnTransportHubs", 0.85);
export const CnMajorRoadsHost = makeCnDataHost("cnMajorRoads", 0.85);
export const CnPowerPlantsHost = makeCnDataHost("cnPowerPlants", 0.85);
export const CnPowerGridHost = makeCnDataHost("cnPowerGrid", 0.85);
export const CnPipelinesHost = makeCnDataHost("cnPipelines", 0.85);
