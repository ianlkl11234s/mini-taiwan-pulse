import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createPowerRegionBarsLayer,
  POWER_REGION_BARS_LAYER_ID,
} from "../map/powerRegionBarsCustomLayer";
import type { PowerDashboard } from "../data/energyLoader";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * Layer 3：區域用電 3D bars。掛 CustomLayer，資料源由
 * dashboardRef 來自 [[usePowerDashboard]]（與 HUD 共用，不重複拉 RPC）。
 */
export function usePowerRegionBarsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  dashboardRef: React.RefObject<PowerDashboard | null>,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const mount = () => {
      if (map.getLayer(POWER_REGION_BARS_LAYER_ID)) return;
      const layer = createPowerRegionBarsLayer({
        getIsVisible: () => visibleRef.current,
        getOpacity: () => opacityRef.current,
        getDashboard: () => dashboardRef.current,
      });
      map.addLayer(layer);
      console.info("[PowerRegionBars] CustomLayer mounted");
    };

    if (map.isStyleLoaded()) mount();
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
      // toggle 切 OFF 不 removeLayer，只靠 scene.setVisible 控制
    };
  }, [mapRef, visible, dashboardRef, mapTick]);
}
