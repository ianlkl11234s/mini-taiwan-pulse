// 橋梁研究（進行中）Layer Host：站主限定私人 PMTiles（未授權時 App 已鎖住 key，hook 也不掛 source）。

import { useBridgeResilienceLayers } from "../../hooks/useBridgeResilienceLayers";
import { useBssBridgeLayers } from "../../hooks/useBssBridgeLayers";
import { BRIDGE_MODES, BRIDGE_RESILIENCE_KEY, BRIDGE_WEIGHTINGS, VILLAGE_METRICS } from "../../data/bridgeResilienceTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramBool, paramNum, paramStr, useLayerParams } from "../layerParamsAccess";

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

/** 雙北跨河橋梁韌性（研究中）：站主限定私人 PMTiles＋私人 JSON；模式、村里、替代路線、聯合情境都是圖層參數。 */
export const BridgeResilienceHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useBridgeResilienceLayers");
  const values = useLayerParams(BRIDGE_RESILIENCE_KEY);
  useBridgeResilienceLayers(deps.mapRef, deps.layerVisibility.bridgeResilienceTwinCity, paramNum(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceTwinCityOpacity"), {
    mode: oneOfParam(paramStr(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceMode"), BRIDGE_MODES, "car"),
    weighting: oneOfParam(paramStr(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceWeighting"), BRIDGE_WEIGHTINGS, "decay"),
    metric: oneOfParam(paramStr(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceVillageMetric"), VILLAGE_METRICS, "p90"),
    showVillages: paramBool(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceShowVillages"),
    showRoutes: paramBool(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceShowRoutes"),
    joint: paramBool(values, BRIDGE_RESILIENCE_KEY, "bridgeResilienceJoint"),
  });
  return null;
};
