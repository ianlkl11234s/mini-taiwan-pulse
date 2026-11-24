// 中國國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CnPopupType } from "./popupTypes";
import { CN_DATA_SPECS } from "./cnDataLayers";
import { type CnDataKey } from "./keys";

const CN_HEADER_LABELS = Object.fromEntries(CN_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<CnDataKey, string>;


export const CN_PACK_HEADER_LABELS = {
  cnAdminBoundaries: "行政邊界 Administrative Boundaries",
  cnPopulation: "人口密度 Population Density",
  ...CN_HEADER_LABELS,
  // <codemod:append CN_PACK_HEADER_LABELS>
} satisfies Record<CnPopupType, string>;
