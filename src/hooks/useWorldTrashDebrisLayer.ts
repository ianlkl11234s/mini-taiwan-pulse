import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, ExpressionSpecification, CircleLayer } from "mapbox-gl";
import { fetchWorldTrashDebris } from "../data/worldTrashDebrisLoader";

// 全球垃圾殘骸（Outerview，CC-BY-4.0）— 靜態載一次，Mapbox 原生 circle。
// 單色小點，radius 依 zoom 內插；不接 timeline（比照 useEarthquakesGlobalLayer）。
// ⚠️ 禁 Three.js CustomLayer（球面低 zoom 變形）。

const SOURCE_ID = "world-trash-debris";
const LAYER_ID = "world-trash-debris-circle";
const FILL_COLOR = "#f59e0b";

// 低 zoom ~2px、高 zoom ~5px。
const RADIUS_EXPR = [
  "interpolate", ["linear"], ["zoom"],
  1, 2,
  6, 3.5,
  12, 5,
] as unknown as ExpressionSpecification;

export function useWorldTrashDebrisLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = 0.85,
) {
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const dataReadyRef = useRef(false);

  // 載入一次（lazy，僅在首次開啟時抓）
  useEffect(() => {
    if (!visible || dataReadyRef.current) return;
    let cancelled = false;
    fetchWorldTrashDebris()
      .then((fc) => {
        if (cancelled) return;
        fcRef.current = fc;
        dataReadyRef.current = true;
        const map = mapRef.current;
        if (map && map.isStyleLoaded()) ensureSource(map);
      })
      .catch((err) => console.warn("[WorldTrashDebris] load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const ensureSource = useCallback((map: MapboxMap) => {
    if (!dataReadyRef.current || !fcRef.current) return false;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: fcRef.current });
    }
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": RADIUS_EXPR,
          "circle-color": FILL_COLOR,
          "circle-opacity": 0.85,
          "circle-stroke-color": "rgba(0,0,0,0.35)",
          "circle-stroke-width": 0.4,
        },
      } as CircleLayer);
    }
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
      map.setPaintProperty(LAYER_ID, "circle-opacity", o);
    }
  }, [visible, opacity, ensureSource, mapRef]);
}
