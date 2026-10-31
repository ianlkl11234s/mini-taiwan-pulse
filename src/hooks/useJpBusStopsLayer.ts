import { useEffect } from "react";
import { hookCategoryFilter } from "../data/categoryFilters";
import type { CircleLayer, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_BUS_STOP_ATTRIBUTION,
  JP_BUS_STOP_CLASS_COLOR_EXPRESSION,
} from "../data/jpBusStopTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-bus-stops";
const SOURCE_LAYER = "jp_bus_stops";
const LAYER_ID = "jp-bus-stops-circle";
const HEATMAP_LAYER_ID = "jp-bus-stops-heatmap";
const FILE = "jp_bus_stops.pmtiles?v=c34f65a20bfd";
const MINZOOM = 5;
const MAXZOOM = 13;
// R5（P-4／G-2）：278_515 點，出點前畫熱區；PMTiles 在出點縮放前為抽稀概覽，不可當筆數依據。
const POINTS_FROM_ZOOM = densePointsFromZoom(278_515);
const HEAT_KEYS = ["jpBusStops"] as const;
const HEATMAP_INTENSITY = 5;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

const OPACITY_DEFAULT = Number(paramDefault("jpBusStops", "jpBusStopsOpacity"));

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}


function circleLayer(opacity: number, scale: number, isDark: boolean): CircleLayer {
  return {
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: POINTS_FROM_ZOOM,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("S", scale),
      "circle-color": JP_BUS_STOP_CLASS_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT),
    },
  } as CircleLayer;
}

/** G-2 熱區：畫在出點縮放以下，不可點擊。 */
function heatmapLayer(opacity: number, isDark: boolean): HeatmapLayer {
  return {
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    maxzoom: heatmapMaxzoom(POINTS_FROM_ZOOM),
    layout: { visibility: "none" },
    paint: heatmapLayerPaint("jpBusStops", isDark, clampOpacity(opacity) / OPACITY_DEFAULT, HEATMAP_INTENSITY),
  } as HeatmapLayer;
}

/** 日本公車站：靜態 PMTiles 點層（2022 年度版），z14+ overzoom z13；無篩選。 */
export function useJpBusStopsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  isDarkTheme = true,
  catMask?: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature(HEAT_KEYS);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
      if (map.getLayer(HEATMAP_LAYER_ID)) map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", "none");
      return;
    }

    const mount = () => {
      const isDark = isDarkTheme;
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(SOURCE_ID)) {
        sourceAdded = true;
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(FILE),
          attribution: JP_BUS_STOP_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(HEATMAP_LAYER_ID)) {
        map.addLayer(heatmapLayer(opacity, isDark), map.getLayer(LAYER_ID) ? LAYER_ID : undefined);
      }
      const catFilter = (hookCategoryFilter("jpBusStops", { jpBusStopsCatMask: catMask as number }) ?? null) as never;
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setFilter(HEATMAP_LAYER_ID, catFilter);
        map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", "visible");
        applyHeatmapStyle(map, HEATMAP_LAYER_ID, "jpBusStops", isDark, clampOpacity(opacity) / OPACITY_DEFAULT);
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(circleLayer(opacity, scale, isDark));
      if (map.getLayer(LAYER_ID)) {
        map.setFilter(LAYER_ID, catFilter);
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("S", scale));
        for (const [k, v] of Object.entries(pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT))) {
          map.setPaintProperty(LAYER_ID, k as "circle-stroke-color", v as never);
        }
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-bus-stops:render", "公車站 バス停載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, isDarkTheme, mapTick, heatStyle, catMask]);
}
