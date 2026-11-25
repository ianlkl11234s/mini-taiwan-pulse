// 中國國家包：clicks.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { GisLayerEntry } from "../../map/gisClickRegistry";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("CN", n)。 */
export const CN_PACK_CLICK_SLOTS: Readonly<Record<number, readonly GisLayerEntry[]>> = {
  1: [
  // 中國（2026-11-13 第 0–1 波，站主限定）：點、線在前，人口面、行政界最後；人口網格是 raster，不可點
  { layers: ["cn-airports-circle", "cn-ports-circle"], type: "cnTransportHubs" },
  { layers: ["cn-power-plants-circle"], type: "cnPowerPlants" },
  { layers: ["cn-lng-terminals-circle", "cn-pipelines-line", "cn-pipelines-planned-line"], type: "cnPipelines" },
  { layers: ["cn-power-substations-circle", "cn-power-lines-line"], type: "cnPowerGrid" },
  { layers: ["cn-bus-stops-circle"], type: "cnBusStops" },
  { layers: ["cn-major-rail-line", "cn-major-roads-line"], type: "cnMajorRoads" },
  // 中國第 2–5 波（2026-11-16）：點、線在前，面在後；地形、養殖、土壤是 raster，不可點
  { layers: ["cn-nuclear-plants-circle", "cn-nuclear-reactors-circle"], type: "cnNuclearPlants" },
  { layers: ["cn-medical-circle"], type: "cnMedical" },
  { layers: ["cn-schools-circle"], type: "cnSchools" },
  { layers: ["cn-bridges-tunnels-circle"], type: "cnBridgesTunnels" },
  { layers: ["cn-place-names-circle"], type: "cnPlaceNames" },
  { layers: ["cn-dams-circle", "cn-reservoirs-fill"], type: "cnDams" },
  { layers: ["cn-wdpa-circle", "cn-wdpa-fill"], type: "cnWdpa" },
  { layers: ["cn-active-faults-line"], type: "cnActiveFaults" },
  { layers: ["cn-rivers-line"], type: "cnRivers" },
  { layers: ["cn-nature-reserves-fill"], type: "cnNatureReserves" },
  { layers: ["cn-ethnic-autonomy-fill"], type: "cnEthnicAutonomy" },
  { layers: ["cn-eez-fill"], type: "cnEez" },
  { layers: ["cn-population-prefecture-fill", "cn-population-province-fill"], type: "cnPopulation" },
  { layers: ["cn-admin-prefecture-fill", "cn-admin-province-fill"], type: "cnAdminBoundaries" },
  ],
  // <codemod:append CN_PACK_CLICK_SLOTS>
};
