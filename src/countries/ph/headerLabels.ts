// 菲律賓國家包：headerLabels.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { PhPopupType } from "./popupTypes";
import { type PhDataKey } from "./keys";
import { PH_DATA_SPECS } from "./phDataLayers";

const PH_HEADER_LABELS = Object.fromEntries(PH_DATA_SPECS.map((s) => [s.key, `${s.title.fallback.zh} ${s.title.fallback.en}`])) as Record<PhDataKey, string>;


export const PH_PACK_HEADER_LABELS = {
  phAdminBoundaries: "行政邊界 Administrative Boundaries",
  phPopulation: "人口密度 Population Density",
  phOpenaqAir: "即時空品 Air Quality（OpenAQ）",
  ...PH_HEADER_LABELS,
  // <codemod:append PH_PACK_HEADER_LABELS>
} satisfies Record<PhPopupType, string>;
