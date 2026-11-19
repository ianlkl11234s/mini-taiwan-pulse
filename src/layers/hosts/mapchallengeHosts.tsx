// 30 天地圖挑戰 Layer Host：Day 8 1955 中和鄉都市計畫圖、Day 17 真正的黑夜（image source）與入夜變亮（canvas source）、Day 19 設施氣味潛勢（image source＋三份 geojson）；
// 其餘向量層走 OVERLAY_REGISTRY，沒有 hook。
import { useMapchallengeDay08PlanLayer } from "../../hooks/useMapchallengeDay08PlanLayer";
import { useMapchallengeDay17DarkSkyLayer } from "../../hooks/useMapchallengeDay17DarkSkyLayer";
import { useMapchallengeDay17NightFallLayer } from "../../hooks/useMapchallengeDay17NightFallLayer";
import { useMapchallengeDay19PotentialLayer } from "../../hooks/useMapchallengeDay19PotentialLayer";
import { RASTER } from "../../map/mapStyleScale";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const MapchallengeDay08PlanHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useMapchallengeDay08PlanLayer");
  const p = useKeyOverlayParams("mapchallengeDay08Plan1955");
  useMapchallengeDay08PlanLayer(deps.mapRef, deps.layerVisibility.mapchallengeDay08Plan1955, p.mapchallengeDay08Plan1955Opacity ?? 0.5);
  return null;
};

export const MapchallengeDay17DarkSkyHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useMapchallengeDay17DarkSkyLayer");
  const p = useKeyOverlayParams("mapchallengeDay17DarkSky");
  useMapchallengeDay17DarkSkyLayer(
    deps.mapRef, deps.layerVisibility.mapchallengeDay17DarkSky,
    p.mapchallengeDay17DarkSkyOpacity ?? RASTER.opacity, p.mapchallengeDay17DarkSkyProductIdx ?? 0, deps.isDarkTheme,
  );
  return null;
};

export const MapchallengeDay17NightFallHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useMapchallengeDay17NightFallLayer");
  const p = useKeyOverlayParams("mapchallengeDay17NightFall");
  useMapchallengeDay17NightFallLayer(deps.mapRef, deps.layerVisibility.mapchallengeDay17NightFall, p.mapchallengeDay17NightFallOpacity ?? RASTER.opacity);
  return null;
};

export const MapchallengeDay19PotentialHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useMapchallengeDay19PotentialLayer");
  const p = useKeyOverlayParams("mapchallengeDay19Potential");
  useMapchallengeDay19PotentialLayer(
    deps.mapRef, deps.layerVisibility.mapchallengeDay19Potential,
    p.mapchallengeDay19PotentialOpacity ?? RASTER.opacity, p.mapchallengeDay19PotentialWindIdx ?? 0,
    (p.mapchallengeDay19PotentialFacilities ?? 1) !== 0, (p.mapchallengeDay19PotentialArrows ?? 1) !== 0, (p.mapchallengeDay19PotentialDumping ?? 0) !== 0,
    deps.isDarkTheme,
  );
  return null;
};
