// 印尼國家包：sourceInfo.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IdLayerKey } from "./keys";
import type { LayerSourceInfo } from "../../data/layerSourceInfo";
import { ID_SOURCE_INFO } from "./idDataLayers";

export const ID_PACK_SOURCE_INFO = {
  ...ID_SOURCE_INFO,
  // <codemod:append ID_PACK_SOURCE_INFO>
} satisfies Partial<Record<IdLayerKey, LayerSourceInfo>>;
