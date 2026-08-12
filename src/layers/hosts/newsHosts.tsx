// 新聞事件的 Layer Host（AR-22 P2）—— App.tsx 原 L900-908 / L1062
//
// ⚠️ 三個 filter 欄位在 App 端**還有別的消費者**（IntelPanel / MonitorPanel 的
// `onFilterChange` 吃 `transportParams.setNewsMinRelevance` 等 setter）。本棒只搬
// hook 呼叫這一段，App 端那些用法**一個字都不動** —— 兩邊讀的是同一個 store slot，
// 面板寫入照樣會通知本 Host 的 per-key 訂閱。

import { useNewsEventsLayer } from "../../hooks/useNewsEventsLayer";
import { useNewsTimeline } from "../../hooks/useNewsTimeline";
import { useNewsFilter } from "../../hooks/useNewsFilter";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramBool, useLayerParams } from "../layerParamsAccess";

/**
 * News events 按日載入（Supabase；餵 overlayRegistry 的 news-events source）。
 * filter 與兩個情報面板共用同一個 store slot —— 面板改了嚴重度，這裡跟著重抓。
 */
export const NewsEventsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useNewsEventsLayer");
  const { filter } = useNewsFilter();
  useNewsEventsLayer(deps.mapRef, deps.layerVisibility.newsEvents, filter);
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
