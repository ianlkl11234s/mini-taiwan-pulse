/**
 * 同步讀者的統一入口（B1 P3）：「manifest 的非外國 entry ＋ 外國索引」。
 *
 * - 外國圖層（索引有的 key）只讀索引；其他（TW／WORLD／SIM／orphan）讀完整 manifest。
 * - 本階段外國 manifest 仍靜態存在，所以結果與直接讀 manifest 完全相同（layerIndex.test 逐欄驗證）；
 *   P5 外國 manifest 搬進國家包後，這裡不用改，讀者就不再依賴外國 manifest。
 * - `getLayerEntry(key)` 是取完整 manifest entry 的唯一入口：P5 起外國 entry 只在國家包載入後才有，
 *   屆時這裡改成包沒載入就 throw／觸發載入（本階段同步回傳）。ESLint 禁直接 import LAYER_MANIFEST 留到 P5。
 */
import type { LucideIcon } from "lucide-react";
import type { CountryCode } from "../constants/countries";
import { isCountryCode } from "../constants/countries";
import { LAYER_MANIFEST, MANIFEST_KEYS, manifestColors, manifestIcons, type LayerManifestEntry, type LayerName, type ManifestKey } from "./layerManifest";
import { indexColors, indexIcons, isIndexedKey, layerIndexRow, INDEXED_LAYER_KEYS } from "./layerIndex";

/** 完整 manifest entry（含外國）。P5 前同步回傳。 */
export function getLayerEntry(key: string): LayerManifestEntry | undefined {
  return (LAYER_MANIFEST as Record<string, LayerManifestEntry | undefined>)[key];
}

/** 不由索引提供的 manifest key（TW／WORLD／SIM／orphan）。 */
const LOCAL_KEYS: readonly ManifestKey[] = MANIFEST_KEYS.filter((k) => !isIndexedKey(k));

/** 全部圖層 key：本地 manifest ＋ 索引（順序：本地在前）。 */
export function allLayerKeys(): string[] {
  return [...LOCAL_KEYS, ...INDEXED_LAYER_KEYS];
}

/** LAYER_COLORS：本地 manifest ＋ 索引。型別維持完整 Record，tsc 護欄不弱化。 */
export function layerColorTable(): Record<ManifestKey, string> {
  const all = manifestColors();
  const out = {} as Record<ManifestKey, string>;
  for (const k of LOCAL_KEYS) out[k] = all[k];
  return Object.assign(out, indexColors());
}

/** LAYER_ICONS：本地 manifest ＋ 索引。 */
export function layerIconTable(): Record<ManifestKey, LucideIcon> {
  const all = manifestIcons();
  const out = {} as Record<ManifestKey, LucideIcon>;
  for (const k of LOCAL_KEYS) out[k] = all[k];
  return Object.assign(out, indexIcons());
}

/** 站主限定：manifest topics 含 OWNER_ONLY（本地）＋索引 gated。 */
export function layerGatedKeys(): ManifestKey[] {
  const local = LOCAL_KEYS.filter((k) => (LAYER_MANIFEST[k] as LayerManifestEntry).topics.includes("OWNER_ONLY"));
  const indexed = INDEXED_LAYER_KEYS.filter((k) => layerIndexRow(k)?.gated);
  return [...local, ...indexed] as ManifestKey[];
}

/** 上架在國家主題樹的圖層所屬國家（世界、模擬、orphan 回 undefined）。 */
export function layerCountryOf(key: string): CountryCode | undefined {
  const row = layerIndexRow(key);
  if (row) return row.country;
  const entry = getLayerEntry(key);
  const country = entry?.section !== null ? entry?.country : undefined;
  return isCountryCode(country) ? country : undefined;
}

/** 結構化名稱（載入標籤用）；orphan 沒有。 */
export function layerNameOf(key: string): LayerName | undefined {
  return layerIndexRow(key)?.name ?? getLayerEntry(key)?.name;
}

/** 上游切日的 IANA 時區；沒宣告回 undefined（呼叫端當台北）。 */
export function layerDataTimeZoneOf(key: string): string | undefined {
  const row = layerIndexRow(key);
  if (row) return row.dataTimeZone;
  return (getLayerEntry(key) as { dataTimeZone?: string } | undefined)?.dataTimeZone;
}

/** 長期時間條類別（沒有回 undefined）與是否為即時時間軸圖層。 */
export function layerLongTermKindOf(key: string): string | undefined {
  const row = layerIndexRow(key);
  if (row) return row.longTerm;
  return getLayerEntry(key)?.longTerm?.kind;
}

export function layerIsLive(key: string): boolean {
  const row = layerIndexRow(key);
  if (row) return !!row.live;
  const e = getLayerEntry(key);
  return !!e && !e.longTerm && e.topics.includes("即時");
}
