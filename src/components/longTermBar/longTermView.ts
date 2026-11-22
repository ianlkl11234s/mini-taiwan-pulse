// 一次一條時間軸的判斷（STANDARD.md §2 第 3 條），純函式方便測試。
import { LIVE_TIMELINE_KEYS, LONG_TERM_BAR_KEYS } from "../../data/longTermLayers";
import type { LongTermBarState } from "../../state/longTermBarStore";

export interface LongTermView {
  /** 目前要顯示的長期圖層（最後打開的那一層）；沒有＝不顯示時間條 */
  barKey: string | null;
  /** 最後打開的即時圖層（chip 文字用） */
  liveKey: string | null;
  showBar: boolean;
  showChips: boolean;
}

export function resolveLongTermView(vis: Readonly<Record<string, boolean>>, st: Pick<LongTermBarState, "openedAt" | "pinned">): LongTermView {
  const order = (k: string) => st.openedAt[k] ?? 0;
  const byRecent = (x: string, y: string) => order(y) - order(x);
  const barKey = LONG_TERM_BAR_KEYS.filter((k) => vis[k]).sort(byRecent)[0] ?? null;
  const liveKey = LIVE_TIMELINE_KEYS.filter((k) => vis[k]).sort(byRecent)[0] ?? null;
  // 長期圖層開著時，只要還有其他圖層開著，就給「即時時間軸」chip（其他圖層仍依即時時間軸運作）
  const showChips = !!barKey && Object.entries(vis).some(([k, on]) => on && !(LONG_TERM_BAR_KEYS as readonly string[]).includes(k));
  // chip 的手動指定只在 chip 還在時有效：其他圖層都關了就回到時間條，不會卡在「沒有時間條也沒有 chip」
  const pinned = showChips ? st.pinned : null;
  const showBar = !!barKey && (pinned ? pinned === "longTerm" : order(barKey) > (liveKey ? order(liveKey) : 0));
  return { barKey, liveKey, showBar, showChips };
}
