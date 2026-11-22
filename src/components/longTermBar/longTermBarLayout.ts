// 長期時間條的版面共用值（STANDARD.md §2 第 10 條：左側面板讓到時間條上緣）。
// 時間條出現時把佔用的底部高度寫進 CSS 變數；左側停靠面板用下面兩個函式讓位，時間條不在時變數為 0px，面板維持原本尺寸。
import { LAYOUT } from "../../styles/designTokens";

/** 時間條佔用的底部高度（含底邊距與間隔）寫進這個 CSS 變數；左側停靠面板據此讓位。時間條不在時為 0px。 */
export const LONG_TERM_BAR_RESERVE_VAR = "--longterm-bar-reserve";

/** 左側停靠面板的最大高度：原本的上限，且不超過時間條上緣（時間條不在時變數為 0）。 */
export function maxHeightAboveLongTermBar(base: string): string {
  return `min(${base}, calc(100vh - ${LAYOUT.leftDockTop}px - var(${LONG_TERM_BAR_RESERVE_VAR}, 0px)))`;
}

/** 左側停靠面板（bottom 錨定）的底邊：原值與時間條上緣取高者。 */
export function bottomAboveLongTermBar(basePx: number): string {
  return `max(${basePx}px, var(${LONG_TERM_BAR_RESERVE_VAR}, 0px))`;
}
