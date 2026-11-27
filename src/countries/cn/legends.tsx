// 中國國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { CnAdminBoundariesLegend, CnDataLegend, CnPopulationGridLegend, CnPopulationLegend, CnRasterLegend } from "./cnLegends";
import { CN_DATA_KEYS, CN_RASTER_KEYS } from "./keys";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("CN", n)。 */
export const CN_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  // 中國第 0–1 波（站主限定）
  { id: "cnAdminBoundaries", render: () => <CnAdminBoundariesLegend /> },
  { id: "cnPopulation", render: () => <CnPopulationLegend /> },
  { id: "cnPopulationGrid", render: () => <CnPopulationGridLegend /> },
  ...CN_DATA_KEYS.map((key) => ({ id: key, render: () => <CnDataLegend layerKey={key} /> })),
  ...CN_RASTER_KEYS.map((key) => ({ id: key, render: () => <CnRasterLegend layerKey={key} /> })),
  ],
  // <codemod:append CN_PACK_LEGEND_SLOTS>
};
