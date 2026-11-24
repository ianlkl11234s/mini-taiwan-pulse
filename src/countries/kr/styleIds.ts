// 南韓國家包：規格層自建的 style layer id（視野提示卡判斷「看不到」用，map/layerVisibilityHint）（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import { KR_DATA_SPECS } from "./krDataLayers";

export const KR_PACK_STYLE_IDS: Record<string, readonly string[]> = Object.fromEntries(
  KR_DATA_SPECS.map((spec) => [spec.key, [spec.layerId]] as const),
);
