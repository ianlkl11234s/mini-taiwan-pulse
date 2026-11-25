// 加拿大國家包：規格層 popupNotes 的固定備註（圖層側說明）（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import { specLayerNotes } from "../../data/layerSourceInfo";
import type { SourceText } from "../../data/layerSourceInfo";
import { CA_WAVE_SPECS } from "./caWavesLayers";

export const CA_PACK_SPEC_NOTES: Record<string, SourceText[]> = Object.fromEntries(
  CA_WAVE_SPECS.map((spec) => [spec.key, specLayerNotes(spec)] as const).filter(([, notes]) => notes.length > 0),
);
