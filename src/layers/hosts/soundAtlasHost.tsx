// City Sound Atlas 聲景（實驗）Layer Host：四個家族（飛機／雨／雷／垃圾車）共用一支 hook；透明度各自一支。
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
  useSoundAtlasLayer(
    deps.mapRef,
    { aviation: v.soundAviation, rain: v.soundRain, thunder: v.soundThunder, waste_collection: v.soundWaste },
    {
      aviation: pa.soundAviationOpacity ?? 0.9,
      rain: pr.soundRainOpacity ?? 0.9,
      thunder: pt.soundThunderOpacity ?? 0.9,
      waste_collection: pw.soundWasteOpacity ?? 0.9,
    },
  );
  return null;
};
