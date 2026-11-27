// 菲律賓國家包：panels.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { PhPopupType } from "./popupTypes";
import type { FC } from "react";
import type { PanelProps } from "../../components/featureInfo/registry";
import { PH_DATA_PANELS, PhAdminBoundariesPanel, PhOpenaqAirPanel, PhPopulationPanel } from "./phPanels";

export const PH_PACK_PANELS = {
  phAdminBoundaries: PhAdminBoundariesPanel,
  phPopulation: PhPopulationPanel,
  phOpenaqAir: PhOpenaqAirPanel,
  ...PH_DATA_PANELS,
  // <codemod:append PH_PACK_PANELS>
} satisfies Partial<Record<PhPopupType, FC<PanelProps>>>;
