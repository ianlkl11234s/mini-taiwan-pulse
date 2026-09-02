// 日本 Japan Batch 2 的 Layer Host：行政區 2 層（PMTiles polygon）＋ 交通 2 層（GeoJSON）。
// clone hosts/climateHosts.tsx 的 JpReligionHost 慣例。

import { useJpAdminLayers } from "../../hooks/useJpAdminLayers";
import { useJpStationsLayer } from "../../hooks/useJpStationsLayer";
import { useJpAirportsLayer } from "../../hooks/useJpAirportsLayer";
import { useJpRailwaysLayer } from "../../hooks/useJpRailwaysLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

/** 日本行政區：都道府県界 + 市区町村界（各自獨立的 PMTiles polygon 子層）。 */
export const JpAdminHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpAdminLayers");
  const prefecture = useKeyOverlayParams("jpAdminPrefecture");
  const municipality = useKeyOverlayParams("jpAdminBoundaries");
  useJpAdminLayers(
    deps.mapRef,
    {
      jpAdminPrefecture: deps.layerVisibility.jpAdminPrefecture,
      jpAdminBoundaries: deps.layerVisibility.jpAdminBoundaries,
    },
    {
      jpAdminPrefecture: prefecture.jpAdminPrefectureOpacity ?? 0.2,
      jpAdminBoundaries: municipality.jpAdminBoundariesOpacity ?? 0.15,
    },
  );
  return null;
};

/** 日本車站：GeoJSON circle，lazy fetch。 */
export const JpStationsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpStationsLayer");
  const p = useKeyOverlayParams("jpStations");
  const colorMode = p.jpStationsColorModeIdx === 1 ? "ridership" : "type";
  useJpStationsLayer(
    deps.mapRef,
    deps.layerVisibility.jpStations,
    p.jpStationsOpacity ?? 0.85,
    p.jpStationsScale ?? 1,
    colorMode,
  );
  return null;
};

/** 日本機場：GeoJSON fill+line，lazy fetch。 */
export const JpAirportsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpAirportsLayer");
  const p = useKeyOverlayParams("jpAirports");
  const displayMode = p.jpAirportsDisplayModeIdx === 1 ? "polygon" : "point";
  useJpAirportsLayer(
    deps.mapRef,
    deps.layerVisibility.jpAirports,
    p.jpAirportsOpacity ?? 0.5,
    displayMode,
  );
  return null;
};

/** 日本鐵道路線：PMTiles line，按事業者種別分色，無時間維度。 */
export const JpRailwaysHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useJpRailwaysLayer");
  const p = useKeyOverlayParams("jpRailways");
  useJpRailwaysLayer(
    deps.mapRef,
    deps.layerVisibility.jpRailways,
    p.jpRailwaysOpacity ?? 0.9,
  );
  return null;
};
