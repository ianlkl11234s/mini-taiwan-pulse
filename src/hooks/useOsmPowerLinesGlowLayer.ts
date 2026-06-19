import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createOsmPowerLinesGlowLayer,
  OSM_POWER_LINES_GLOW_LAYER_ID,
} from "../map/osmPowerLinesGlowCustomLayer";
import type { PowerLineFeature } from "../three/OsmPowerLinesGlowScene";
import { fetchOsmPowerLines, powerLineTierKv } from "../data/energyLoader";

/**
 * Three.js bloom glow layer 取代 Mapbox 4-line stacking 的視覺方案。
 * 共用既有的 osmPowerLines visibility + opacity + width slider。
 */
export function useOsmPowerLinesGlowLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  widthMul: number,
) {
  const featuresRef = useRef<PowerLineFeature[] | null>(null);
  const visibleRef = useRef(visible);
  const opacityRef = useRef(opacity);
  const widthRef = useRef(widthMul);
  visibleRef.current = visible;
  opacityRef.current = opacity;
  widthRef.current = widthMul;

  // Mount custom layer once
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layer = createOsmPowerLinesGlowLayer({
      getIsVisible: () => visibleRef.current,
      getOpacity:   () => opacityRef.current,
      getWidthMul:  () => widthRef.current,
      getFeatures:  () => featuresRef.current,
    });

    const onStyleLoad = () => {
      if (!map.getLayer(OSM_POWER_LINES_GLOW_LAYER_ID)) map.addLayer(layer);
      map.triggerRepaint();
    };
    if (map.isStyleLoaded()) {
      if (!map.getLayer(OSM_POWER_LINES_GLOW_LAYER_ID)) map.addLayer(layer);
    }
    map.on("style.load", onStyleLoad);

    return () => {
      map.off("style.load", onStyleLoad);
      if (map.getLayer(OSM_POWER_LINES_GLOW_LAYER_ID)) {
        map.removeLayer(OSM_POWER_LINES_GLOW_LAYER_ID);
      }
    };
  }, [mapRef]);

  // Lazy fetch lines when first visible
  useEffect(() => {
    if (!visible || featuresRef.current) return;
    let cancelled = false;
    fetchOsmPowerLines()
      .then((rows) => {
        if (cancelled) return;
        const features: PowerLineFeature[] = [];
        for (const r of rows) {
          const geom = r.geom_json as GeoJSON.LineString;
          if (!geom || geom.type !== "LineString") continue;
          const tier = powerLineTierKv(r.voltage);
          features.push({
            coords: geom.coordinates as [number, number][],
            tier,
          });
        }
        featuresRef.current = features;
        mapRef.current?.triggerRepaint();
      })
      .catch((err) => console.warn("[osmPowerLinesGlow] fetch failed:", err));
    return () => { cancelled = true; };
  }, [visible, mapRef]);

  // Param change → repaint
  useEffect(() => {
    mapRef.current?.triggerRepaint();
  }, [visible, opacity, widthMul, mapRef]);
}
