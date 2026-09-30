import { useEffect, useSyncExternalStore } from "react";
import {
  ensureStatisticsRecipeDetails,
  statisticsRecipeDetailsLoaded,
  subscribeStatisticsRecipeDetails,
} from "../data/statisticsRecipeDetails";

/**
 * PF-7：需要統計配方明細（exact release selector）的 UI 用。`needed` 為 true 時才觸發下載
 * （loadingRegistry 顯示「載入統計配方明細」）；回傳明細是否已可同步讀取。
 * 下載失敗時由統計 store 的錯誤／重試流程呈現（重試會再次呼叫 ensure）。
 */
export function useStatisticsRecipeDetails(needed: boolean): boolean {
  const ready = useSyncExternalStore(subscribeStatisticsRecipeDetails, statisticsRecipeDetailsLoaded);
  useEffect(() => {
    if (needed && !ready) ensureStatisticsRecipeDetails().catch(() => { /* surfaced by regionalStatisticsStore error + retry */ });
  }, [needed, ready]);
  return ready;
}
