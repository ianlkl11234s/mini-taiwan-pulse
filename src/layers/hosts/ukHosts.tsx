// 英國 Layer Host（2026-10-29 第 0b 波起）。clone hosts/japanHosts.tsx 的 JpAdminHost 慣例。

import { useGbAdminLayers } from "../../hooks/useGbAdminLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 英國行政邊界：LAD ＋ 四地統計小區（各自獨立的 PMTiles polygon 圖層）。 */
export const GbAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbAdminLayers");
  const lad = useKeyOverlayParams("gbAdminBoundaries");
  const small = useKeyOverlayParams("gbSmallAreaBoundaries");
  useGbAdminLayers(
    deps.mapRef,
    { visible: deps.layerVisibility.gbAdminBoundaries, opacity: lad.gbAdminBoundariesOpacity ?? 0.85 },
    {
      visible: deps.layerVisibility.gbSmallAreaBoundaries,
      opacity: small.gbSmallAreaBoundariesOpacity ?? 0.85,
      niLevel: small.gbSmallAreaBoundariesNiLevelIdx === 1 ? 1 : 0,
    },
    deps.isDarkTheme,
  );
  return null;
};
