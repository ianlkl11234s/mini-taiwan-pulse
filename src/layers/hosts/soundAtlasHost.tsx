// City Sound Atlas 聲景（實驗）Layer Host：七個家族（飛機／雨／雷／垃圾車／鐵道／道路車流 proxy／施工）共用一支 hook；透明度各自一支。
import { useSoundAtlasLayer } from "../../hooks/useSoundAtlasLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const SoundAtlasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSoundAtlasLayer");
  const v = deps.layerVisibility;
  const pa = useKeyOverlayParams("soundAviation");
  const pr = useKeyOverlayParams("soundRain");
  const pt = useKeyOverlayParams("soundThunder");
  const pw = useKeyOverlayParams("soundWaste");
  const pl = useKeyOverlayParams("soundRail");
  const pd = useKeyOverlayParams("soundRoadTraffic");
  const pk = useKeyOverlayParams("soundRoadwork");
  useSoundAtlasLayer(
    deps.mapRef,
    {
      aviation: v.soundAviation, rain: v.soundRain, thunder: v.soundThunder, waste_collection: v.soundWaste,
      rail: v.soundRail, road_traffic: v.soundRoadTraffic, roadwork: v.soundRoadwork,
    },
    {
      aviation: pa.soundAviationOpacity ?? 0.9,
      rain: pr.soundRainOpacity ?? 0.9,
      thunder: pt.soundThunderOpacity ?? 0.9,
      waste_collection: pw.soundWasteOpacity ?? 0.9,
      rail: pl.soundRailOpacity ?? 0.9,
      road_traffic: pd.soundRoadTrafficOpacity ?? 0.9,
      roadwork: pk.soundRoadworkOpacity ?? 0.9,
    },
  );
  return null;
};
