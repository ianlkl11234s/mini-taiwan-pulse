// 南韓國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { KrAdminBoundariesLegend } from "../../components/legend/urbanFormLegends";
import { KR_DATA_KEYS } from "./keys";
import { KrEcologyNaturalnessLegend, KrWasteDisposalRulesLegend } from "./krEcoWasteLegends";
import { KrAirportsLegend, KrBusStopsLegend, KrDataLegend, KrFuelStationsLegend, KrNationalRoadsLegend, KrOilGasLegend, KrPortsLegend, KrPowerLinesLegend, KrPowerPlantsLegend, KrPowerTowersLegend, KrRailLinesLegend, KrRailStationsLegend, KrRenewablesLegend, KrSubstationsLegend } from "./krLegends";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("KR", n)。 */
export const KR_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "krAdminBoundaries", render: () => <KrAdminBoundariesLegend /> },
  { id: "krEcologyNaturalness", render: () => <KrEcologyNaturalnessLegend /> },
  { id: "krWasteDisposalRules", render: () => <KrWasteDisposalRulesLegend /> },
  // 南韓第 3–5 波 18 層：共用規格驅動圖例
  ...KR_DATA_KEYS.map((key) => ({ id: key, render: () => <KrDataLegend layerKey={key} /> })),
  { id: "krAirports", render: () => <KrAirportsLegend /> },
  { id: "krBusStops", render: () => <KrBusStopsLegend /> },
  { id: "krFuelStations", render: () => <KrFuelStationsLegend /> },
  { id: "krNationalRoads", render: () => <KrNationalRoadsLegend /> },
  { id: "krOilGas", render: () => <KrOilGasLegend /> },
  ],
  2: [
  { id: "krPorts", render: () => <KrPortsLegend /> },
  { id: "krPowerLines", render: () => <KrPowerLinesLegend /> },
  { id: "krPowerPlants", render: () => <KrPowerPlantsLegend /> },
  { id: "krPowerTowers", render: () => <KrPowerTowersLegend /> },
  { id: "krRailLines", render: () => <KrRailLinesLegend /> },
  { id: "krRailStations", render: () => <KrRailStationsLegend /> },
  { id: "krRenewables", render: () => <KrRenewablesLegend /> },
  { id: "krSubstations", render: () => <KrSubstationsLegend /> },
  ],
  // <codemod:append KR_PACK_LEGEND_SLOTS>
};
