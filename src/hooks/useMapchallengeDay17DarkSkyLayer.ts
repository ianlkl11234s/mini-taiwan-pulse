import { useEffect, useRef } from "react";
import type { ImageSource, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { LINE_OPACITY, LINE_WIDTH } from "../map/mapStyleScale";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  MAPCHALLENGE_DAY17_ATTRIBUTION, MAPCHALLENGE_DAY17_IMAGE_CORNERS, MAPCHALLENGE_DAY17_PROTECTED_FILL_OPACITY, MAPCHALLENGE_DAY17_PROTECTED_URL,
  mapchallengeDay17Product, mapchallengeDay17ProtectedLineColor,
} from "../data/mapchallengeDay17Types";

/**
 * 30 天地圖挑戰 Day 17「真正的黑夜」：天空光害推估／2025 地面亮度（單張 PNG，Mapbox image source，切影像時 updateImage）
 * ＋ 48 處保護區排名面（geojson，外框＋透明填色當點擊範圍，gisClickRegistry 收 fill）。
 * overlay 引擎不收 image source，所以和 Day 8 都市計畫圖一樣自己掛：raster 插在底圖第一個 symbol 下（不蓋地名），
 * 保護區面疊在最上；style.load 後重掛。
 */
const IMAGE_SOURCE_ID = "mapchallenge-day17-dark-sky";
const RASTER_LAYER_ID = "mapchallenge-day17-dark-sky-raster";
const PROTECTED_SOURCE_ID = "mapchallenge-day17-protected";
export const MAPCHALLENGE_DAY17_PROTECTED_FILL_ID = "mapchallenge-day17-protected-fill";
const PROTECTED_LINE_ID = "mapchallenge-day17-protected-line";
const LAYER_IDS = [RASTER_LAYER_ID, MAPCHALLENGE_DAY17_PROTECTED_FILL_ID, PROTECTED_LINE_ID];

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useMapchallengeDay17DarkSkyLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  productIdx: number,
  isDark: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const value = Math.max(0, Math.min(1, opacity));
    const product = mapchallengeDay17Product(productIdx);
    const mount = () => {
      let loading = false;
      const img = map.getSource(IMAGE_SOURCE_ID) as ImageSource | undefined;
      if (!img) {
        map.addSource(IMAGE_SOURCE_ID, { type: "image", url: product.url, coordinates: MAPCHALLENGE_DAY17_IMAGE_CORNERS });
        // image source 型別沒有 attribution 欄位：補在 instance 上，右下 AttributionBar 才收得到
        const src = map.getSource(IMAGE_SOURCE_ID) as { attribution?: string } | undefined;
        if (src) src.attribution = MAPCHALLENGE_DAY17_ATTRIBUTION;
        urlRef.current = product.url;
        loading = true;
      } else if (urlRef.current !== product.url) {
        img.updateImage({ url: product.url, coordinates: MAPCHALLENGE_DAY17_IMAGE_CORNERS });
        urlRef.current = product.url;
        loading = true;
      }
      if (!map.getSource(PROTECTED_SOURCE_ID)) {
        map.addSource(PROTECTED_SOURCE_ID, { type: "geojson", data: MAPCHALLENGE_DAY17_PROTECTED_URL, attribution: MAPCHALLENGE_DAY17_ATTRIBUTION });
        loading = true;
      }
      const wasVisible = map.getLayer(RASTER_LAYER_ID) && map.getLayoutProperty(RASTER_LAYER_ID, "visibility") === "visible";
      if (!map.getLayer(RASTER_LAYER_ID)) {
        map.addLayer({
          id: RASTER_LAYER_ID, type: "raster", source: IMAGE_SOURCE_ID, layout: { visibility: "none" },
          // 推估值影像：nearest（map-layers G-4 量測值影像）
          paint: { "raster-opacity": value, "raster-resampling": "nearest", "raster-fade-duration": 0 },
        }, firstSymbolLayerId(map));
      }
      if (!map.getLayer(MAPCHALLENGE_DAY17_PROTECTED_FILL_ID)) {
        map.addLayer({
          id: MAPCHALLENGE_DAY17_PROTECTED_FILL_ID, type: "fill", source: PROTECTED_SOURCE_ID, layout: { visibility: "none" },
          paint: { "fill-color": mapchallengeDay17ProtectedLineColor(isDark), "fill-opacity": MAPCHALLENGE_DAY17_PROTECTED_FILL_OPACITY },
        });
      }
      if (!map.getLayer(PROTECTED_LINE_ID)) {
        map.addLayer({
          id: PROTECTED_LINE_ID, type: "line", source: PROTECTED_SOURCE_ID, layout: { visibility: "none", "line-join": "round" },
          paint: {
            "line-color": mapchallengeDay17ProtectedLineColor(isDark),
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, LINE_WIDTH.standard[0], 14, LINE_WIDTH.standard[1]],
            "line-opacity": LINE_OPACITY.standard,
          },
        });
      }
      for (const id of LAYER_IDS) map.setLayoutProperty(id, "visibility", "visible");
      map.setPaintProperty(RASTER_LAYER_ID, "raster-opacity", value);
      map.setPaintProperty(MAPCHALLENGE_DAY17_PROTECTED_FILL_ID, "fill-color", mapchallengeDay17ProtectedLineColor(isDark));
      map.setPaintProperty(PROTECTED_LINE_ID, "line-color", mapchallengeDay17ProtectedLineColor(isDark));
      if (loading || !wasVisible) keepLoadingUntilMapIdle(map, `${IMAGE_SOURCE_ID}:render`, "真正的黑夜 載入中", IMAGE_SOURCE_ID, 8000);
    };
    const onStyleLoad = () => { urlRef.current = null; mount(); };

    mount();
    map.on("style.load", onStyleLoad);
    return () => { map.off("style.load", onStyleLoad); };
  }, [mapRef, visible, opacity, productIdx, isDark, mapTick]);
}
