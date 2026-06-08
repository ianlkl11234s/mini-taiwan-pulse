import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { fetchLatestPrecipRaster, type PrecipRasterFrame } from "../data/precipRasterLoader";
import { createCwaImageryLayer, type CwaImageryLayerHandle } from "../map/cwaImageryLayer";

/**
 * 累積雨量柵格 — Mapbox image source + raster layer
 *
 * 切 cumulativeHours (1/3/6/24) 時：fetch 新 PNG → handle.setUrl()
 * 每 60 分鐘 refresh 一次（IoW collector 也是每小時）
 */

const SOURCE_ID = "precip-raster";
const LAYER_ID = "precip-raster-layer";
const REFRESH_MS = 60 * 60 * 1000;

export function usePrecipRasterLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  cumulativeHours: 1 | 3 | 6 | 24,
  opacity: number,
) {
  const handleRef = useRef<CwaImageryLayerHandle | null>(null);
  const lastUrlRef = useRef<string>("");

  useEffect(() => {
    if (!visible) {
      handleRef.current?.setVisible(false);
      return;
    }
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const revokeLast = () => {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = "";
      }
    };

    const ensureAndDraw = (frame: PrecipRasterFrame) => {
      if (cancelled) return;
      if (!handleRef.current) {
        handleRef.current = createCwaImageryLayer(map, {
          sourceId: SOURCE_ID,
          layerId: LAYER_ID,
          bbox: {
            lonMin: frame.ulLng,
            lonMax: frame.brLng,
            latMin: frame.brLat,
            latMax: frame.ulLat,
          },
          initialUrl: frame.url,
          opacity,
        });
      } else {
        handleRef.current.setUrl(frame.url);
      }
      handleRef.current.setOpacity(opacity);
      handleRef.current.setVisible(true);
      revokeLast();
      lastUrlRef.current = frame.url;
    };

    const load = async () => {
      try {
        const frame = await fetchLatestPrecipRaster(cumulativeHours);
        if (cancelled) {
          if (frame) URL.revokeObjectURL(frame.url);
          return;
        }
        if (!frame) {
          console.warn(`[PrecipRaster] no frame for ${cumulativeHours}h`);
          return;
        }
        const tryDraw = () => {
          if (cancelled) return;
          if (!map.isStyleLoaded()) return;
          ensureAndDraw(frame);
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        };
        if (map.isStyleLoaded()) tryDraw();
        else pollTimer = setInterval(tryDraw, 200);
        console.log(`[PrecipRaster] loaded ${cumulativeHours}h @ ${frame.observedAtIso}`);
      } catch (err) {
        console.warn("[PrecipRaster] fetch failed:", err);
      }
    };

    load();
    refreshTimer = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (refreshTimer) clearInterval(refreshTimer);
      handleRef.current?.setVisible(false);
    };
  }, [mapRef, visible, cumulativeHours, opacity]);

  // cleanup object URL on full unmount
  useEffect(() => () => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
  }, []);
}
