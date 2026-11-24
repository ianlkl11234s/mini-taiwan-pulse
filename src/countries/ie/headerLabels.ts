// 愛爾蘭國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IePopupType } from "./popupTypes";
import { IE_DATA_SPECS } from "./ieDataLayers";
import { type IeDataKey } from "./keys";

const IE_HEADER_LABELS = Object.fromEntries(IE_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<IeDataKey, string>;


export const IE_PACK_HEADER_LABELS = {
  ieAdminBoundaries: "行政邊界 Administrative Boundaries",
  ...IE_HEADER_LABELS,
  ieCoillteRecreation: "Coillte 國有林遊憩點 Coillte Recreation",
  ieCoillteForestRoads: "Coillte 林道與步道 Coillte Forest Roads",
  // <codemod:append IE_PACK_HEADER_LABELS>
} satisfies Record<IePopupType, string>;
