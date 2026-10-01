import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  ensureStatisticsRecipeDetails,
  statisticsRecipeDetailsLoaded,
  subscribeStatisticsRecipeDetails,
  type StatisticsRecipeFamily,
} from "../data/statisticsRecipeDetails";

/**
 * PF-7／PF-10：需要統計配方明細（exact release selector）的 UI 用。`family` 非 null 時只下載該家族
 * （loadingRegistry 顯示「載入農業／社會統計配方明細」）；回傳該家族明細是否已可同步讀取（null → true）。
 * 下載失敗時由統計 store 的錯誤／重試流程呈現（重試會再次呼叫 ensure）。
 */
export function useStatisticsRecipeDetails(family: StatisticsRecipeFamily | null): boolean {
  const getSnapshot = useCallback(() => family === null || statisticsRecipeDetailsLoaded(family), [family]);
  const ready = useSyncExternalStore(subscribeStatisticsRecipeDetails, getSnapshot);
  useEffect(() => {
    if (family && !ready) ensureStatisticsRecipeDetails(family).catch(() => { /* surfaced by regionalStatisticsStore error + retry */ });
  }, [family, ready]);
  return ready;
}
