import { useEffect } from "react";
import type { Map as MapboxMap, RasterLayer } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  HISTORICAL_MAP_ATTRIBUTION, HISTORICAL_MAP_MAX_ZOOM, HISTORICAL_MAP_MIN_ZOOM,
  historicalMapEraByIdx, historicalMapTileUrl,
} from "../data/historicalMapSinica";

/**
 * 臺灣百年歷史地圖（外部 XYZ raster，掃描成品，沒有 feature 可點）。
 * 一個年代一個 source（id 含年代）；換年代＝換 source，舊 source 與 layer 一併移除。
 * 插在底圖第一個 symbol 圖層下面：不蓋住地名，向量點線面 overlay 一律在上（同 useJpGsiTerrainLayers）。
 */
const SOURCE_PREFIX = "historical-map-sinica-source";
const LAYER_ID = "historical-map-sinica-raster";

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

export function useHistoricalMapSinicaLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  eraIdx: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
      return;
    }
    const era = historicalMapEraByIdx(eraIdx);
    const sourceId = `${SOURCE_PREFIX}-${era.value}`;

    const mount = () => {
      const current = map.getLayer(LAYER_ID) as { source?: string } | undefined;
      // 換年代：先移除舊 layer 與舊 source
      if (current && current.source !== sourceId) {
        const oldSource = current.source;
        map.removeLayer(LAYER_ID);
        if (oldSource && map.getSource(oldSource)) map.removeSource(oldSource);
      }
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "raster", tiles: [historicalMapTileUrl(era)], tileSize: 256,
          minzoom: HISTORICAL_MAP_MIN_ZOOM, maxzoom: HISTORICAL_MAP_MAX_ZOOM,
          attribution: HISTORICAL_MAP_ATTRIBUTION,
          ...(era.bounds ? { bounds: era.bounds } : {}),
        });
      }
      const wasVisible = map.getLayer(LAYER_ID) && map.getLayoutProperty(LAYER_ID, "visibility") === "visible";
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID, type: "raster", source: sourceId, minzoom: HISTORICAL_MAP_MIN_ZOOM,
          layout: { visibility: "none" }, paint: { "raster-opacity": clampOpacity(opacity) },
        } as RasterLayer, firstSymbolLayerId(map));
      }
      map.setLayoutProperty(LAYER_ID, "visibility", "visible");
      map.setPaintProperty(LAYER_ID, "raster-opacity", clampOpacity(opacity));
      if (!wasVisible || !current || current.source !== sourceId) {
        keepLoadingUntilMapIdle(map, `${sourceId}:render`, "古地圖載入中", sourceId, 8000);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, eraIdx, mapTick]);
}
