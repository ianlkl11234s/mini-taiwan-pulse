// 印尼國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { IdAdminBoundariesLegend, IdDataLegend, IdPopulationLegend, IdRasterLegend, IdRuralDevelopmentLegend } from "./idLegends";
import { ID_DATA_KEYS, ID_RASTER_KEYS } from "./keys";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("ID", n)。 */
export const ID_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "idAdminBoundaries", render: () => <IdAdminBoundariesLegend /> },
  { id: "idPopulation", render: () => <IdPopulationLegend /> },
  { id: "idRuralDevelopment", render: () => <IdRuralDevelopmentLegend /> },
  ...ID_DATA_KEYS.map((key) => ({ id: key, render: () => <IdDataLegend layerKey={key} /> })),
  ...ID_RASTER_KEYS.map((key) => ({ id: key, render: () => <IdRasterLegend layerKey={key} /> })),
  ],
  // <codemod:append ID_PACK_LEGEND_SLOTS>
};
