// 越南國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { VnPopupType } from "./popupTypes";
import { type VnDataKey } from "./keys";
import { VN_DATA_SPECS } from "./vnDataLayers";

const VN_HEADER_LABELS = Object.fromEntries(VN_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<VnDataKey, string>;


export const VN_PACK_HEADER_LABELS = {
  vnAdminBoundaries: "行政邊界 Administrative Boundaries",
  vnPopulation: "人口密度 Population Density",
  ...VN_HEADER_LABELS,
  // <codemod:append VN_PACK_HEADER_LABELS>
} satisfies Record<VnPopupType, string>;
