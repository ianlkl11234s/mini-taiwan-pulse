// 英國 Layer Host（2026-10-29 第 0b 波起）。clone hosts/japanHosts.tsx 的 JpAdminHost 慣例。

import { useGbAdminLayers } from "../../hooks/useGbAdminLayers";
import { useGbMaritimeLimitsLayer } from "../../hooks/useGbMaritimeLimitsLayer";
import { useGbOpenSpaceLayers } from "../../hooks/useGbOpenSpaceLayers";
import { useGbBathingWatersLayer, useGbCoastalErosionLayer, useGbFloodDefencesLayer, useGbHydroStationsLayer, useGbRiversLayer } from "../../hooks/useGbWaterLayers";
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

/** 英國海域界線（第 1 波 C002，UKHO）：PMTiles line，依界線類型分色。 */
export const GbMaritimeLimitsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbMaritimeLimitsLayer");
  const p = useKeyOverlayParams("gbMaritimeLimits");
  useGbMaritimeLimitsLayer(deps.mapRef, deps.layerVisibility.gbMaritimeLimits, p.gbMaritimeLimitsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

/** 英國建成區＋綠地三層（公園、運動場、墓園；後三者共用 gb_greenspace.pmtiles）。 */
export const GbOpenSpaceHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbOpenSpaceLayers");
  const builtUp = useKeyOverlayParams("gbBuiltUpAreas");
  const park = useKeyOverlayParams("gbGreenspace");
  const sports = useKeyOverlayParams("gbSportsFacilities");
  const burial = useKeyOverlayParams("gbCemeteries");
  useGbOpenSpaceLayers(deps.mapRef, {
    gbBuiltUpAreas: { visible: deps.layerVisibility.gbBuiltUpAreas, opacity: builtUp.gbBuiltUpAreasOpacity ?? 0.7 },
    gbGreenspace: { visible: deps.layerVisibility.gbGreenspace, opacity: park.gbGreenspaceOpacity ?? 0.7 },
    gbSportsFacilities: { visible: deps.layerVisibility.gbSportsFacilities, opacity: sports.gbSportsFacilitiesOpacity ?? 0.7 },
    gbCemeteries: { visible: deps.layerVisibility.gbCemeteries, opacity: burial.gbCemeteriesOpacity ?? 0.7 },
  });
  return null;
};

/** 英國第 3 波：河川、水文測站、防洪設施、海岸侵蝕、浴場（各自一個 PMTiles source）。 */
export const GbRiversHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbRiversLayer");
  const p = useKeyOverlayParams("gbRivers");
  useGbRiversLayer(deps.mapRef, deps.layerVisibility.gbRivers, p.gbRiversOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const GbHydroStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbHydroStationsLayer");
  const p = useKeyOverlayParams("gbHydroStations");
  useGbHydroStationsLayer(deps.mapRef, deps.layerVisibility.gbHydroStations, p.gbHydroStationsOpacity ?? 0.8, p.gbHydroStationsScale ?? 1, deps.isDarkTheme);
  return null;
};

export const GbFloodDefencesHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbFloodDefencesLayer");
  const p = useKeyOverlayParams("gbFloodDefenceAssets");
  useGbFloodDefencesLayer(deps.mapRef, deps.layerVisibility.gbFloodDefenceAssets, p.gbFloodDefenceAssetsOpacity ?? 0.85, deps.isDarkTheme);
  return null;
};

export const GbCoastalErosionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbCoastalErosionLayer");
  const p = useKeyOverlayParams("gbCoastalErosionRisk");
  useGbCoastalErosionLayer(deps.mapRef, deps.layerVisibility.gbCoastalErosionRisk, p.gbCoastalErosionRiskOpacity ?? 0.7, p.gbCoastalErosionRiskPeriodIdx ?? 0, deps.isDarkTheme);
  return null;
};

export const GbBathingWatersHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGbBathingWatersLayer");
  const p = useKeyOverlayParams("gbBathingWaters");
  useGbBathingWatersLayer(deps.mapRef, deps.layerVisibility.gbBathingWaters, p.gbBathingWatersOpacity ?? 0.85, p.gbBathingWatersScale ?? 1, deps.isDarkTheme);
  return null;
};
