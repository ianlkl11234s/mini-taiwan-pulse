// 中國國家包：panels.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CnPopupType } from "./popupTypes";
import type { FC } from "react";
import type { PanelProps } from "../../components/featureInfo/registry";
import { CN_DATA_PANELS, CnAdminBoundariesPanel, CnPopulationPanel } from "./cnPanels";

export const CN_PACK_PANELS = {
  cnAdminBoundaries: CnAdminBoundariesPanel,
  cnPopulation: CnPopulationPanel,
  ...CN_DATA_PANELS,
  // <codemod:append CN_PACK_PANELS>
} satisfies Partial<Record<CnPopupType, FC<PanelProps>>>;
