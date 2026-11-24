// 美國屬地 Layer Host（2026-11-25 波多黎各、關島第 0–1 波）。比照 hosts/indonesiaHosts.tsx：一個 key 一個 Host；規格驅動層重用 usePhDataLayer。

import { usePhDataLayer } from "../../hooks/intlPhSpecLayers";
import { useGuAdminLayers, useGuPopulationLayers, usePrAdminLayers, usePrPopulationLayers } from "../../hooks/useUstLayers";
import { UST_SPEC_BY_KEY } from "../../data/ustDataLayers";
import type { UstDataKey } from "../../data/ustDataKeys";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 波多黎各行政邊界：屬地、78 市、901 區。 */
export const PrAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePrAdminLayers");
  const p = useKeyOverlayParams("prAdminBoundaries");
  usePrAdminLayers(deps.mapRef, deps.layerVisibility.prAdminBoundaries, p.prAdminBoundariesOpacity ?? 0.85, p.prAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 關島行政邊界：島界、19 村。 */
export const GuAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGuAdminLayers");
  const p = useKeyOverlayParams("guAdminBoundaries");
  useGuAdminLayers(deps.mapRef, deps.layerVisibility.guAdminBoundaries, p.guAdminBoundariesOpacity ?? 0.85, p.guAdminBoundariesLevelIdx, deps.isDarkTheme);
  return null;
};

/** 波多黎各人口密度（ACS 2020–2024）：市、區兩層級。 */
export const PrPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("usePrPopulationLayers");
  const p = useKeyOverlayParams("prPopulation");
  usePrPopulationLayers(deps.mapRef, deps.layerVisibility.prPopulation, p.prPopulationOpacity ?? 0.7, p.prPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 關島人口密度（2020 普查）：村、區塊群兩層級。 */
export const GuPopulationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGuPopulationLayers");
  const p = useKeyOverlayParams("guPopulation");
  useGuPopulationLayers(deps.mapRef, deps.layerVisibility.guPopulation, p.guPopulationOpacity ?? 0.7, p.guPopulationLevelIdx, deps.isDarkTheme);
  return null;
};

/** 規格驅動 8×2 層（規格見 data/ustDataLayers.ts）。 */
function makeUstDataHost(key: UstDataKey): LayerHostComponent {
  const spec = UST_SPEC_BY_KEY[key];
  const hookId = `use${key[0]!.toUpperCase()}${key.slice(1)}Layer`;
  const UstDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    usePhDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? spec.opacity ?? 0.85, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CategoryMask`]);
    return null;
  };
  return UstDataHost;
}

export const UST_DATA_HOSTS = {
  prTransitStops: makeUstDataHost("prTransitStops"), prTransportHubs: makeUstDataHost("prTransportHubs"), prMajorRoads: makeUstDataHost("prMajorRoads"),
  prPowerPlants: makeUstDataHost("prPowerPlants"), prPowerGrid: makeUstDataHost("prPowerGrid"), prRenewables: makeUstDataHost("prRenewables"),
  prFuelStations: makeUstDataHost("prFuelStations"), prPetroleum: makeUstDataHost("prPetroleum"),
  guTransitStops: makeUstDataHost("guTransitStops"), guTransportHubs: makeUstDataHost("guTransportHubs"), guMajorRoads: makeUstDataHost("guMajorRoads"),
  guPowerPlants: makeUstDataHost("guPowerPlants"), guPowerGrid: makeUstDataHost("guPowerGrid"), guRenewables: makeUstDataHost("guRenewables"),
  guFuelStations: makeUstDataHost("guFuelStations"), guPetroleum: makeUstDataHost("guPetroleum"),
} satisfies Record<UstDataKey, LayerHostComponent>;
