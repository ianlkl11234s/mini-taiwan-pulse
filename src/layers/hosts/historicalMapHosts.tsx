// 古地圖（臺灣百年歷史地圖，外部 XYZ raster）Layer Host。
import { useHistoricalMapSinicaLayer } from "../../hooks/useHistoricalMapSinicaLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const HistoricalMapSinicaHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useHistoricalMapSinicaLayer");
  const p = useKeyOverlayParams("historicalMapSinica");
  useHistoricalMapSinicaLayer(deps.mapRef, deps.layerVisibility.historicalMapSinica,
    p.historicalMapSinicaOpacity ?? 0.85, p.historicalMapSinicaEraIdx ?? 0);
  return null;
};
