import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  BUILDINGS_NIGHT_BLOOM_LAYER_ID,
  buildingsNightBloomModule,
  mountLazyCustomLayer,
} from "../map/lazyThreeLayers";

/**
 * 夜景燈光 mode 3 的高樓 bloom 疊層。資料來源復用 buildingsGba 的 pmtile source
 * （source id "buildings-gba" / source-layer "buildings"），不另外 fetch —— render 時
 * 直接 querySourceFeatures 取視野內高樓。visible 由呼叫端組（layer 開 且 modeIdx===3）。
 *
 * ⚠️ Style toggle race：走 try/catch + idle retry（同 usePowerPlantGlowLayer 慣例）。
 */
export function useBuildingsNightBloomLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  minHeight: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const minHeightRef = useRef(minHeight);
  minHeightRef.current = minHeight;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const tryMount = () => {
      if (map.getLayer(BUILDINGS_NIGHT_BLOOM_LAYER_ID)) return;
      try {
        // C1b：three 模組第一次可見才載入；錨點佔住原位置
        mountLazyCustomLayer(map, BUILDINGS_NIGHT_BLOOM_LAYER_ID, buildingsNightBloomModule, (m) => m.createBuildingsNightBloomLayer({
          getIsVisible: () => visibleRef.current,
          getOpacity: () => opacityRef.current,
          getMinHeight: () => minHeightRef.current,
          sourceId: "buildings-gba",
          sourceLayer: "buildings",
        }), () => visibleRef.current);
      } catch (e) {
        console.log("[BuildingsNightBloom] addLayer 失敗 → idle 後重試", e);
        map.once("idle", tryMount);
      }
    };

    tryMount();
    map.on("style.load", tryMount);
    return () => {
      map.off("style.load", tryMount);
    };
  }, [mapRef, visible, mapTick]);
}
