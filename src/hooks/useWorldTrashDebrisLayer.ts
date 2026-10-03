import { useEffect, useRef, useCallback } from "react";
import type { Map as MapboxMap, CircleLayer, HeatmapLayer } from "mapbox-gl";
import { fetchWorldTrashDebris } from "../data/worldTrashDebrisLoader";
import { useMapReadyTick } from "./useMapReadyTick";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";

// 全球垃圾殘骸（Outerview，CC-BY-4.0）— 靜態載一次，Mapbox 原生 circle。
// 單色小點，固定 M 階半徑（R2）；不接 timeline（比照 useEarthquakesGlobalLayer）。
// ⚠️ 禁 Three.js CustomLayer（球面低 zoom 變形）。

const SOURCE_ID = "world-trash-debris";
const LAYER_ID = "world-trash-debris-circle";
const HEATMAP_LAYER_ID = "world-trash-debris-heatmap";
const FILL_COLOR = "#f59e0b";

const OPACITY_DEFAULT = Number(paramDefault("worldTrashDebris", "worldTrashDebrisOpacity"));
// R5（P-4／G-2）：25,000 點（10k–100k）z < 10 畫熱區、z ≥ 10 畫點；熱區共用 GeoJSON source，不可點擊。
const POINTS_FROM_ZOOM = densePointsFromZoom(25_000);
// 2026-10-03 瀏覽器校正（世界 z1.6 地球儀視角：1 幾乎看不見、20 歐洲整片飽和，取 5）
const HEAT_KEYS = ["worldTrashDebris"] as const;
const HEATMAP_INTENSITY = 5;

export function useWorldTrashDebrisLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number = OPACITY_DEFAULT,
  isDarkTheme: boolean = true,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature(HEAT_KEYS);

  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  // ensureSource 是穩定 callback（[] deps），主題走 ref，首次建立（常在 fetch 回來時）才不會用到初始主題
  const isDarkRef = useRef(isDarkTheme);
  isDarkRef.current = isDarkTheme;
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
    if (!map.getLayer(HEATMAP_LAYER_ID)) {
      map.addLayer({
        id: HEATMAP_LAYER_ID,
        type: "heatmap",
        source: SOURCE_ID,
        maxzoom: heatmapMaxzoom(POINTS_FROM_ZOOM),
        paint: heatmapLayerPaint("worldTrashDebris", isDarkRef.current, 1, HEATMAP_INTENSITY),
      } as HeatmapLayer, map.getLayer(LAYER_ID) ? LAYER_ID : undefined);
    }
    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        minzoom: POINTS_FROM_ZOOM,
        paint: {
          "circle-radius": pointRadius("M"),
          "circle-color": FILL_COLOR,
          "circle-opacity": OPACITY_DEFAULT,
          ...pointStrokePaint(isDarkRef.current),
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
    if (map.getLayer(HEATMAP_LAYER_ID)) {
      map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", visible ? "visible" : "none");
      applyHeatmapStyle(map, HEATMAP_LAYER_ID, "worldTrashDebris", isDarkTheme, Math.max(0, Math.min(1, opacity)) / OPACITY_DEFAULT);
    }
    if (map.getLayer(LAYER_ID)) {
      map.setLayoutProperty(LAYER_ID, "visibility", visible ? "visible" : "none");
      const o = Math.max(0, Math.min(1, opacity));
      map.setPaintProperty(LAYER_ID, "circle-opacity", o);
      {
        const stroke = pointStrokePaint(isDarkTheme, o / OPACITY_DEFAULT);
        map.setPaintProperty(LAYER_ID, "circle-stroke-color", stroke["circle-stroke-color"]);
        map.setPaintProperty(LAYER_ID, "circle-stroke-width", stroke["circle-stroke-width"]);
        map.setPaintProperty(LAYER_ID, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
      }
    }
  }, [visible, opacity, isDarkTheme, ensureSource, mapRef, mapTick, heatStyle]);
}
