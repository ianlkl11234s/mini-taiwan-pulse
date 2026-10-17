// 日本氣象廳／環境省 時間軸點位與區域圖層（P4）的 Layer Host：
// 落雷（沿用台灣落雷 hook，source='jma'）、WBGT、山頂初冠雪、紅葉・黃葉前線、櫻花前線（overlayRegistry 點層＋setData）、
// 梅雨入り・明け（共用警報層市区町村界 PMTiles 的 choropleth）。全部接 timeStore。

import { useLightningLayer } from "../../hooks/useHazardLayer";
import { useJmaLightningCoverage } from "../../hooks/useJmaLightningCoverage";
import { useJmaLiveLayer } from "../../hooks/useJmaLiveLayer";
import { useJmaRainySeasonLayer } from "../../hooks/useJmaRainySeasonLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const JmaLightningHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useLightningLayer:jma");
  const p = useKeyOverlayParams("jmaLightning");
  useLightningLayer(deps.mapRef, deps.layerVisibility.jmaLightning, p.jmaLightningMinutes ?? 60, "jma");
  useJmaLightningCoverage(deps.layerVisibility.jmaLightning);
  return null;
};

export const JmaWbgtHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaWbgt");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaWbgt, "jmaWbgt");
  return null;
};

export const JmaSnowcapHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaSnowcap");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaSnowcap, "jmaSnowcap");
  return null;
};

export const JmaAutumnLeavesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaAutumnLeaves");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaAutumnLeaves, "jmaAutumnLeaves");
  return null;
};

export const JmaSakuraHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaSakura");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaSakura, "jmaSakura");
  return null;
};

export const JmaRainySeasonHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaRainySeasonLayer");
  const p = useKeyOverlayParams("jmaRainySeason");
  useJmaRainySeasonLayer(deps.mapRef, deps.layerVisibility.jmaRainySeason, p.jmaRainySeasonOpacity ?? 0.55);
  return null;
};
