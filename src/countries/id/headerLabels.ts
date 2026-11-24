// 印尼國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IdPopupType } from "./popupTypes";
import { ID_DATA_SPECS } from "./idDataLayers";
import { type IdDataKey } from "./keys";

const ID_HEADER_LABELS = Object.fromEntries(ID_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<IdDataKey, string>;


export const ID_PACK_HEADER_LABELS = {
  idAdminBoundaries: "行政邊界 Administrative Boundaries",
  idPopulation: "人口密度 Population Density",
  idRuralDevelopment: "農村發展指數 Village Development Index",
  ...ID_HEADER_LABELS,
  // <codemod:append ID_PACK_HEADER_LABELS>
} satisfies Record<IdPopupType, string>;
