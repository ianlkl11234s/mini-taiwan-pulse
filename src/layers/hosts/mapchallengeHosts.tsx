// 30 天地圖挑戰 Layer Host：Day 8 1955 中和鄉都市計畫圖（image source；其餘 Day 4–8 向量層走 OVERLAY_REGISTRY，沒有 hook）。
import { useMapchallengeDay08PlanLayer } from "../../hooks/useMapchallengeDay08PlanLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const MapchallengeDay08PlanHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useMapchallengeDay08PlanLayer");
  const p = useKeyOverlayParams("mapchallengeDay08Plan1955");
  useMapchallengeDay08PlanLayer(deps.mapRef, deps.layerVisibility.mapchallengeDay08Plan1955, p.mapchallengeDay08Plan1955Opacity ?? 0.5);
  return null;
};
