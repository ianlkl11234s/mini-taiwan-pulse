// 新聞事件的 Layer Host（AR-22 P2）—— App.tsx 原 L900-908 / L1062
//
// ⚠️ 三個 filter 欄位在 App 端**還有別的消費者**（IntelPanel / MonitorPanel 的
// `onFilterChange` 吃 `transportParams.setNewsMinRelevance` 等 setter）。本棒只搬
// hook 呼叫這一段，App 端那些用法**一個字都不動** —— 兩邊讀的是同一個 store slot，
// 面板寫入照樣會通知本 Host 的 per-key 訂閱。

import { useMemo } from "react";
import { useNewsEventsLayer } from "../../hooks/useNewsEventsLayer";
import { useNewsTimeline } from "../../hooks/useNewsTimeline";
import type { NewsFilter } from "../../data/newsEventsLoader";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParamNum, paramBool, paramNum, useLayerParams } from "../layerParamsAccess";

/** 窄化清單同 `useLayerParamsRuntime`（那裡是 module-private 常數，不跨檔 import） */
const NEWS_RELEVANCE_LEVELS = [0, 2, 3] as const;
const NEWS_SEVERITY_LEVELS = [0, 1, 2] as const;

/** News events 按日載入（Supabase；餵 overlayRegistry 的 news-events source） */
export const NewsEventsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useNewsEventsLayer");
  const values = useLayerParams("newsEvents");
  const minRelevance = oneOfParamNum(
    paramNum(values, "newsEvents", "newsMinRelevance"), NEWS_RELEVANCE_LEVELS, 3,
  );
  const minSeverity = oneOfParamNum(
    paramNum(values, "newsEvents", "newsMinSeverity"), NEWS_SEVERITY_LEVELS, 1,
  );
  const eventsOnly = paramBool(values, "newsEvents", "newsEventsOnly");
  // identity 釘住的方式與 App 原本那個 useMemo 相同（deps 是同樣的三個純量）
  const newsFilter = useMemo<NewsFilter>(
    () => ({ minRelevance, eventsOnly, minSeverity }),
    [minRelevance, eventsOnly, minSeverity],
  );
  useNewsEventsLayer(deps.mapRef, deps.layerVisibility.newsEvents, newsFilter);
  return null;
};

/** News timeline（time-based filter + ripple animation） */
export const NewsTimelineHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useNewsTimeline");
  const values = useLayerParams("newsEvents");
  useNewsTimeline(
    deps.mapRef,
    deps.layerVisibility.newsEvents,
    paramBool(values, "newsEvents", "newsTimeBased"),
    paramBool(values, "newsEvents", "newsRipple"),
  );
  return null;
};
