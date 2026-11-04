// 雙北國道逐車模擬（模擬面板，公開）Layer Host。

import { useFreewayTdcsSimLayer } from "../../hooks/useFreewayTdcsSimLayer";
import { FREEWAY_TDCS_COLOR_MODES, FREEWAY_TDCS_SIM_KEY } from "../../data/freewayTdcsSimTypes";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { oneOfParam, paramNum, paramStr, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

export const FreewayTdcsSimHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useFreewayTdcsSimLayer");
  const K = FREEWAY_TDCS_SIM_KEY;
  const values = useLayerParams(K);
  const overlay = useKeyOverlayParams(K);
  useFreewayTdcsSimLayer(deps.mapRef, deps.layerVisibility.freewayTdcsSim, {
    opacity: paramNum(values, K, "freewayTdcsSimOpacity"),
    trail: paramNum(values, K, "freewayTdcsSimTrail"),
    width: paramNum(values, K, "freewayTdcsSimWidth"),
    size: paramNum(values, K, "freewayTdcsSimSize"),
    colorMode: oneOfParam(paramStr(values, K, "freewayTdcsSimColorMode"), FREEWAY_TDCS_COLOR_MODES, "speed"),
    vtMask: overlay.freewayTdcsSimTypeMask ?? 0b11111,
  }, deps.isDarkTheme);
  return null;
};
