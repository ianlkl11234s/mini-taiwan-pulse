/**
 * 點選的圖層點亮光暈
 *
 * 監聽 featureInfo 變化，把點擊位置 (lng,lat) 渲染成
 * 一顆放在最上層的淡黃色脈動光暈。
 *
 * 設計重點：
 * - 第一次 click 馬上看到（不靠 RAF ramp，paint 起始值就是可見值）
 * - 透明度故意壓低（不擋住底層 GIS 點本身的顏色）
 * - featureInfo 為 null 或 coords 缺失 → 馬上清空（點別處立即消失）
 */

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { FeatureInfo } from "../types";

const SOURCE_ID = "selected-feature-halo";
const LAYER_OUTER = "selected-feature-halo-outer";
const LAYER_INNER = "selected-feature-halo-inner";

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// 起始可見的 opacity（避免「雙擊才看到」的錯覺）
const OUTER_OPACITY_BASE = 0.22;
const OUTER_OPACITY_RANGE = 0.12;
const INNER_OPACITY_BASE = 0.28;
const INNER_OPACITY_RANGE = 0.18;
const OUTER_R_BASE = 30;
const OUTER_R_RANGE = 8;
const INNER_R_BASE = 11;
const INNER_R_RANGE = 3;

export function useSelectedFeatureHalo(
  mapRef: React.RefObject<MapboxMap | null>,
  featureInfo: FeatureInfo | null,
) {
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number>(0);
  const coordsRef = useRef<[number, number] | null>(null);

  // featureInfo 同步：建/更 source/layer + 立刻把 paint 設成可見起始值
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    coordsRef.current = featureInfo?.coords ?? null;

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
            "circle-radius": OUTER_R_BASE,
            "circle-blur": 0.9,
            "circle-color": "#ffd54f",
            "circle-opacity": 0,           // 起始 0，下面 setData 後設可見值
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
            "circle-radius": INNER_R_BASE,
            "circle-blur": 0.45,
            "circle-color": "#fff59d",
            "circle-opacity": 0,
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
        // 馬上隱形（不等 RAF）
        try {
          map.setPaintProperty(LAYER_OUTER, "circle-opacity", 0);
          map.setPaintProperty(LAYER_INNER, "circle-opacity", 0);
        } catch { /* layer disposed */ }
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

      // 第一幀就可見（雙擊感的解法）
      try {
        map.setPaintProperty(LAYER_OUTER, "circle-opacity", OUTER_OPACITY_BASE + OUTER_OPACITY_RANGE * 0.5);
        map.setPaintProperty(LAYER_OUTER, "circle-radius", OUTER_R_BASE + OUTER_R_RANGE * 0.5);
        map.setPaintProperty(LAYER_INNER, "circle-opacity", INNER_OPACITY_BASE + INNER_OPACITY_RANGE * 0.5);
        map.setPaintProperty(LAYER_INNER, "circle-radius", INNER_R_BASE + INNER_R_RANGE * 0.5);
      } catch { /* layer disposed */ }

      t0Ref.current = performance.now();
    };

    ensure();
  }, [mapRef, featureInfo]);

  // 呼吸動畫（不依賴 featureInfo 重啟，避免閃爍；用 coordsRef 判斷是否要更新）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      if (!coordsRef.current || !map.getLayer(LAYER_OUTER)) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const t = (performance.now() - t0Ref.current) / 1000;
      const phase = (Math.sin(t * (Math.PI * 2) / 1.5) + 1) / 2; // 0–1, 1.5s 週期
      try {
        map.setPaintProperty(LAYER_OUTER, "circle-opacity", OUTER_OPACITY_BASE + OUTER_OPACITY_RANGE * phase);
        map.setPaintProperty(LAYER_OUTER, "circle-radius", OUTER_R_BASE + OUTER_R_RANGE * phase);
        map.setPaintProperty(LAYER_INNER, "circle-opacity", INNER_OPACITY_BASE + INNER_OPACITY_RANGE * phase);
        map.setPaintProperty(LAYER_INNER, "circle-radius", INNER_R_BASE + INNER_R_RANGE * phase);
      } catch { /* layer disposed */ }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [mapRef]);
}
