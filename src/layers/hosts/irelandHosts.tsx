// 愛爾蘭 Layer Host（2026-11-07 第 0 波起）。比照 hosts/canadaHosts.tsx：一個 key 一個 Host。

import { useIeAdminLayers } from "../../hooks/useIeAdminLayers";
import { useIeBathymetryLayer } from "../../hooks/useIeBathymetryLayer";
import { useKrDataLayer } from "../../hooks/useKrDataLayers";
import { IE_SPEC_BY_KEY, asKrSpec } from "../../data/ieDataLayers";
import type { IeDataKey } from "../../data/ieDataKeys";
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

/** 第 1 波規格驅動資料層：共用南韓 `useKrDataLayer`（規格見 data/ieDataLayers.ts）。 */
function makeIeDataHost(key: IeDataKey, fallbackOpacity: number): LayerHostComponent {
  const spec = asKrSpec(IE_SPEC_BY_KEY[key]);
  const hookId = `useIe${key.slice(2)}Layer`;
  const IeDataHost: LayerHostComponent = ({ deps }) => {
    bumpHostRender(hookId);
    const p = useKeyOverlayParams(key);
    useKrDataLayer(deps.mapRef, spec, deps.layerVisibility[key], p[`${key}Opacity`] ?? fallbackOpacity, p[`${key}Scale`] ?? 1, deps.isDarkTheme, p[`${key}CatMask`], p[`${key}DisplayModeIdx`]);
    return null;
  };
  return IeDataHost;
}

export const IeMaritimeBoundariesHost = makeIeDataHost("ieMaritimeBoundaries", 0.85);
export const IePlaceNamesHost = makeIeDataHost("iePlaceNames", 0.8);
export const IeGaeltachtHost = makeIeDataHost("ieGaeltacht", 0.6);
export const IeActivityLocationsHost = makeIeDataHost("ieActivityLocations", 0.8);
export const IeParksHost = makeIeDataHost("ieParks", 0.7);
export const IeGraveyardsHost = makeIeDataHost("ieGraveyards", 0.8);

/** 海床地形（raster，只有透明度）。 */
export const IeBathymetryHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useIeBathymetryLayer");
  const p = useKeyOverlayParams("ieBathymetry");
  useIeBathymetryLayer(deps.mapRef, deps.layerVisibility.ieBathymetry, p.ieBathymetryOpacity ?? 0.7);
  return null;
};
