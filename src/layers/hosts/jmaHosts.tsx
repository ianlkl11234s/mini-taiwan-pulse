// 日本氣象廳（JMA）即時 4 層的 Layer Host：AMeDAS／地震／火山（overlayRegistry 點層＋setData）、
// 警報・注意報（自建 PMTiles 市町村界 choropleth）。皆為當下快照，不接 timeStore。

import { useJmaLiveLayer } from "../../hooks/useJmaLiveLayer";
import { useJmaWarningsLayer } from "../../hooks/useJmaWarningsLayer";
import { useJmaImageryLayer } from "../../hooks/useJmaImageryLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";
import { RASTER } from "../../map/mapStyleScale";

export const JmaAmedasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaAmedas");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaAmedas, "jmaAmedas");
  return null;
};

export const JmaQuakesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaQuakes");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaQuakes, "jmaQuakes");
  return null;
};

export const JmaVolcanoesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaLiveLayer:jmaVolcanoes");
  useJmaLiveLayer(deps.mapRef, deps.layerVisibility.jmaVolcanoes, "jmaVolcanoes");
  return null;
};

export const JmaWarningsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaWarningsLayer");
  const p = useKeyOverlayParams("jmaWarnings");
  useJmaWarningsLayer(deps.mapRef, deps.layerVisibility.jmaWarnings, p.jmaWarningsOpacity ?? 0.55, deps.isDarkTheme);
  return null;
};

/** JMA 發布幀影像：解析積雪深（time-axis raster，接 timeStore） */
export const JmaSnowDepthHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaImageryLayer:jmaSnowDepth");
  const p = useKeyOverlayParams("jmaSnowDepth");
  useJmaImageryLayer({
    mapRef: deps.mapRef,
    visible: deps.layerVisibility.jmaSnowDepth,
    opacity: p.jmaSnowDepthOpacity ?? RASTER.opacity,
    product: "snow_depth",
  });
  return null;
};
