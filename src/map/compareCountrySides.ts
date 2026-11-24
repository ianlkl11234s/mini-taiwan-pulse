/**
 * 兩國並排（比較模式 `countries`，G2-1）的圖層側別：**由 manifest 的 `country` 決定**，使用者不必逐層指定。
 *
 * - 右側國家的圖層畫在右圖；其他國家（含 WORLD／SIM）一律畫在左圖（主地圖）。
 * - 例外（右國圖層仍只在左圖，`rightSideBlocker` 回原因）：
 *   - `overlay`：走 `OVERLAY_REGISTRY` 的圖層由主地圖的 overlay 管理器統一畫，hydrate 記錄是模組層級（以 sourceId 為鍵），
 *     同一個 source 掛到第二張圖會被當成已載入而跳過。並排第一版不搬，列「只在左側」。
 *   - `three`：主地圖的 Three.js 立體層（`jpHistoricalFlightTrails`，和台灣的歷史航跡共用一支 hook）。
 * - 統計圖層（面量圖、比例圓、點密度）不走 overlay，由 `attachRegionalStatistics` 各圖自己掛，右國統計畫在右圖。
 *
 * 判斷要用到整份 manifest 與 overlay registry，第一次呼叫才建表（避免載入順序造成的循環相依）。
 */
import { LAYER_MANIFEST, type LayerCountry } from "../data/layerManifest";
import { OVERLAY_REGISTRY } from "./overlayRegistry";
import type { CountryCode } from "../constants/countries";

/** 右國圖層但只能畫在主地圖的原因 */
export type RightSideBlocker = "overlay" | "three";

/** 主地圖的 Three.js 立體層（右國的也只畫在左圖） */
const THREE_KEYS: ReadonlySet<string> = new Set(["jpHistoricalFlightTrails"]);

let overlayKeys: ReadonlySet<string> | null = null;
function overlayKeySet(): ReadonlySet<string> {
  overlayKeys ??= new Set(OVERLAY_REGISTRY.map((config) => String(config.id)));
  return overlayKeys;
}

/** 圖層的國家主體（orphan key 或查不到回 undefined） */
export function layerCountryOf(key: string): LayerCountry | undefined {
  return (LAYER_MANIFEST as Record<string, { country?: LayerCountry } | undefined>)[key]?.country;
}

/** 右國圖層為什麼只能畫在左圖；不是右國圖層、或可以畫在右圖回 null */
export function rightSideBlocker(key: string, rightCountry: CountryCode | null | undefined): RightSideBlocker | null {
  if (!rightCountry || layerCountryOf(key) !== rightCountry) return null;
  if (THREE_KEYS.has(key)) return "three";
  if (overlayKeySet().has(key)) return "overlay";
  return null;
}

/** 這層在並排模式畫在右圖：屬於右側國家，而且不是只能畫在主地圖的類型 */
export function isRightSideKey(key: string, rightCountry: CountryCode | null | undefined): boolean {
  return !!rightCountry && layerCountryOf(key) === rightCountry && rightSideBlocker(key, rightCountry) === null;
}
