// 雙北大眾運輸可及性（模擬面板，公開、情境推演；transit_access P1＋P2）Layer Hosts：資料走公開模擬資料家族（simBundle）。

import { useEffect, useSyncExternalStore } from "react";
import { useTransitAccessGridLayer } from "../../hooks/useTransitAccessGridLayer";
import { useTransitAccessPlaybackLayer } from "../../hooks/useTransitAccessPlaybackLayer";
import { subscribeTransitAccessClassification, transitAccessClassification } from "../../data/transitAccessStore";
import {
  COUNT_THRESHOLDS, GRID_PERCENTILES, SINGLE_PERCENTILES, TRANSIT_ACCESS_GRID_KEY, TRANSIT_ACCESS_GROUPS, TRANSIT_ACCESS_METRICS, TRANSIT_ACCESS_NETWORKS,
  TRANSIT_ACCESS_ORIGINS, TRANSIT_ACCESS_PLAYBACK_KEY, TRANSIT_ACCESS_SLOTS, resolveTierSettings,
  type TransitAccessClassification,
} from "../../data/transitAccessTypes";
import type { LayerParamValues } from "../../data/layerParamsSpec";
import { transitAccessClock } from "../../state/transitAccessClock";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramBool, paramNum, paramStr, useLayerParams } from "../layerParamsAccess";

/** 目前 bundle 的分級設定（未載入用退路）；圖例、popup 與 host 共用 */
export const useTransitAccessClassification = (): TransitAccessClassification =>
  useSyncExternalStore(subscribeTransitAccessClassification, transitAccessClassification);

/** 網格控制項（host、圖例、popup 共用同一套解讀） */
export function transitAccessGridControls(values: LayerParamValues, cls: TransitAccessClassification) {
  const K = TRANSIT_ACCESS_GRID_KEY;
  const group = oneOfParam(paramStr(values, K, "transitAccessGroup"), TRANSIT_ACCESS_GROUPS, "hospital");
  return {
    group,
    slot: oneOfParam(paramStr(values, K, "transitAccessSlot"), TRANSIT_ACCESS_SLOTS, "wkdy_peak"),
    network: oneOfParam(paramStr(values, K, "transitAccessNetwork"), TRANSIT_ACCESS_NETWORKS, "scheduled"),
    metric: oneOfParam(paramStr(values, K, "transitAccessMetric"), TRANSIT_ACCESS_METRICS, "tier"),
    pct: Number(oneOfParam(paramStr(values, K, "transitAccessPct"), GRID_PERCENTILES, "50")),
    countTh: Number(oneOfParam(paramStr(values, K, "transitAccessCountTh"), COUNT_THRESHOLDS, "30")),
    tier: resolveTierSettings(cls, group, {
      a: paramNum(values, K, "transitAccessTierA"), b: paramNum(values, K, "transitAccessTierB"), r: paramNum(values, K, "transitAccessTierR"),
      overhead: paramNum(values, K, "transitAccessCarOverhead"), peak: paramBool(values, K, "transitAccessCarPeak"),
    }),
    nightT: paramNum(values, K, "transitAccessNightT"),
  };
}

export function transitAccessPlaybackControls(values: LayerParamValues) {
  const K = TRANSIT_ACCESS_PLAYBACK_KEY;
  return {
    origin: oneOfParam(paramStr(values, K, "transitAccessOrigin"), TRANSIT_ACCESS_ORIGINS, "taipei"),
    slot: oneOfParam(paramStr(values, K, "transitAccessPlaybackSlot"), TRANSIT_ACCESS_SLOTS, "wkdy_peak"),
    network: oneOfParam(paramStr(values, K, "transitAccessPlaybackNetwork"), TRANSIT_ACCESS_NETWORKS, "scheduled"),
    pct: oneOfParam(paramStr(values, K, "transitAccessPlaybackPct"), SINGLE_PERCENTILES, "50"),
  };
}

/** 網格：類別／時段／版本換資料；指標、分位數、門檻只改 paint。 */
export const TransitAccessGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTransitAccessGridLayer");
  const K = TRANSIT_ACCESS_GRID_KEY;
  const values = useLayerParams(K);
  const cls = useTransitAccessClassification();
  useTransitAccessGridLayer(deps.mapRef, deps.layerVisibility.transitAccessGrid, paramNum(values, K, "transitAccessGridOpacity"), transitAccessGridControls(values, cls), deps.isDarkTheme);
  return null;
};

/** 單起點：時間在 scoped 時鐘；關掉圖層即暫停並回到初始時刻（S-1）。 */
export const TransitAccessPlaybackHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useTransitAccessPlaybackLayer");
  const K = TRANSIT_ACCESS_PLAYBACK_KEY;
  const values = useLayerParams(K);
  const visible = deps.layerVisibility.transitAccessPlayback;
  useTransitAccessPlaybackLayer(deps.mapRef, visible, paramNum(values, K, "transitAccessPlaybackOpacity"), transitAccessPlaybackControls(values));
  useEffect(() => { if (!visible) transitAccessClock.reset(); }, [visible]);
  return null;
};
