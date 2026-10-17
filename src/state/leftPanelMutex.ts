/**
 * Z1 左側浮動面板互斥（ui-r2 Phase O）：左側一次只開一個浮動面板。
 *
 * 既有的 closeExternalPanels（IconRailSidebar）已處理 Agent／會員／即時情報／衛星 四者，
 * 但「地震回放」是圖層旗標（layerVisibility.earthquakeReplay），會從圖層清單、批次開關、
 * URL 還原、Agent bridge 等多條路徑打開，沒有單一開啟 handler。
 * 因此 App 只觀察「剛由關變開」的面板，用本函式算出其他該關掉的面板，再呼叫既有的關閉 setter。
 */
export const LEFT_PANEL_KEYS = ["agent", "earthquakeReplay", "intel", "satellite", "member"] as const;

export type LeftPanelKey = (typeof LEFT_PANEL_KEYS)[number];
export type LeftPanelState = Record<LeftPanelKey, boolean>;

/**
 * 回傳應關閉的面板。沒有面板剛打開 → []（只關不開時不做事，也不會互相觸發）。
 * 同一輪有多個面板同時打開時，依 LEFT_PANEL_KEYS 順序保留第一個。
 */
export function leftPanelsToClose(prev: LeftPanelState, next: LeftPanelState): LeftPanelKey[] {
  const keep = LEFT_PANEL_KEYS.find((key) => next[key] && !prev[key]);
  if (!keep) return [];
  return LEFT_PANEL_KEYS.filter((key) => key !== keep && next[key]);
}
