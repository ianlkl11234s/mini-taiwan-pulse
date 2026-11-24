/**
 * 兩國並排（比較模式 `countries`，G2-1）的圖層側別：**由 manifest 的 `country` 決定**，使用者不必逐層指定。
 *
 * - 右側國家的圖層畫在右圖；其他國家（含 WORLD／SIM）一律畫在左圖（主地圖）。
 * - 走 `OVERLAY_REGISTRY` 的右國圖層（G2-1b）：右圖自己掛一份 overlay（`CountryCompareMapView`），
 *   hydrate 紀錄以地圖實例分開；主地圖的 overlay 管理器用 `leftMapVisibility` 把它們讀成關閉。
 * - 例外（右國圖層仍只在左圖，`rightSideBlocker` 回原因）：
 *   - `three`：主地圖的 Three.js 立體層（`jpHistoricalFlightTrails`，和台灣的歷史航跡共用一支 hook）。
 * - 統計圖層（面量圖、比例圓、點密度）不走 overlay，由 `attachRegionalStatistics` 各圖自己掛，右國統計畫在右圖。
 *
 * 判斷只讀 manifest。
 */
import { LAYER_MANIFEST, type LayerCountry } from "../data/layerManifest";
import { layerIndexRow } from "../data/layerIndex";
import type { CountryCode } from "../constants/countries";

/** 右國圖層但只能畫在主地圖的原因 */
export type RightSideBlocker = "three";

/** 主地圖的 Three.js 立體層（右國的也只畫在左圖） */
const THREE_KEYS: ReadonlySet<string> = new Set(["jpHistoricalFlightTrails"]);

/** 圖層的國家主體（orphan key 或查不到回 undefined） */
export function layerCountryOf(key: string): LayerCountry | undefined {
  // 國家包（B1 P5a）沒載入前 manifest 沒有這筆：國家改讀索引
  return (LAYER_MANIFEST as Record<string, { country?: LayerCountry } | undefined>)[key]?.country ?? layerIndexRow(key)?.country;
}

/** 右國圖層為什麼只能畫在左圖；不是右國圖層、或可以畫在右圖回 null */
export function rightSideBlocker(key: string, rightCountry: CountryCode | null | undefined): RightSideBlocker | null {
  if (!rightCountry || layerCountryOf(key) !== rightCountry) return null;
  return THREE_KEYS.has(key) ? "three" : null;
}

/** 這層在並排模式畫在右圖：屬於右側國家，而且不是只能畫在主地圖的類型 */
export function isRightSideKey(key: string, rightCountry: CountryCode | null | undefined): boolean {
  return !!rightCountry && layerCountryOf(key) === rightCountry && rightSideBlocker(key, rightCountry) === null;
}
