// 南韓國家包：panels.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { KrPopupType } from "./popupTypes";
import type { FC } from "react";
import type { PanelProps } from "../../components/featureInfo/registry";
import { KrEcologyNaturalnessPanel, KrWasteDisposalRulesPanel } from "./krEcoWastePanels";
import { KR_DATA_PANELS, KrAdminBoundariesPanel, KrAirportsPanel, KrBusStopsPanel, KrFuelStationsPanel, KrNationalRoadsPanel, KrOilGasPanel, KrPortsPanel, KrPowerLinesPanel, KrPowerPlantsPanel, KrPowerTowersPanel, KrRailLinesPanel, KrRailStationsPanel, KrRenewablesPanel, KrSubstationsPanel } from "./krPanels";

export const KR_PACK_PANELS = {
  krAdminBoundaries: KrAdminBoundariesPanel,
  krEcologyNaturalness: KrEcologyNaturalnessPanel,
  krWasteDisposalRules: KrWasteDisposalRulesPanel,
  ...KR_DATA_PANELS,
  krBusStops: KrBusStopsPanel,
  krRailStations: KrRailStationsPanel,
  krAirports: KrAirportsPanel,
  krPorts: KrPortsPanel,
  krNationalRoads: KrNationalRoadsPanel,
  krRailLines: KrRailLinesPanel,
  krFuelStations: KrFuelStationsPanel,
  krPowerPlants: KrPowerPlantsPanel,
  krRenewables: KrRenewablesPanel,
  krPowerLines: KrPowerLinesPanel,
  krSubstations: KrSubstationsPanel,
  krPowerTowers: KrPowerTowersPanel,
  krOilGas: KrOilGasPanel,
  // <codemod:append KR_PACK_PANELS>
} satisfies Partial<Record<KrPopupType, FC<PanelProps>>>;
