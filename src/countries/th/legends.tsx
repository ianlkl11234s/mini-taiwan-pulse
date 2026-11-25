// 泰國國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { TH_DATA_KEYS, TH_RASTER_KEYS } from "./keys";
import { ThAdminBoundariesLegend, ThDataLegend, ThPopulationLegend, ThRasterLegend } from "./thLegends";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("TH", n)。 */
export const TH_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "thAdminBoundaries", render: () => <ThAdminBoundariesLegend /> },
  { id: "thPopulation", render: () => <ThPopulationLegend /> },
  ...TH_DATA_KEYS.map((key) => ({ id: key, render: () => <ThDataLegend layerKey={key} /> })),
  ...TH_RASTER_KEYS.map((key) => ({ id: key, render: () => <ThRasterLegend layerKey={key} /> })),
  ],
  // <codemod:append TH_PACK_LEGEND_SLOTS>
};
