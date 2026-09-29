// 點擊處選取圈（R2 呼吸脈衝）的座標來源：全站只有一個地圖點擊記錄點。
//
// 圈只在停靠 FeatureInfoPanel 開著時出現（由 useSelectionRing 依 featureInfo 決定），
// 位置優先用 featureInfo.coords（點圖徵時多半已吸附到點位；AI 標記點也只有這個），
// 沒有 coords 的來源（Agent 分析結果、歷史航跡等）改用最後一次地圖點擊位置。
import type { FeatureInfo } from "../types";
import { SELECTION_RING } from "../styles/designTokens";

type LngLat = [number, number];

/** 超過這個時間的點擊不再代表「目前這個面板」—— 避免程式化開的面板拿到過期座標。 */
export const SELECTION_CLICK_MAX_AGE_MS = 10_000;

let lastClick: { lngLat: LngLat; at: number } | null = null;

/** App 的地圖 click listener 每次點擊都呼叫（不論有沒有命中圖徵）。 */
export function recordSelectionClick(lngLat: LngLat, at = Date.now()): void {
  lastClick = { lngLat, at };
}

export function lastSelectionClick(): { lngLat: LngLat; at: number } | null {
  return lastClick;
}

export function selectionRingPosition(
  featureInfo: Pick<FeatureInfo, "coords"> | null,
  click: { lngLat: LngLat; at: number } | null,
  now = Date.now(),
): LngLat | null {
  if (!featureInfo) return null;
  const coords = featureInfo.coords;
  if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) return coords;
  if (click && now - click.at <= SELECTION_CLICK_MAX_AGE_MS) return click.lngLat;
  return null;
}

/** 主題色走 CSS 變數，掛在地圖容器上（App 依 isDarkTheme 設定）。 */
export const SELECTION_RING_ACCENT_VAR = "--selection-ring-accent";
export function selectionRingAccent(isDarkTheme: boolean): string {
  return isDarkTheme ? SELECTION_RING.dark : SELECTION_RING.light;
}
