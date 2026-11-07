// 愛爾蘭 Layer Host（2026-11-07 第 0 波）。比照 hosts/canadaHosts.tsx：一個 key 一個 Host。

import { useIeAdminLayers } from "../../hooks/useIeAdminLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 行政邊界：地方政府、選舉分區、統計小區三層級（同一個 PMTiles，select 切換）。 */
export const IeAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeAdminLayers");
  const p = useKeyOverlayParams("ieAdminBoundaries");
  const level = p.ieAdminBoundariesLevelIdx;
  useIeAdminLayers(deps.mapRef, deps.layerVisibility.ieAdminBoundaries, p.ieAdminBoundariesOpacity ?? 0.85, level === 1 || level === 2 ? level : 0, deps.isDarkTheme);
  return null;
};
