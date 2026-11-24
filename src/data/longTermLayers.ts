/**
 * 長期時間條要用到的圖層分類，全部由 `layerManifest.ts` 派生（不另寫對照表）。
 * 規範：docs/features/longterm-time/STANDARD.md §2 第 2–3 條。
 *
 * - 有時間條的長期圖層：manifest 寫了 `longTerm`，而且該類別的時間條與資料接線已實作
 *   （`LONG_TERM_BAR_KINDS` × `LONG_TERM_BAR_ADAPTERS`）。1b 只接了事件點的火災。
 *   其他已登記 `longTerm` 的圖層（人口、房地產）仍走歷史模式，打開它們不會換掉即時時間軸。
 * - 即時圖層：manifest `topics` 含「即時」、而且沒有 `longTerm`。
 *   manifest 沒有專門的「即時」欄位；`dataClass` C 混了大量靜態設施（電廠、加油站），sidebar 子群名
 *   也不可靠（「畜牧 Livestock」、雨量站在「點位」）。`topics` 的「即時」是唯一同時涵蓋
 *   運具、雨量、河川水位、雷達、警示的既有欄位；已知缺口：垃圾車班表三層只在子群名寫「即時」。
 */
import type { ManifestKey } from "./layerManifest";
import { allLayerKeys, getLayerEntry, layerIsLive, layerLongTermKindOf } from "./layerLookup";
import type { LongTermKind, LongTermSpec } from "./layerLongTerm";

/** 時間條已實作的類別（其餘類別先不接，元件依 kind 分派時留好擴充點）。 */
export const LONG_TERM_BAR_KINDS: ReadonlySet<LongTermKind> = new Set<LongTermKind>(["event"]);

/** 已接上時間條資料的圖層（各層的讀檔與地圖接線另寫；見 components/longTermBar/adapters）。 */
export const LONG_TERM_BAR_ADAPTERS: ReadonlySet<ManifestKey> = new Set<ManifestKey>(["fireEvents"]);

/** 完整規格（細節分層等）只在 manifest；外國圖層 P5 後要等國家包。索引只提供類別與旗標。 */
export function longTermSpecOf(key: string): LongTermSpec | null {
  return getLayerEntry(key)?.longTerm ?? null;
}

/** 這層有長期時間條可用（類別已實作且資料已接線）。 */
export function hasLongTermBar(key: string): boolean {
  const kind = layerLongTermKindOf(key);
  return !!kind && LONG_TERM_BAR_KINDS.has(kind as LongTermKind) && LONG_TERM_BAR_ADAPTERS.has(key as ManifestKey);
}

/** 依即時時間軸運作的圖層（判斷依據見檔頭）。 */
export function isLiveTimelineLayer(key: string): boolean {
  return layerIsLive(key);
}

/** 有時間條的長期圖層清單（manifest 順序）。 */
export const LONG_TERM_BAR_KEYS: readonly ManifestKey[] = (allLayerKeys() as ManifestKey[]).filter(hasLongTermBar);

/** 即時圖層清單（manifest 順序）。 */
export const LIVE_TIMELINE_KEYS: readonly ManifestKey[] = (allLayerKeys() as ManifestKey[]).filter(isLiveTimelineLayer);
