// ══════════════════════════════════════════════════════════════════
//  useNewsFilter — 新聞三軸 filter 的 per-key 門面（AR-22 P4）
// ══════════════════════════════════════════════════════════════════
//
// P4 之前這份 filter 由 App 組成 `useMemo` 再往下傳兩層：圖層（useNewsEventsLayer）
// 與兩個面板（IntelPanel / MonitorPanel）都吃 App 的 prop，setter 則是
// `useLayerParamsRuntime` 回傳的三個 `useCallback`。
// 結果是「動一下情報面板的嚴重度下拉 → 整個 App 樹 reconcile」。
//
// 三個消費端讀寫的其實是**同一個 store slot**（`newsEvents` 這個 key 的三個參數）。
// 本 hook 就是那個 slot 的門面：每個消費端各自 per-key 訂閱，誰寫都會通知彼此，
// App 完全不參與。
//
// ⚠️ 派生邏輯（`oneOfParamNum` 的窄化與 fallback）逐字照抄已退役的
// `useLayerParamsRuntime`：`minRelevance` 落在 `0 | 2 | 3`（fallback 3）、
// `minSeverity` 落在 `0 | 1 | 2`（fallback 1）—— `NewsFilter` 的欄位是字面聯集，
// 不做無憑據的 `as`。

import { useCallback, useMemo } from "react";
import type { NewsFilter } from "../data/newsEventsLoader";
import { layerParamsStore, useLayerParams } from "../state/layerParamsStore";
import { oneOfParamNum, paramBool, paramNum } from "../layers/layerParamsAccess";

const KEY = "newsEvents";
const NEWS_RELEVANCE_LEVELS = [0, 2, 3] as const;
const NEWS_SEVERITY_LEVELS = [0, 1, 2] as const;

/**
 * ⚠️ setter 走 `setParam`（**會觸發 cascade**），與已退役 runtime 的三個
 * `useCallback` 逐字等價 —— 那三支寫的就是 `layerParamsStore.setParam`。
 * select 型參數 store 存**字串**，所以數值要 `String(...)`（寫數字會讓控件讀不到
 * 型別相符的值而退回預設，靜默壞掉）。
 */
export function useNewsFilter(): {
  filter: NewsFilter;
  setFilter: (next: NewsFilter) => void;
} {
  const values = useLayerParams(KEY);

  const minRelevance = oneOfParamNum(
    paramNum(values, KEY, "newsMinRelevance"), NEWS_RELEVANCE_LEVELS, 3,
  );
  const minSeverity = oneOfParamNum(
    paramNum(values, KEY, "newsMinSeverity"), NEWS_SEVERITY_LEVELS, 1,
  );
  const eventsOnly = paramBool(values, KEY, "newsEventsOnly");

  // identity 釘住的方式與 App 原本那個 useMemo 相同（deps 是同樣的三個純量）
  const filter = useMemo<NewsFilter>(
    () => ({ minRelevance, eventsOnly, minSeverity }),
    [minRelevance, eventsOnly, minSeverity],
  );

  const setFilter = useCallback((next: NewsFilter) => {
    layerParamsStore.setParam(KEY, "newsMinRelevance", String(next.minRelevance));
    layerParamsStore.setParam(KEY, "newsEventsOnly", next.eventsOnly);
    layerParamsStore.setParam(KEY, "newsMinSeverity", String(next.minSeverity));
  }, []);

  return { filter, setFilter };
}
