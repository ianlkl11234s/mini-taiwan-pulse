// City Sound Atlas 聲景（實驗）Layer Host：綜合網格＋十個家族（飛機／雨／雷／垃圾車／鐵道／道路車流／施工／風吹樹葉／海浪／河川）共用一支 hook；透明度各自一支。
import { useEffect } from "react";
import { useSoundAtlasLayer } from "../../hooks/useSoundAtlasLayer";
import { useSoundRainGridLayer } from "../../hooks/useSoundRainGridLayer";
import { useSoundRoadGridLayer } from "../../hooks/useSoundRoadGridLayer";
import { useSoundPotentialGridLayer } from "../../hooks/useSoundPotentialGridLayer";
import { useSoundCompositeGridLayer } from "../../hooks/useSoundCompositeGridLayer";
import { COMPOSITE_FAMILIES } from "../../sound/grid/compositeGrid";
import { aviationGateFromSearch, aviationGatePotential } from "../../sound/grid/aviationGates";
import { compositeModeOf, compositeVariantFromSearch, type CompositeVariant } from "../../sound/grid/compositeState";
import { layerParamsStore } from "../../state/layerParamsStore";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { paramStr, useKeyOverlayParams, useLayerParams } from "../layerParamsAccess";

// W6-3：網址指定的飛機網格門檻（W6-10 加綜合聲景呈現方式）只在載入時套一次（之後以圖層展開區為準）
let urlGateApplied = false;
function applyUrlAviationGate(): void {
  if (urlGateApplied || typeof window === "undefined") return;
  urlGateApplied = true;
  const g = aviationGateFromSearch(window.location.search);
  if (g) layerParamsStore.setParam("soundAviation", "soundAviationGate", g);
  // W6-10：綜合聲景呈現方式 ?soundComposite=a|b|c（W6-4 起的舊連結相容）
  const m = compositeVariantFromSearch(window.location.search);
  if (m) layerParamsStore.setParam("soundComposite", "soundCompositeMode", m);
}

/** W6-10：綜合聲景開著時，把目前的呈現方式寫回網址（分享連結記住選項；App 的網址同步會保留這個參數） */
function useCompositeModeUrl(on: boolean, mode: CompositeVariant): void {
  useEffect(() => {
    if (!on || !urlGateApplied) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("soundComposite") === mode) return;
    u.searchParams.set("soundComposite", mode);
    window.history.replaceState(window.history.state, "", u);
  }, [on, mode]);
}

const NONE: readonly never[] = [];

export const SoundAtlasHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useSoundAtlasLayer");
  const v = deps.layerVisibility;
  useEffect(applyUrlAviationGate, []);
  const gate = aviationGatePotential(paramStr(useLayerParams("soundAviation"), "soundAviation", "soundAviationGate"));
  const pa = useKeyOverlayParams("soundAviation");
  const pz = useKeyOverlayParams("soundComposite");
  const compositeMode = compositeModeOf(useLayerParams("soundComposite"));
  useCompositeModeUrl(!!v.soundComposite, compositeMode);
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
    // W6-1／W6-3：示意動畫開關（圖層展開區）；預設關
    {
      rain: !!pr.soundRainAnimation, aviation: !!pa.soundAviationAnimation, rail: !!pl.soundRailAnimation,
      wind_vegetation: !!pv.soundWindFoliageAnimation, coastal_wave: !!pc.soundCoastalWaveAnimation, river_water: !!pi.soundRiverWaterAnimation,
    },
    // W6-4/5：綜合網格開著時，七族在背景載入（單族圖層不必打開）
    v.soundComposite ? COMPOSITE_FAMILIES : NONE,
    { gate, composite: !!v.soundComposite },
  );
  // W6-4/5：綜合網格（W6-10 呈現方式由圖層展開區切換）。放在單族網格之前呼叫，圖層疊在最上面由掛載順序決定（見 hook）
  useSoundCompositeGridLayer(deps.mapRef, !!v.soundComposite, pz.soundCompositeOpacity ?? 0.85, gate, compositeMode, deps.isDarkTheme);
  // W6-1：雨網格（北北 250 m；雷達 ∨ 雨量站）
  useSoundRainGridLayer(deps.mapRef, !!v.soundRain, pr.soundRainOpacity ?? 0.9);
  // W6-2：道路車流網格（國道當日實測／臺北典型延伸／新北等級推估）
  useSoundRoadGridLayer(deps.mapRef, !!v.soundRoadTraffic, pd.soundRoadTrafficOpacity ?? 0.9);
  // W6-3：連續潛勢網格（北北 250 m；飛機讀每日包、鐵道每幀即時算、自然三族空間場＋每站時間項）
  useSoundPotentialGridLayer(deps.mapRef, "aviation", !!v.soundAviation, pa.soundAviationOpacity ?? 0.9, gate);
  useSoundPotentialGridLayer(deps.mapRef, "rail", !!v.soundRail, pl.soundRailOpacity ?? 0.9);
  useSoundPotentialGridLayer(deps.mapRef, "wind_vegetation", !!v.soundWindFoliage, pv.soundWindFoliageOpacity ?? 0.9);
  useSoundPotentialGridLayer(deps.mapRef, "coastal_wave", !!v.soundCoastalWave, pc.soundCoastalWaveOpacity ?? 0.9);
  useSoundPotentialGridLayer(deps.mapRef, "river_water", !!v.soundRiverWater, pi.soundRiverWaterOpacity ?? 0.9);
  return null;
};
