// 橋梁研究（進行中）Layer Host：站主限定私人 PMTiles（未授權時 App 已鎖住 key，hook 也不掛 source）。

import { useBssBridgeLayers } from "../../hooks/useBssBridgeLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramNum, useLayerParams } from "../layerParamsAccess";

/** 全臺橋梁方向候選線＋清冊點位（一個私人 PMTiles source、兩個獨立開關）。 */
export const BssBridgeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useBssBridgeLayers");
  const lines = useLayerParams("bssNationalBridgePreview");
  const points = useLayerParams("bssNationalBridgePointsPreview");
  useBssBridgeLayers(deps.mapRef, {
    bssNationalBridgePreview: deps.layerVisibility.bssNationalBridgePreview,
    bssNationalBridgePointsPreview: deps.layerVisibility.bssNationalBridgePointsPreview,
  }, {
    bssNationalBridgePreview: paramNum(lines, "bssNationalBridgePreview", "bssNationalBridgePreviewOpacity"),
    bssNationalBridgePointsPreview: paramNum(points, "bssNationalBridgePointsPreview", "bssNationalBridgePointsPreviewOpacity"),
  }, {
    lineClass: paramNum(lines, "bssNationalBridgePreview", "bssNationalBridgePreviewClass"),
    lineQuality: paramNum(lines, "bssNationalBridgePreview", "bssNationalBridgePreviewQuality"),
    pointQuality: paramNum(points, "bssNationalBridgePointsPreview", "bssNationalBridgePointsPreviewQuality"),
    pointScale: paramNum(points, "bssNationalBridgePointsPreview", "bssNationalBridgePointsPreviewScale"),
  }, deps.isDarkTheme);
  return null;
};
