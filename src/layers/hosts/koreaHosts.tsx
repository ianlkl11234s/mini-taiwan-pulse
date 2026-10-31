// 南韓 Layer Host（2026-10-31 第 0 波起）。clone hosts/ukHosts.tsx 的 GbAdminHost 慣例。

import { useKrAdminLayers } from "../../hooks/useKrAdminLayers";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 南韓行政邊界：시·도／시군구／행정동 三層級（同一個 PMTiles，select 切換）。 */
export const KrAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useKrAdminLayers");
  const p = useKeyOverlayParams("krAdminBoundaries");
  const level = p.krAdminBoundariesLevelIdx;
  useKrAdminLayers(
    deps.mapRef,
    deps.layerVisibility.krAdminBoundaries,
    p.krAdminBoundariesOpacity ?? 0.85,
    level === 1 || level === 2 ? level : 0,
    deps.isDarkTheme,
  );
  return null;
};
