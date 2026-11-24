/**
 * 跨國規格橋接（B1 P2，2026-11-24）：愛爾蘭的規格型別沿用南韓規格引擎（只差 key 型別與 popup 欄位種類），
 * 南韓 hook／篩選要的是 key 為 `KrDataKey` 的型別。轉型放在這個中性檔，愛爾蘭檔就不必 import 南韓檔。
 * 只有組裝層（host、參數規格）可以 import 本檔。
 */
import type { IeLayerSpec } from "../countries/ie/ieDataLayers";
import type { KrLayerSpec } from "../countries/kr/krDataLayers";

/** 南韓規格驅動 hook／篩選共用同一套畫法：IE 規格只差 key 型別與 popup 欄位種類（hook 不讀 fields）。 */
export const asKrSpec = (spec: IeLayerSpec): KrLayerSpec => spec as unknown as KrLayerSpec;
