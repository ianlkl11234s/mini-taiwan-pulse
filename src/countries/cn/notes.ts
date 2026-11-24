// 中國國家包：notes.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CnLayerKey } from "./keys";
import type { SourceText } from "../../data/layerSourceInfo";

export const CN_PACK_NOTES = {
  cnTerrain: ["Terrain Tiles on AWS Open Data（Mapzen／Tilezen：SRTM、GMTED2010、ETOPO1 等）（公有領域來源＋署名）"],
  cnWdpa: ["UNEP-WCMC and IUCN, Protected Planet：World Database on Protected Areas（Nov 2026）（WDPA Terms of Use（非商用，含衍生品））"],
  // <codemod:append CN_PACK_NOTES>
} satisfies Partial<Record<CnLayerKey, SourceText[]>>;
