// City Sound Atlas 聲景（實驗）Layer Host：十個家族（飛機／雨／雷／垃圾車／鐵道／道路車流／施工／風吹樹葉／海浪／河川）共用一支 hook；透明度各自一支。
import { useSoundAtlasLayer } from "../../hooks/useSoundAtlasLayer";
import { useSoundRainGridLayer } from "../../hooks/useSoundRainGridLayer";
import { useSoundRoadGridLayer } from "../../hooks/useSoundRoadGridLayer";
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
  const pv = useKeyOverlayParams("soundWindFoliage");
  const pc = useKeyOverlayParams("soundCoastalWave");
  const pi = useKeyOverlayParams("soundRiverWater");
  useSoundAtlasLayer(
    deps.mapRef,
    {
      aviation: v.soundAviation, rain: v.soundRain, thunder: v.soundThunder, waste_collection: v.soundWaste,
      rail: v.soundRail, road_traffic: v.soundRoadTraffic, roadwork: v.soundRoadwork,
      wind_vegetation: v.soundWindFoliage, coastal_wave: v.soundCoastalWave, river_water: v.soundRiverWater,
    },
    {
      aviation: pa.soundAviationOpacity ?? 0.9,
      rain: pr.soundRainOpacity ?? 0.9,
      thunder: pt.soundThunderOpacity ?? 0.9,
      waste_collection: pw.soundWasteOpacity ?? 0.9,
      rail: pl.soundRailOpacity ?? 0.9,
      road_traffic: pd.soundRoadTrafficOpacity ?? 0.9,
      roadwork: pk.soundRoadworkOpacity ?? 0.9,
      wind_vegetation: pv.soundWindFoliageOpacity ?? 0.9,
      coastal_wave: pc.soundCoastalWaveOpacity ?? 0.9,
      river_water: pi.soundRiverWaterOpacity ?? 0.9,
    },
    // W6-1：示意動畫開關（圖層展開區）；雨預設關
    { rain: !!pr.soundRainAnimation },
  );
  // W6-1：雨網格（北北 250 m；雷達 ∨ 雨量站）
  useSoundRainGridLayer(deps.mapRef, !!v.soundRain, pr.soundRainOpacity ?? 0.9);
  // W6-2：道路車流網格（國道當日實測／臺北典型延伸／新北等級推估）
  useSoundRoadGridLayer(deps.mapRef, !!v.soundRoadTraffic, pd.soundRoadTrafficOpacity ?? 0.9);
  return null;
};
