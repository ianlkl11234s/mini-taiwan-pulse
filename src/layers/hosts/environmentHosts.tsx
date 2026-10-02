// 環境即時 4 層的 Layer Host（核安會輻射／放流水／CEMS／紫外線）：當下快照，不接 timeStore。

import { useEnvironmentLiveLayer } from "../../hooks/useEnvironmentLiveLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";

export const NuscGammaRadiationHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEnvironmentLiveLayer:nuscGammaRadiation");
  useEnvironmentLiveLayer(deps.mapRef, deps.layerVisibility.nuscGammaRadiation, "nuscGammaRadiation");
  return null;
};

export const WaterEffluentLiveHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEnvironmentLiveLayer:waterEffluentLive");
  useEnvironmentLiveLayer(deps.mapRef, deps.layerVisibility.waterEffluentLive, "waterEffluentLive");
  return null;
};

export const CemsStackLiveHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEnvironmentLiveLayer:cemsStackLive");
  useEnvironmentLiveLayer(deps.mapRef, deps.layerVisibility.cemsStackLive, "cemsStackLive");
  return null;
};

export const CwaUvDailyHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useEnvironmentLiveLayer:cwaUvDaily");
  useEnvironmentLiveLayer(deps.mapRef, deps.layerVisibility.cwaUvDaily, "cwaUvDaily");
  return null;
};
