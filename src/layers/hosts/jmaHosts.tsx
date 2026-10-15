// 日本氣象廳（JMA）即時 4 層的 Layer Host：AMeDAS／地震／火山（overlayRegistry 點層＋setData）、
// 警報・注意報（自建 PMTiles 市町村界 choropleth）。皆為當下快照，不接 timeStore。

import { useJmaLiveLayer } from "../../hooks/useJmaLiveLayer";
import { useJmaWarningsLayer } from "../../hooks/useJmaWarningsLayer";
import { useJmaImageryLayer } from "../../hooks/useJmaImageryLayer";
import { useGibsSnowCoverLayer } from "../../hooks/useGibsSnowCoverLayer";
import { useJmaRiskFloodLayer } from "../../hooks/useJmaRiskFloodLayer";
import { JMA_FLOOD_OPACITY } from "../../data/jmaTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";
import { RASTER } from "../../map/mapStyleScale";
import type { JmaImageryLayerKey, JmaImageryProductId } from "../../data/jmaTypes";

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

/**
 * JMA 發布幀影像（time-axis raster，接 timeStore）：每個 layer key 對一個 product，
 * 透明度 overlayParams 名稱一律 `${key}Opacity`（layerParamsSpec）。
 */
function makeJmaImageryHost(key: JmaImageryLayerKey, product: JmaImageryProductId): LayerHostComponent {
  const Host: LayerHostComponent = ({ deps }) => {
    bumpHostRender(`useJmaImageryLayer:${key}`);
    const p = useKeyOverlayParams(key);
    useJmaImageryLayer({
      mapRef: deps.mapRef,
      visible: deps.layerVisibility[key],
      opacity: p[`${key}Opacity`] ?? RASTER.opacity,
      product,
    });
    return null;
  };
  return Host;
}

export const JmaSnowDepthHost = makeJmaImageryHost("jmaSnowDepth", "snow_depth");
export const JmaRadarHost = makeJmaImageryHost("jmaRadar", "radar");
export const JmaRasrfHost = makeJmaImageryHost("jmaRasrf", "rasrf");
export const JmaRiskLandHost = makeJmaImageryHost("jmaRiskLand", "risk_land");
export const JmaRiskInundHost = makeJmaImageryHost("jmaRiskInund", "risk_inund");
export const JmaUvIndexHost = makeJmaImageryHost("jmaUvIndex", "uv_anal");
export const JmaSstHost = makeJmaImageryHost("jmaSst", "sst_him");
export const JmaSeaIceHost = makeJmaImageryHost("jmaSeaIce", "sea_ice");
export const JmaHimawariHost = makeJmaImageryHost("jmaHimawari", "himawari_b13");

/** NASA GIBS 衛星雪覆蓋（上游直連 XYZ raster，接 timeStore 換日） */
export const GibsSnowCoverHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGibsSnowCoverLayer");
  const p = useKeyOverlayParams("gibsSnowCover");
  useGibsSnowCoverLayer({
    mapRef: deps.mapRef,
    visible: deps.layerVisibility.gibsSnowCover,
    opacity: p.gibsSnowCoverOpacity ?? RASTER.opacity,
    productIdx: p.gibsSnowCoverProductIdx ?? 0,
  });
  return null;
};

/** 洪水キキクル（上游直連向量 pbf，只提供即時） */
export const JmaRiskFloodHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJmaRiskFloodLayer");
  const p = useKeyOverlayParams("jmaRiskFlood");
  useJmaRiskFloodLayer({
    mapRef: deps.mapRef,
    visible: deps.layerVisibility.jmaRiskFlood,
    opacity: p.jmaRiskFloodOpacity ?? JMA_FLOOD_OPACITY,
  });
  return null;
};
