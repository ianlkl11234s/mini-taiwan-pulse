// 泰國國家包：panels.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { ThPopupType } from "./popupTypes";
import type { FC } from "react";
import type { PanelProps } from "../../components/featureInfo/registry";
import { TH_DATA_PANELS, ThAdminBoundariesPanel, ThPopulationPanel } from "./thPanels";

export const TH_PACK_PANELS = {
  thAdminBoundaries: ThAdminBoundariesPanel,
  thPopulation: ThPopulationPanel,
  ...TH_DATA_PANELS,
  // <codemod:append TH_PACK_PANELS>
} satisfies Partial<Record<ThPopupType, FC<PanelProps>>>;
