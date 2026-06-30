import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, ExpressionSpecification, CircleLayer } from "mapbox-gl";
import {
  fetchEarthquakesGlobal,
  earthquakesGlobalToGeoJSON,
  type EarthquakeGlobalEvent,
} from "../data/earthquakesGlobalLoader";

// USGS 全球地震 — 累積展示，依規模分大小、依深度分色（同 CWA earthquake 配色邏輯）。
// 不接 timeline filter（先做最簡：全部顯示最近 2000 筆）。

const SOURCE_ID = "earthquakes-global";
const LAYER_ID = "earthquakes-global-circle";

const RADIUS_EXPR = [
  "interpolate", ["linear"], ["get", "mag"],
  2, 2,
  4, 5,
  5, 9,
  6, 15,
  7, 22,
  8, 30,
] as unknown as ExpressionSpecification;

const COLOR_EXPR = [
  "interpolate", ["linear"], ["get", "depth_km"],
  0, "#dc2626",
  30, "#f97316",
  70, "#facc15",
  150, "#38bdf8",
  300, "#3949ab",
] as unknown as ExpressionSpecification;

export function useEarthquakesGlobalLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.9,
) {
  const eventsRef = useRef<EarthquakeGlobalEvent[]>([]);
  const dataReadyRef = useRef(false);
  const layerReadyRef = useRef(false);

  // 載入一次（lazy）
  useEffect(() => {
    if (!visible || dataReadyRef.current) return;
    let cancelled = false;
    fetchEarthquakesGlobal()
      .then((evs) => {
        if (cancelled) return;
        eventsRef.current = evs;
        dataReadyRef.current = true;
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) ensureSource(map);
      })
      .catch((err) => console.warn("[EarthquakesGlobal] load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current) return false;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: earthquakesGlobalToGeoJSON(eventsRef.current),
      });
    }
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": RADIUS_EXPR,
          "circle-color": COLOR_EXPR,
          "circle-opacity": 0.55,
          "circle-stroke-color": COLOR_EXPR,
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.8,
        },
      } as CircleLayer);
    }
    layerReadyRef.current = true;
    return true;
  }, []);

  // visibility + opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!ensureSource(map)) return;
    if (map.getLayer(LAYER_ID)) {
      map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
      const o = Math.max(0, Math.min(1, opacity));
      map.setPaintProperty(LAYER_ID, "circle-opacity", 0.55 * o);
      map.setPaintProperty(LAYER_ID, "circle-stroke-opacity", 0.8 * o);
    }
  }, [visible, opacity, ensureSource, mapRef]);
}
