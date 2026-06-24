import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { createRealEstatePointsLayer, RE_POINTS_LAYER_ID } from "../map/realEstatePointsCustomLayer";
import { rePointsStore } from "../state/realEstatePointsStore";

/**
 * 掛載房地產「點」CustomLayer，並把控制欄位（show / excludeTaipei / baseOpacity）寫進 rePointsStore。
 * 時間欄位（cursorTs / mode / 季窗 / fade 窗）由 useRealEstateTimeline 寫。
 *
 * ⚠️ 不要用 isStyleLoaded() 守 mount（style.load 可能已 fire 過）— 沿用 useOsmPowerLinesGlowLayer 的 idle 重試。
 */
export function useRealEstatePointsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  opts: {
    showRental: boolean;
    showSale: boolean;
    showPresale: boolean;
    excludeTaipei: boolean;
    baseOpacity: number;
  },
) {
  const { showRental, showSale, showPresale, excludeTaipei, baseOpacity } = opts;
  const anyShown = showRental || showSale || showPresale;

  // Lazy mount：第一次有任一點層開啟才掛（此時 map 必已 ready）。
  // ⚠️ deps 必含 anyShown — 否則首 render map 還是 null 時 return 後永不重試（ref identity 不變）。
  // 不要用 isStyleLoaded() 守（style.load 可能已 fire 過）— 沿用 idle 重試。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyShown) return;
    const tryMount = () => {
      if (map.getLayer(RE_POINTS_LAYER_ID)) return;
      try {
        map.addLayer(createRealEstatePointsLayer());
      } catch {
        map.once("idle", tryMount);
      }
    };
    tryMount();
    map.on("style.load", tryMount); // 切 basemap → style.load 後重掛
    return () => {
      map.off("style.load", tryMount);
      if (map.getLayer(RE_POINTS_LAYER_ID)) map.removeLayer(RE_POINTS_LAYER_ID);
    };
  }, [mapRef, anyShown]);

  // 控制欄位 → store + 重繪（暫停/切換時的唯一重繪觸發；播放中由 timeline RAF 帶動）
  useEffect(() => {
    rePointsStore.show = [showRental, showSale, showPresale];
    rePointsStore.excludeTaipei = excludeTaipei;
    rePointsStore.baseOpacity = baseOpacity;
    mapRef.current?.triggerRepaint();
  }, [mapRef, showRental, showSale, showPresale, excludeTaipei, baseOpacity]);
}
