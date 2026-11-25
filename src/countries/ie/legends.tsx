// 愛爾蘭國家包：legends.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { LegendEntry } from "../../components/LegendPanel";
import { DenseHeatmapLegendRow } from "../../components/legend/legendShared";
import { IE_COILLTE_FOREST_ROADS, IE_COILLTE_RECREATION } from "./ieCoillteTypes";
import { IeAdminBoundariesLegend, IeBathymetryLegend, IeDataLegend, IeSpecLegend } from "./ieLegends";
import { IE_DATA_KEYS } from "./keys";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("IE", n)。 */
export const IE_PACK_LEGEND_SLOTS: Readonly<Record<number, readonly LegendEntry[]>> = {
  1: [
  { id: "ieAdminBoundaries", render: () => <IeAdminBoundariesLegend /> },
  // 愛爾蘭第 1 波：規格驅動 6 層＋海床地形
  ...IE_DATA_KEYS.map((key) => ({ id: key, render: () => <IeDataLegend layerKey={key} /> })),
  ],
  2: [
  { id: "ieCoillteRecreation", render: () => <IeSpecLegend layerKey="ieCoillteRecreation" spec={IE_COILLTE_RECREATION}><DenseHeatmapLegendRow layers={["ieCoillteRecreation"]} /></IeSpecLegend> },
  { id: "ieCoillteForestRoads", render: () => <IeSpecLegend layerKey="ieCoillteForestRoads" spec={IE_COILLTE_FOREST_ROADS} /> },
  { id: "ieBathymetry", render: () => <IeBathymetryLegend /> },
  ],
  // <codemod:append IE_PACK_LEGEND_SLOTS>
};
