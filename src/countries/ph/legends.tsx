// 菲律賓國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { PH_DATA_KEYS, PH_RASTER_KEYS } from "./keys";
import { PhAdminBoundariesLegend, PhDataLegend, PhOpenaqAirLegend, PhPopulationLegend, PhRasterLegend } from "./phLegends";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("PH", n)。 */
export const PH_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "phAdminBoundaries", render: () => <PhAdminBoundariesLegend /> },
  { id: "phPopulation", render: () => <PhPopulationLegend /> },
  { id: "phOpenaqAir", render: () => <PhOpenaqAirLegend /> },
  ...PH_DATA_KEYS.map((key) => ({ id: key, render: () => <PhDataLegend layerKey={key} /> })),
  ...PH_RASTER_KEYS.map((key) => ({ id: key, render: () => <PhRasterLegend layerKey={key} /> })),
  ],
  // <codemod:append PH_PACK_LEGEND_SLOTS>
};
