// 加拿大國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { PhSpecLegend } from "../ph/phLegends";
import { CaAqhiStationsLegend, CaClimateStationsLegend, CaEarthquakesLegend, CaEarthquakesLiveLegend, CaNpriFacilitiesLegend, CaPopulationGridLegend, CaRadiationStationsLegend, CaWastewaterSystemsLegend } from "./caEnvLegends";
import { CaAdminBoundariesLegend, CaAirportsPortsLegend, CaDeprivationLegend, CaFederalDistrictsLegend, CaHillshadeLegend, CaIndigenousLandsLegend, CaMajorRoadsLegend, CaOilGasLegend, CaPlaceNamesLegend, CaPopulationCentresLegend, CaPostalFsaLegend, CaPowerGridLegend, CaPowerPlantsLegend, CaRailwaysLegend, CaRentsLegend, CaTransitStopsLegend, CaWindTurbinesLegend } from "./caLegends";
import { CA_WAVE_SPEC_BY_KEY } from "./caWavesLayers";
import { CA_WAVE_KEYS } from "./keys";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("CA", n)。 */
export const CA_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "caAdminBoundaries", render: () => <CaAdminBoundariesLegend /> },
  ],
  2: [
  // 加拿大第 3–8 波（2026-11-17）：規格驅動 36 層，重用菲律賓 PhSpecLegend
  ...CA_WAVE_KEYS.map((key) => ({ id: key, render: () => <PhSpecLegend spec={CA_WAVE_SPEC_BY_KEY[key]} /> })),
  ],
  3: [
  { id: "caTransitStops", render: () => <CaTransitStopsLegend /> },
  { id: "caAirportsPorts", render: () => <CaAirportsPortsLegend /> },
  { id: "caMajorRoads", render: () => <CaMajorRoadsLegend /> },
  { id: "caRailways", render: () => <CaRailwaysLegend /> },
  { id: "caPowerPlants", render: () => <CaPowerPlantsLegend /> },
  { id: "caWindTurbines", render: () => <CaWindTurbinesLegend /> },
  { id: "caPowerGrid", render: () => <CaPowerGridLegend /> },
  { id: "caOilGas", render: () => <CaOilGasLegend /> },
  { id: "caPopulationCentres", render: () => <CaPopulationCentresLegend /> },
  { id: "caFederalDistricts", render: () => <CaFederalDistrictsLegend /> },
  { id: "caPostalFsa", render: () => <CaPostalFsaLegend /> },
  { id: "caIndigenousLands", render: () => <CaIndigenousLandsLegend /> },
  { id: "caDeprivation", render: () => <CaDeprivationLegend /> },
  { id: "caRents", render: () => <CaRentsLegend /> },
  { id: "caPlaceNames", render: () => <CaPlaceNamesLegend /> },
  { id: "caHillshade", render: () => <CaHillshadeLegend /> },
  { id: "caClimateStations", render: () => <CaClimateStationsLegend /> },
  { id: "caAqhiStations", render: () => <CaAqhiStationsLegend /> },
  { id: "caRadiationStations", render: () => <CaRadiationStationsLegend /> },
  { id: "caNpriFacilities", render: () => <CaNpriFacilitiesLegend /> },
  { id: "caWastewaterSystems", render: () => <CaWastewaterSystemsLegend /> },
  { id: "caEarthquakes", render: () => <CaEarthquakesLegend /> },
  { id: "caEarthquakesLive", render: () => <CaEarthquakesLiveLegend /> },
  { id: "caPopulationGrid", render: () => <CaPopulationGridLegend /> },
  ],
  // <codemod:append CA_PACK_LEGEND_SLOTS>
};
