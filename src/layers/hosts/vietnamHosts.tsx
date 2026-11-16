// 越南 Layer Host（2026-11-13 第 0–1 波）。比照 hosts/philippinesHosts.tsx：一個 key 一個 Host；規格驅動層重用 usePhDataLayer。

import { usePhDataLayer } from "../../hooks/usePhLayers";
import { useVnAdminLayers, useVnPopulationLayers } from "../../hooks/useVnLayers";
import { selectedMultiSelectValues } from "../../data/multiSelectMapbox";
import { VN_SPEC_BY_KEY, VN_STATUS_IDS, vnMoreSpec, vnStatusFilter } from "../../data/vnDataLayers";
import type { VnDataKey } from "../../data/vnDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：34 省面＋省名。 */
export const VnAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useVnAdminLayers");
  const p = useKeyOverlayParams("vnAdminBoundaries");
  useVnAdminLayers(deps.mapRef, deps.layerVisibility.vnAdminBoundaries, p.vnAdminBoundariesOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

/** 人口（NSO 2025）：34 省人口密度。 */
export const VnPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useVnPopulationLayers");
  const p = useKeyOverlayParams("vnPopulation");
  useVnPopulationLayers(deps.mapRef, deps.layerVisibility.vnPopulation, p.vnPopulationOpacity ?? 0.7, deps.isDarkTheme);
  return null;
};

/** 規格驅動 10 層；有第二個 PMTiles（ODM／OSM、GEM／OSM 分檔）的層畫兩次，hook 數固定。 */
function makeVnDataHost(key: VnDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = VN_SPEC_BY_KEY[key];
  const more = vnMoreSpec(spec);
  const hookId = `useVn${key.slice(2)}Layer`;
  const useParams = (deps: Parameters<LayerHostComponent>[0]["deps"]) => {
    const p = useKeyOverlayParams(key);
    const statusMask = p[`${key}StatusMask`];
    const status = statusMask === undefined || !Number.isFinite(statusMask) ? undefined : selectedMultiSelectValues(statusMask, VN_STATUS_IDS);
    return {
      visible: deps.layerVisibility[key], opacity: p[`${key}Opacity`] ?? fallbackOpacity, scale: p[`${key}Scale`] ?? 1,
      catMask: p[`${key}CategoryMask`], extra: vnStatusFilter(spec, status),
    };
  };
  if (!more) {
    const VnDataHost: LayerHostComponent = ({ deps }) => {
      bumpHostRender(hookId);
      const o = useParams(deps);
      usePhDataLayer(deps.mapRef, spec, o.visible, o.opacity, o.scale, deps.isDarkTheme, o.catMask, o.extra);
      return null;
    };
    return VnDataHost;
  }
  const VnDataHost2: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const o = useParams(deps);
    usePhDataLayer(deps.mapRef, spec, o.visible, o.opacity, o.scale, deps.isDarkTheme, o.catMask, o.extra);
    usePhDataLayer(deps.mapRef, more, o.visible, o.opacity, o.scale, deps.isDarkTheme, o.catMask, o.extra);
    return null;
  };
  return VnDataHost2;
}

export const VnStationsHost = makeVnDataHost("vnStations", 0.85);
export const VnTransportHubsHost = makeVnDataHost("vnTransportHubs", 0.85);
export const VnMajorRoadsHost = makeVnDataHost("vnMajorRoads", 0.85);
export const VnPowerPlantsHost = makeVnDataHost("vnPowerPlants", 0.85);
export const VnRenewablesHost = makeVnDataHost("vnRenewables", 0.85);
export const VnPowerGridHost = makeVnDataHost("vnPowerGrid", 0.85);
export const VnFuelStationsHost = makeVnDataHost("vnFuelStations", 0.85);
export const VnOilGasHost = makeVnDataHost("vnOilGas", 0.85);
export const VnEnvisoftStationsHost = makeVnDataHost("vnEnvisoftStations", 0.85);
export const VnAngiangDemoHost = makeVnDataHost("vnAngiangDemo", 0.85);
