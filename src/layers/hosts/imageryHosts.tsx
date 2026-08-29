// 地形 raster / 坡度坡向 / 氣象與空品影像的 Layer Host（AR-22 P2）
// —— App.tsx 原 L1264-1306

import { useStaticRasterLayer } from "../../hooks/useStaticRasterLayer";
import { useSlopeVectorLayer } from "../../hooks/useSlopeVectorLayer";
import { useAspectVectorLayer } from "../../hooks/useAspectVectorLayer";
import { useCwaImageryLayer } from "../../hooks/useCwaImageryLayer";
import { useAqiImageryLayer } from "../../hooks/useAqiImageryLayer";
import { useAqiStationsLayer } from "../../hooks/useAqiStationsLayer";
import { useMicroSensorsLayer } from "../../hooks/useMicroSensorsLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramBool, paramNum, useLayerParams } from "../layerParamsAccess";

// 全臺 raster bbox（WGS84，繼承自 dtm_20m 上游 EPSG:3826 → 3857）
const TERRAIN_BBOX = {
  lonMin: 120.0166,
  lonMax: 122.0096,
  latMin: 21.8938,
  latMax: 25.3015,
} as const;

/** Base map 地形 raster（hillshade，單張 PNG 預烤 colormap） */
export const HillshadeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useStaticRasterLayer:hillshade");
  const values = useLayerParams("hillshade");
  useStaticRasterLayer({
    mapRef: deps.mapRef,
    sourceId: "base-hillshade-src",
    layerId: "base-hillshade-layer",
    url: "./base_map/hillshade.png",
    bbox: TERRAIN_BBOX,
    visible: deps.layerVisibility.hillshade,
    opacity: paramNum(values, "hillshade", "hillshadeOpacity"),
  });
  return null;
};

/** 坡度分級向量（PMTiles polygon，可點選 / 疊圖；依底圖換色帶） */
export const SlopeVectorHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSlopeVectorLayer");
  const values = useLayerParams("slopeVector");
  useSlopeVectorLayer(
    deps.mapRef,
    deps.layerVisibility.slopeVector,
    paramNum(values, "slopeVector", "slopeVectorOpacity"),
    deps.mapStyleId,
  );
  return null;
};

/** 坡向分級向量 */
export const AspectVectorHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAspectVectorLayer");
  const values = useLayerParams("aspectVector");
  useAspectVectorLayer(
    deps.mapRef,
    deps.layerVisibility.aspectVector,
    paramNum(values, "aspectVector", "aspectVectorOpacity"),
    deps.mapStyleId,
  );
  return null;
};

/** CWA 衛星雲圖 / 雷達回波（一支 hook 兩個 key，各自 opacity） */
export const CwaImageryHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useCwaImageryLayer");
  const cloud = useLayerParams("cwaCloudImagery");
  const radar = useLayerParams("cwaRadarImagery");
  useCwaImageryLayer({
    mapRef: deps.mapRef,
    cloudVisible: deps.layerVisibility.cwaCloudImagery,
    radarVisible: deps.layerVisibility.cwaRadarImagery,
    cloudOpacity: paramNum(cloud, "cwaCloudImagery", "cwaCloudOpacity"),
    radarOpacity: paramNum(radar, "cwaRadarImagery", "cwaRadarOpacity"),
  });
  return null;
};

/** 空氣品質色階 raster（product 由 AqiProductSwitcher 控制，state 留在 App） */
export const AqiImageryHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAqiImageryLayer");
  const values = useLayerParams("aqiImagery");
  useAqiImageryLayer({
    mapRef: deps.mapRef,
    visible: deps.layerVisibility.aqiImagery,
    product: deps.aqiProduct,
    opacity: paramNum(values, "aqiImagery", "aqiImageryOpacity"),
  });
  return null;
};

/** 77 個環境部測站 */
export const AqiStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAqiStationsLayer");
  useAqiStationsLayer(deps.mapRef, deps.layerVisibility.aqiStations, deps.isDarkTheme);
  return null;
};

/** LASS 微型感測器（cluster 開關 + 模式 select） */
export const MicroSensorsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useMicroSensorsLayer");
  const values = useLayerParams("aqiMicroSensors");
  useMicroSensorsLayer(
    deps.mapRef,
    deps.layerVisibility.aqiMicroSensors,
    deps.isDarkTheme,
    paramBool(values, "aqiMicroSensors", "aqiMicroCluster"),
    paramNum(values, "aqiMicroSensors", "aqiMicroModeIdx"),
    paramNum(values, "aqiMicroSensors", "aqiMicroOpacity"),
  );
  return null;
};
