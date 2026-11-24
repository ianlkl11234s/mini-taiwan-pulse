// 越南國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { VN_DATA_KEYS, VN_RASTER_KEYS } from "./keys";
import { VnAdminBoundariesLegend, VnDataLegend, VnPopulationLegend, VnRasterLegend } from "./vnLegends";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("VN", n)。 */
export const VN_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "vnAdminBoundaries", render: () => <VnAdminBoundariesLegend /> },
  { id: "vnPopulation", render: () => <VnPopulationLegend /> },
  ...VN_DATA_KEYS.map((key) => ({ id: key, render: () => <VnDataLegend layerKey={key} /> })),
  ],
  2: [
  ...VN_RASTER_KEYS.map((key) => ({ id: key, render: () => <VnRasterLegend layerKey={key} /> })),
  ],
  // <codemod:append VN_PACK_LEGEND_SLOTS>
};
