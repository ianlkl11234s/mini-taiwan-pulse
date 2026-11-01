// 交通可及性（模擬面板，公開、情境推演；G28 P5）Layer Hosts：資料走公開模擬資料家族（simBundle）。

import { useEffect } from "react";
import { useTransitReachGridLayer } from "../../hooks/useTransitReachGridLayer";
import { useTransitReachPlaybackLayer } from "../../hooks/useTransitReachPlaybackLayer";
import {
  TRANSIT_REACH_GRID_KEY, TRANSIT_REACH_GRID_METRICS, TRANSIT_REACH_GRID_VIEWS, TRANSIT_REACH_MODES, TRANSIT_REACH_PLAYBACK_KEY,
  TRANSIT_REACH_RANGES, TRANSIT_REACH_SPEEDS,
} from "../../data/transitReachTypes";
import { transitReachClock } from "../../state/transitReachClock";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramBool, paramNum, paramStr, useLayerParams } from "../layerParamsAccess";

/** 網格：指標／版本／車速只改 paint 的 `get` 欄位。 */
export const TransitReachGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTransitReachGridLayer");
  const K = TRANSIT_REACH_GRID_KEY;
  const values = useLayerParams(K);
  const metric = oneOfParam(paramStr(values, K, "transitReachGridMetric"), TRANSIT_REACH_GRID_METRICS, "pop2h");
  const view = oneOfParam(paramStr(values, K, "transitReachGridView"), TRANSIT_REACH_GRID_VIEWS, "abs");
  const speed = oneOfParam(paramStr(values, K, "transitReachGridSpeed"), TRANSIT_REACH_SPEEDS, "free");
  useTransitReachGridLayer(deps.mapRef, deps.layerVisibility.transitReachGrid, paramNum(values, K, "transitReachGridOpacity"), { metric, view, speed }, deps.isDarkTheme);
  return null;
};

/** 播放：起點在連動選單 store、時間在 scoped 時鐘；關掉圖層即暫停並回到初始時刻（S-1）。 */
export const TransitReachPlaybackHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTransitReachPlaybackLayer");
  const K = TRANSIT_REACH_PLAYBACK_KEY;
  const values = useLayerParams(K);
  const visible = deps.layerVisibility.transitReachPlayback;
  const mode = oneOfParam(paramStr(values, K, "transitReachMode"), TRANSIT_REACH_MODES, "all");
  const speed = oneOfParam(paramStr(values, K, "transitReachSpeed"), TRANSIT_REACH_SPEEDS, "free");
  const range = oneOfParam(paramStr(values, K, "transitReachRange"), TRANSIT_REACH_RANGES, "auto");
  const isochrones = paramBool(values, K, "transitReachIsochrones");
  useTransitReachPlaybackLayer(deps.mapRef, visible, paramNum(values, K, "transitReachPlaybackOpacity"), { mode, speed, range, isochrones }, deps.isDarkTheme);
  useEffect(() => { if (!visible) transitReachClock.reset(); }, [visible]);
  return null;
};
