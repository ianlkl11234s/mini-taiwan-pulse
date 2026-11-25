// 加拿大國家包：panels.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CaPopupType } from "./popupTypes";
import type { FC } from "react";
import type { PanelProps } from "../../components/featureInfo/registry";
import { makePhPanel } from "../../components/featureInfo/intlSpecPanel";
import { CaAqhiStationsPanel, CaClimateStationsPanel, CaEarthquakesLivePanel, CaEarthquakesPanel, CaNpriFacilitiesPanel, CaPopulationGridPanel, CaRadiationStationsPanel, CaWastewaterSystemsPanel } from "./caEnvPanels";
import { CaAdminBoundariesPanel, CaAirportsPortsPanel, CaDeprivationPanel, CaFederalDistrictsPanel, CaIndigenousLandsPanel, CaMajorRoadsPanel, CaOilGasPanel, CaPlaceNamesPanel, CaPopulationCentresPanel, CaPostalFsaPanel, CaPowerGridPanel, CaPowerPlantsPanel, CaRailwaysPanel, CaRentsPanel, CaTransitStopsPanel, CaWindTurbinesPanel } from "./caPanels";
import { CA_WAVE_SPECS } from "./caWavesLayers";
import { type CaWaveKey } from "./keys";

/** 加拿大第 3–8 波（2026-11-17）：規格驅動，popup 重用 makePhPanel（自掛 SourceFooter）。 */
const CA_WAVE_PANELS = Object.fromEntries(CA_WAVE_SPECS.map((s) => [s.key, makePhPanel(s)])) as Record<CaWaveKey, ReturnType<typeof makePhPanel>>;


export const CA_PACK_PANELS = {
  caAdminBoundaries: CaAdminBoundariesPanel,
  ...CA_WAVE_PANELS,
  caTransitStops: CaTransitStopsPanel,
  caAirportsPorts: CaAirportsPortsPanel,
  caMajorRoads: CaMajorRoadsPanel,
  caRailways: CaRailwaysPanel,
  caPowerPlants: CaPowerPlantsPanel,
  caWindTurbines: CaWindTurbinesPanel,
  caPowerGrid: CaPowerGridPanel,
  caOilGas: CaOilGasPanel,
  caPopulationCentres: CaPopulationCentresPanel,
  caFederalDistricts: CaFederalDistrictsPanel,
  caPostalFsa: CaPostalFsaPanel,
  caIndigenousLands: CaIndigenousLandsPanel,
  caDeprivation: CaDeprivationPanel,
  caRents: CaRentsPanel,
  caPlaceNames: CaPlaceNamesPanel,
  caClimateStations: CaClimateStationsPanel,
  caAqhiStations: CaAqhiStationsPanel,
  caRadiationStations: CaRadiationStationsPanel,
  caNpriFacilities: CaNpriFacilitiesPanel,
  caWastewaterSystems: CaWastewaterSystemsPanel,
  caEarthquakes: CaEarthquakesPanel,
  caEarthquakesLive: CaEarthquakesLivePanel,
  caPopulationGrid: CaPopulationGridPanel,
  // <codemod:append CA_PACK_PANELS>
} satisfies Partial<Record<CaPopupType, FC<PanelProps>>>;
