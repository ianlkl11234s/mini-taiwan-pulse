// 中國國家包：hosts.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LayerHookEntry } from "../../layers/layerHookRegistry";
import { CnActiveFaultsHost, CnAdminHost, CnAquacultureHost, CnBridgesTunnelsHost, CnBusStopsHost, CnDamsHost, CnEezHost, CnEthnicAutonomyHost, CnMajorRoadsHost, CnMedicalHost, CnNatureReservesHost, CnNuclearPlantsHost, CnPipelinesHost, CnPlaceNamesHost, CnPopulationGridHost, CnPopulationHost, CnPowerGridHost, CnPowerPlantsHost, CnRiversHost, CnSchoolsHost, CnSoilHost, CnTerrainHost, CnTransportHubsHost, CnWdpaHost } from "./chinaHosts";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("CN", n)。 */
export const CN_PACK_HOST_SLOTS: Readonly<Record<number, readonly LayerHookEntry[]>> = {
  1: [
  // 中國（2026-11-13 第 0–1 波，站主限定私人圖磚：行政邊界、人口、人口網格、交通 3 層、能源 3 層）
  { id: "useCnAdminLayers", keys: ["cnAdminBoundaries"], Host: CnAdminHost },
  { id: "useCnPopulationLayers", keys: ["cnPopulation"], Host: CnPopulationHost },
  { id: "useCnPopulationGridLayer", keys: ["cnPopulationGrid"], Host: CnPopulationGridHost },
  { id: "useCnBusStopsLayer", keys: ["cnBusStops"], Host: CnBusStopsHost },
  { id: "useCnTransportHubsLayer", keys: ["cnTransportHubs"], Host: CnTransportHubsHost },
  { id: "useCnMajorRoadsLayer", keys: ["cnMajorRoads"], Host: CnMajorRoadsHost },
  { id: "useCnPowerPlantsLayer", keys: ["cnPowerPlants"], Host: CnPowerPlantsHost },
  { id: "useCnPowerGridLayer", keys: ["cnPowerGrid"], Host: CnPowerGridHost },
  { id: "useCnPipelinesLayer", keys: ["cnPipelines"], Host: CnPipelinesHost },
  // 中國第 2–5 波（2026-11-16，站主限定）：向量 12 層＋raster 3 層
  { id: "useCnEezLayer", keys: ["cnEez"], Host: CnEezHost },
  { id: "useCnPlaceNamesLayer", keys: ["cnPlaceNames"], Host: CnPlaceNamesHost },
  { id: "useCnEthnicAutonomyLayer", keys: ["cnEthnicAutonomy"], Host: CnEthnicAutonomyHost },
  { id: "useCnDamsLayer", keys: ["cnDams"], Host: CnDamsHost },
  { id: "useCnRiversLayer", keys: ["cnRivers"], Host: CnRiversHost },
  { id: "useCnActiveFaultsLayer", keys: ["cnActiveFaults"], Host: CnActiveFaultsHost },
  { id: "useCnNatureReservesLayer", keys: ["cnNatureReserves"], Host: CnNatureReservesHost },
  { id: "useCnWdpaLayer", keys: ["cnWdpa"], Host: CnWdpaHost },
  { id: "useCnBridgesTunnelsLayer", keys: ["cnBridgesTunnels"], Host: CnBridgesTunnelsHost },
  { id: "useCnSchoolsLayer", keys: ["cnSchools"], Host: CnSchoolsHost },
  { id: "useCnMedicalLayer", keys: ["cnMedical"], Host: CnMedicalHost },
  { id: "useCnNuclearPlantsLayer", keys: ["cnNuclearPlants"], Host: CnNuclearPlantsHost },
  { id: "useCnTerrainLayer", keys: ["cnTerrain"], Host: CnTerrainHost },
  { id: "useCnAquacultureLayer", keys: ["cnAquaculture"], Host: CnAquacultureHost },
  { id: "useCnSoilLayer", keys: ["cnSoil"], Host: CnSoilHost },
  ],
  // <codemod:append CN_PACK_HOST_SLOTS>
};
