// 泰國國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { ThPopupType } from "./popupTypes";
import { type ThDataKey } from "./keys";
import { TH_DATA_SPECS } from "./thDataLayers";

const TH_HEADER_LABELS = Object.fromEntries(TH_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<ThDataKey, string>;


export const TH_PACK_HEADER_LABELS = {
  thAdminBoundaries: "行政邊界 Administrative Boundaries",
  thPopulation: "人口密度 Population Density",
  ...TH_HEADER_LABELS,
  // <codemod:append TH_PACK_HEADER_LABELS>
} satisfies Record<ThPopupType, string>;
