/**
 * 外國圖層索引的型別與同步讀法（B1 P3）。
 *
 * 索引（layerIndex.generated.ts）只放外國圖層；台灣、世界、模擬與 orphan 仍由完整 manifest 靜態載入。
 * 「需要全部國家」的同步讀者（顏色、icon、站主限定、國家歸屬、載入標籤、長期／即時、資料時區）讀
 * 「manifest 的非外國 entry ＋ 索引」，國家包搬家（P5）後不再需要外國 manifest。
 * 本階段外國 manifest 仍然存在，兩份必須一致，由 layerIndex.test 逐欄比對。
 *
 * 欄位（省略＝無）：
 *  - country／name／section／color／icon（lucide 識別名，用 LAYER_INDEX_ICONS 對照元件）
 *  - gated：站主限定（manifest topics 含 OWNER_ONLY，同 GATED_LAYERS 口徑）
 *  - expandable、popup（FeatureInfo layerType）、legend（圖例群組 id）；兩者與 key 同名時省略（用 indexPopup／indexLegend 讀）
 *  - dataTimeZone：上游切日的 IANA 時區（缺＝Asia/Taipei）
 *  - longTerm：長期時間條類別；live：即時時間軸圖層（topics 含「即時」且無 longTerm）
 *  - mo／po：國家包的 key 在 manifest／params 宣告順序中的位置（錨點＝前一個靜態 key、全域序號），包載入後排回原位
 *  - draw：OVERLAY_REGISTRY 內第一筆 config 的序號（疊放順序）；click：GIS_LAYERS 內第一筆對應 popup 的序號（first-hit-wins）
 */
import type { LucideIcon } from "lucide-react";
import type { CountryCode } from "../constants/countries";
import type { LayerName } from "./layerManifest";
import type { LongTermKind } from "./layerLongTerm";
import { LAYER_INDEX, LAYER_INDEX_ICONS } from "./layerIndex.generated";

export interface LayerIndexRow {
  country: CountryCode;
  name: LayerName;
  section: { theme: string; group: string };
  color: string;
  icon: string;
  gated?: true;
  expandable?: boolean;
  /** 省略＝與 key 同名；null＝沒有 */
  popup?: string | readonly string[] | null;
  /** 省略＝與 key 同名；null＝沒有 */
  legend?: string | null;
  dataTimeZone?: string;
  longTerm?: LongTermKind;
  live?: true;
  draw?: number;
  click?: number;
  /** 國家包的 key：manifest／params 宣告順序提示 [前一個靜態 key, 全域序號]（slots.setRecordOrder） */
  mo?: readonly [string, number];
  po?: readonly [string, number];
}

export type IndexedLayerKey = keyof typeof LAYER_INDEX;

const INDEX: Readonly<Record<string, LayerIndexRow>> = LAYER_INDEX;

/** 這個 key 是否由索引提供（外國圖層）。 */
export function isIndexedKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(INDEX, key);
}

export function layerIndexRow(key: string): LayerIndexRow | undefined {
  return isIndexedKey(key) ? INDEX[key] : undefined;
}

export const INDEXED_LAYER_KEYS = Object.keys(LAYER_INDEX) as IndexedLayerKey[];

export function indexColors(): Record<IndexedLayerKey, string> {
  return Object.fromEntries(INDEXED_LAYER_KEYS.map((k) => [k, (INDEX[k] as LayerIndexRow).color])) as Record<IndexedLayerKey, string>;
}

export function indexIcons(): Record<IndexedLayerKey, LucideIcon> {
  return Object.fromEntries(INDEXED_LAYER_KEYS.map((k) => {
    const name = (INDEX[k] as LayerIndexRow).icon;
    const icon = LAYER_INDEX_ICONS[name];
    if (!icon) throw new Error(`layerIndex：${k} 的 icon「${name}」不在 LAYER_INDEX_ICONS`);
    return [k, icon];
  })) as Record<IndexedLayerKey, LucideIcon>;
}

export function indexGatedKeys(): IndexedLayerKey[] {
  return INDEXED_LAYER_KEYS.filter((k) => (INDEX[k] as LayerIndexRow).gated);
}

/** popup layerType：省略＝與 key 同名。 */
export function indexPopup(key: string): string | readonly string[] | null {
  const row = layerIndexRow(key);
  return row && row.popup === undefined ? key : (row?.popup ?? null);
}

/** 圖例群組 id：省略＝與 key 同名。 */
export function indexLegend(key: string): string | null {
  const row = layerIndexRow(key);
  return row && row.legend === undefined ? key : (row?.legend ?? null);
}
