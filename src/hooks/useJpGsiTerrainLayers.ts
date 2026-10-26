import { useEffect } from "react";
import type { Map as MapboxMap, RasterLayer } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 地理院タイル 地形兩層（外部 XYZ raster，已上色成品，沒有 feature 可點）。
 * ZL 依 https://maps.gsi.go.jp/development/ichiran.html（2026-10-27 確認）：陰影起伏図 2–16、色別標高図 5–15。
 * 插在底圖第一個 symbol 圖層下面：不蓋住地名，也不蓋住後加的 overlay（向量點線面一律在上）。
 */
export type JpGsiTerrainKey = "jpGsiHillshade" | "jpGsiRelief";

const GSI_LINK = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';

export const JP_GSI_TERRAIN: Readonly<Record<JpGsiTerrainKey, {
  sourceId: string; layerId: string; tiles: string; minzoom: number; maxzoom: number; attribution: string; loading: string;
}>> = {
  jpGsiHillshade: {
    sourceId: "jp-gsi-hillshade-source",
    layerId: "jp-gsi-hillshade-raster",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png",
    minzoom: 2,
    maxzoom: 16,
    attribution: `${GSI_LINK}（陰影起伏図）`,
    loading: "陰影起伏圖 陰影起伏図載入中",
  },
  jpGsiRelief: {
    sourceId: "jp-gsi-relief-source",
    layerId: "jp-gsi-relief-raster",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
    minzoom: 5,
    maxzoom: 15,
    // 一覧頁對「段彩陰影図」要求附記海域部出處；色別標高図條目也列了這句，保守一併標示。
    attribution: `${GSI_LINK}（色別標高図；海域部は海上保安庁海洋情報部の資料を使用して作成）`,
    loading: "色別標高圖 色別標高図載入中",
  },
};

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

/** 單一地理院地形 raster：預設關閉，只有透明度。 */
export function useJpGsiTerrainLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  key: JpGsiTerrainKey,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cfg = JP_GSI_TERRAIN[key];
    if (!visible) {
      if (map.getLayer(cfg.layerId)) map.setLayoutProperty(cfg.layerId, "visibility", "none");
      return;
    }

    const mount = () => {
      const wasVisible = map.getLayer(cfg.layerId) && map.getLayoutProperty(cfg.layerId, "visibility") === "visible";
      if (!map.getSource(cfg.sourceId)) {
        map.addSource(cfg.sourceId, {
          type: "raster", tiles: [cfg.tiles], tileSize: 256, minzoom: cfg.minzoom, maxzoom: cfg.maxzoom, attribution: cfg.attribution,
        });
      }
      if (!map.getLayer(cfg.layerId)) {
        map.addLayer({
          id: cfg.layerId, type: "raster", source: cfg.sourceId, minzoom: cfg.minzoom,
          layout: { visibility: "none" }, paint: { "raster-opacity": clampOpacity(opacity) },
        } as RasterLayer, firstSymbolLayerId(map));
      }
      map.setLayoutProperty(cfg.layerId, "visibility", "visible");
      map.setPaintProperty(cfg.layerId, "raster-opacity", clampOpacity(opacity));
      if (!wasVisible) keepLoadingUntilMapIdle(map, `${cfg.sourceId}:render`, cfg.loading, cfg.sourceId, 8000);
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, key, visible, opacity, mapTick]);
}
