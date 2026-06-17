/**
 * 點選的圖層點亮光暈
 *
 * 監聽 featureInfo 變化，把點擊位置 (lng,lat) 渲染成
 * 一顆放在最上層的淡黃色脈動光暈，讓使用者一眼看到自己點到的點。
 *
 * - source id: "selected-feature-halo"
 * - layer ids: "selected-feature-halo-outer" / "-inner"
 * - featureInfo 為 null 或 coords 缺失 → 自動清空 source
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureInfo } from "../types";

const SOURCE_ID = "selected-feature-halo";
const LAYER_OUTER = "selected-feature-halo-outer";
const LAYER_INNER = "selected-feature-halo-inner";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useSelectedFeatureHalo(
  mapRef: React.RefObject<MapboxMap | null>,
  featureInfo: FeatureInfo | null,
) {
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(0);

  // 確保 source + layers 建立 / data 更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ensure = () => {
      if (!map.isStyleLoaded()) {
        map.once("idle", ensure);
        return;
      }
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_FC });
      }
      if (!map.getLayer(LAYER_OUTER)) {
        map.addLayer({
          id: LAYER_OUTER,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 36,
            "circle-blur": 0.8,
            "circle-color": "#ffd54f",
            "circle-opacity": 0.55,
            "circle-pitch-alignment": "map",
          },
        });
      }
      if (!map.getLayer(LAYER_INNER)) {
        map.addLayer({
          id: LAYER_INNER,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 14,
            "circle-blur": 0.4,
            "circle-color": "#fff59d",
            "circle-stroke-color": "#ffeb3b",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.7,
            "circle-pitch-alignment": "map",
          },
        });
      }

      const src = map.getSource(SOURCE_ID) as
        | (mapboxgl.GeoJSONSource & { setData?: (d: GeoJSON.FeatureCollection) => void })
        | undefined;
      if (!src) return;

      if (!featureInfo || !featureInfo.coords) {
        src.setData?.(EMPTY_FC);
        return;
      }

      const [lng, lat] = featureInfo.coords;
      src.setData?.({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: { layerType: featureInfo.layerType },
          },
        ],
      });

      t0Ref.current = performance.now();
    };

    ensure();
  }, [mapRef, featureInfo]);

  // 呼吸動畫（透明 + 半徑 1.5 s 週期）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let alive = true;

    const tick = () => {
      if (!alive) return;
      const layer = map.getLayer(LAYER_OUTER);
      if (!layer) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = (performance.now() - t0Ref.current) / 1000;
      const phase = (Math.sin(t * (Math.PI * 2) / 1.5) + 1) / 2; // 0–1
      const outerOpacity = featureInfo?.coords ? 0.35 + 0.3 * phase : 0;
      const innerOpacity = featureInfo?.coords ? 0.55 + 0.35 * phase : 0;
      const outerR = 30 + 10 * phase;
      const innerR = 12 + 4 * phase;
      try {
        map.setPaintProperty(LAYER_OUTER, "circle-opacity", outerOpacity);
        map.setPaintProperty(LAYER_OUTER, "circle-radius", outerR);
        map.setPaintProperty(LAYER_INNER, "circle-opacity", innerOpacity);
        map.setPaintProperty(LAYER_INNER, "circle-radius", innerR);
      } catch {
        // layer disposed
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [mapRef, featureInfo]);
}
