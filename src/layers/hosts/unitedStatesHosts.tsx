// 美國 Layer Host（2026-11-25 第 0–1 波）。比照 hosts/indonesiaHosts.tsx：一個 key 一個 Host；規格驅動層重用 usePhDataLayer。

import { usePhDataLayer } from "../../hooks/intlPhSpecLayers";
import { useUsAdminLayers, useUsPopulationLayers } from "../../hooks/useUsLayers";
import { US_SPEC_BY_KEY } from "../../data/usDataLayers";
import type { UsDataKey } from "../../data/usDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：州、郡兩層級（同一個 PMTiles，select 切換）。 */
export const UsAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useUsAdminLayers");
  const p = useKeyOverlayParams("usAdminBoundaries");
  useUsAdminLayers(deps.mapRef, deps.layerVisibility.usAdminBoundaries, p.usAdminBoundariesOpacity ?? 0.85, p.usAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 人口（ACS 2020–2024）：州、郡、普查區三層級人口密度。 */
export const UsPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useUsPopulationLayers");
  const p = useKeyOverlayParams("usPopulation");
  useUsPopulationLayers(deps.mapRef, deps.layerVisibility.usPopulation, p.usPopulationOpacity ?? 0.7, p.usPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 規格驅動層（規格見 data/usDataLayers.ts），預設透明度取 spec.opacity。 */
function makeUsDataHost(key: UsDataKey): LayerHostComponent {
  const spec = US_SPEC_BY_KEY[key];
  const hookId = `useUs${key.slice(2)}Layer`;
  const UsDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    usePhDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity ?? 0.85, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CategoryMask`]);
    return null;
  };
  return UsDataHost;
}

export const UsStationsHost = makeUsDataHost("usStations");
export const UsRailLinesHost = makeUsDataHost("usRailLines");
export const UsHighwaysHost = makeUsDataHost("usHighways");
export const UsTransportHubsHost = makeUsDataHost("usTransportHubs");
export const UsPowerPlantsHost = makeUsDataHost("usPowerPlants");
export const UsPowerGridHost = makeUsDataHost("usPowerGrid");
export const UsRenewablesHost = makeUsDataHost("usRenewables");
export const UsOilGasHost = makeUsDataHost("usOilGas");
export const UsFuelStationsHost = makeUsDataHost("usFuelStations");
