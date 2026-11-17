/**
 * useGibsNightLightsLayer — NASA GIBS 衛星夜光（VIIRS 年度合成）XYZ raster，瀏覽器直連上游。
 *
 * - 日期固定（2012／2016 年度合成影像，見 gibsNightLightsTypes），不訂閱 timeStore。
 * - 插在第一個 symbol 圖層下方：底圖標籤與後加的向量圖層（國家公園等）都疊在夜光上面。
 * - 上游 z0–8：source maxzoom 8，更大 zoom overzoom。
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, RasterLayerSpecification, RasterTileSource } from "mapbox-gl";
import { GIBS_ATTRIBUTION, GIBS_MAX_ZOOM } from "../data/gibsSnowTypes";
import { gibsNightLightsProduct, gibsNightLightsTileUrl } from "../data/gibsNightLightsTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

export const GIBS_NIGHT_LIGHTS_SOURCE_ID = "gibs-night-lights-src";
export const GIBS_NIGHT_LIGHTS_LAYER_ID = "gibs-night-lights-layer";

interface Options {
  mapRef: React.RefObject<MapboxMap | null>;
  visible: boolean;
  opacity: number;
  productIdx: number;
}

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useGibsNightLightsLayer({ mapRef, visible, opacity, productIdx }: Options) {
  const mapTick = useMapReadyTick(mapRef);
  const currentUrlRef = useRef<string | null>(null);
  const mapInstRef = useRef<MapboxMap | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    mapInstRef.current = map;
    const url = gibsNightLightsTileUrl(gibsNightLightsProduct(productIdx));

    const run = () => {
      if (!visible) {
        if (map.getLayer(GIBS_NIGHT_LIGHTS_LAYER_ID)) map.setLayoutProperty(GIBS_NIGHT_LIGHTS_LAYER_ID, "visibility", "none");
        return;
      }
      const src = map.getSource(GIBS_NIGHT_LIGHTS_SOURCE_ID) as RasterTileSource | undefined;
      if (!src) {
        map.addSource(GIBS_NIGHT_LIGHTS_SOURCE_ID, {
          type: "raster", tiles: [url], tileSize: 256, minzoom: 0, maxzoom: GIBS_MAX_ZOOM, attribution: GIBS_ATTRIBUTION,
        });
        currentUrlRef.current = url;
        keepLoadingUntilMapIdle(map, `${GIBS_NIGHT_LIGHTS_SOURCE_ID}:render`, "衛星夜光 載入中", GIBS_NIGHT_LIGHTS_SOURCE_ID, 8000);
      } else if (currentUrlRef.current !== url) {
        src.setTiles([url]);
        currentUrlRef.current = url;
        keepLoadingUntilMapIdle(map, `${GIBS_NIGHT_LIGHTS_SOURCE_ID}:render`, "衛星夜光 載入中", GIBS_NIGHT_LIGHTS_SOURCE_ID, 8000);
      }
      if (!map.getLayer(GIBS_NIGHT_LIGHTS_LAYER_ID)) {
        map.addLayer({
          id: GIBS_NIGHT_LIGHTS_LAYER_ID, type: "raster", source: GIBS_NIGHT_LIGHTS_SOURCE_ID,
          // 照片類影像：linear（map-layers G-4）
          paint: { "raster-opacity": opacityRef.current, "raster-resampling": "linear", "raster-fade-duration": 0 },
        } as RasterLayerSpecification, firstSymbolLayerId(map));
      }
      map.setLayoutProperty(GIBS_NIGHT_LIGHTS_LAYER_ID, "visibility", "visible");
    };

    let disposed = false;
    let retryPending = false;
    const retry = () => { retryPending = false; if (!disposed) safeRun(); };
    const safeRun = () => {
      try { run(); } catch {
        if (!disposed && !retryPending) { retryPending = true; map.once("idle", retry); }
      }
    };
    const onStyleLoad = () => { currentUrlRef.current = null; safeRun(); };

    safeRun();
    map.on("style.load", onStyleLoad);
    return () => {
      disposed = true;
      map.off("style.load", onStyleLoad);
      if (retryPending) map.off("idle", retry);
    };
  }, [mapRef, visible, productIdx, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!visible || !map) return;
    try { if (map.getLayer(GIBS_NIGHT_LIGHTS_LAYER_ID)) map.setPaintProperty(GIBS_NIGHT_LIGHTS_LAYER_ID, "raster-opacity", opacity); } catch { /* style 轉換中 */ }
  }, [mapRef, opacity, visible, mapTick]);

  useEffect(() => () => {
    const map = mapInstRef.current;
    try {
      if (map?.getLayer(GIBS_NIGHT_LIGHTS_LAYER_ID)) map.removeLayer(GIBS_NIGHT_LIGHTS_LAYER_ID);
      if (map?.getSource(GIBS_NIGHT_LIGHTS_SOURCE_ID)) map.removeSource(GIBS_NIGHT_LIGHTS_SOURCE_ID);
    } catch { /* map 可能已銷毀 */ }
    currentUrlRef.current = null;
  }, []);
}
