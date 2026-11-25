// 愛爾蘭國家包：panels.tsx（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IePopupType } from "./popupTypes";
import type { FC } from "react";
import type { PanelProps } from "../../components/featureInfo/registry";
import { IE_COILLTE_FOREST_ROADS, IE_COILLTE_RECREATION } from "./ieCoillteTypes";
import { IE_DATA_PANELS, IeAdminBoundariesPanel, makeIePanel } from "./iePanels";

export const IE_PACK_PANELS = {
  ieAdminBoundaries: IeAdminBoundariesPanel,
  ...IE_DATA_PANELS,
  ieCoillteRecreation: makeIePanel(IE_COILLTE_RECREATION),
  ieCoillteForestRoads: makeIePanel(IE_COILLTE_FOREST_ROADS),
  // <codemod:append IE_PACK_PANELS>
} satisfies Partial<Record<IePopupType, FC<PanelProps>>>;
