import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

interface DustMeta {
  width: number;
  height: number;
  bbox: [number, number, number, number]; // [lonMin, latMin, lonMax, latMax]
  dust_min: number;
  dust_max: number;
  dataset: string;
  valid_at: string;
}

const SOURCE_ID = "dust-forecast-img";
const LAYER_ID = "dust-forecast-raster";

export function useDustForecastLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  // 載 meta + 加 image source（PNG 已預烤棕色色階 + alpha mask，mapbox 直接 raster 顯示）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.log("[DustForecast] mapRef.current=null，等下次 visible 變化");
      return;
    }
    if (!visible) {
      console.log("[DustForecast] visible=false，延後 addLayer");
      return;
    }
    let cancelled = false;

    const ensureLayer = async () => {
      if (cancelled) return;
      // 已存在 → 不重複加
      if (map.getLayer(LAYER_ID)) return;
      try {
        const meta: DustMeta = await fetch("./climate/dust_latest.json", { cache: "no-cache" }).then((r) => r.json());
        if (cancelled) return;
        const [lonMin, latMin, lonMax, latMax] = meta.bbox;
        // valid_at 帶進 PNG URL 破快取（S3 每日重烤 → 前端追得上）
        const pngUrl = "./climate/dust_latest.png" + (meta.valid_at ? `?v=${encodeURIComponent(meta.valid_at)}` : "");
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: "image",
            url: pngUrl,
            coordinates: [
              [lonMin, latMax], // top-left
              [lonMax, latMax], // top-right
              [lonMax, latMin], // bottom-right
              [lonMin, latMin], // bottom-left
            ],
          });
        }
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: "raster",
            source: SOURCE_ID,
            paint: {
              "raster-opacity": opacityRef.current,
              "raster-resampling": "linear",
              "raster-fade-duration": 0,
            },
          });
        }
        console.log(`[DustForecast] ready: ${meta.width}×${meta.height} bbox=[${meta.bbox.join(", ")}] AOD∈[${meta.dust_min.toFixed(3)}, ${meta.dust_max.toFixed(3)}]`);
      } catch (e) {
        console.warn("[DustForecast] load failed:", e);
      }
    };

    if (map.isStyleLoaded()) ensureLayer();
    else map.once("load", ensureLayer);
    map.on("style.load", ensureLayer);

    return () => {
      cancelled = true;
      map.off("style.load", ensureLayer);
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch { /* style 已沒 */ }
    };
  }, [mapRef, visible]);

  // visibility / opacity 即時切
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer(LAYER_ID)) return;
      map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
      map.setPaintProperty(LAYER_ID, "raster-opacity", opacity);
    };
    apply();
    map.on("style.load", apply);
    return () => { map.off("style.load", apply); };
  }, [mapRef, visible, opacity]);
}
