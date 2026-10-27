import { useEffect } from "react";
import type { CircleLayer, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_EVACUATION_ATTRIBUTION,
  JP_EVACUATION_SITE_COLOR_EXPRESSION,
  jpEvacuationFilter,
} from "../data/jpEvacuationSiteTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-evacuation-sites";
const SOURCE_LAYER = "jp_evacuation_sites";
const LAYER_ID = "jp-evacuation-sites-circle";
const HEATMAP_LAYER_ID = "jp-evacuation-sites-heatmap";
const FILE = "jp_evacuation_sites.pmtiles?v=f18d3b3114b8";
const MINZOOM = 5;
const MAXZOOM = 14;
// R5（P-4／G-2）：199_346 點，出點前畫熱區；PMTiles 在出點縮放前為抽稀概覽，不可當筆數依據。
const POINTS_FROM_ZOOM = densePointsFromZoom(199_346);
const HEAT_KEYS = ["jpEvacuationSites"] as const;
const HEATMAP_INTENSITY = 5;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

const OPACITY_DEFAULT = Number(paramDefault("jpEvacuationSites", "jpEvacuationSitesOpacity"));

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function circleLayer(opacity: number, scale: number, filterIdx: number, isDark: boolean): CircleLayer {
  const filter = jpEvacuationFilter(filterIdx);
  return {
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: POINTS_FROM_ZOOM,
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("S", scale),
      "circle-color": JP_EVACUATION_SITE_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT),
    },
  } as CircleLayer;
}

/** G-2 熱區：與點同一個 filter，畫在出點縮放以下，不可點擊。 */
function heatmapLayer(opacity: number, filterIdx: number, isDark: boolean): HeatmapLayer {
  const filter = jpEvacuationFilter(filterIdx);
  return {
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    maxzoom: heatmapMaxzoom(POINTS_FROM_ZOOM),
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none" },
    paint: heatmapLayerPaint("jpEvacuationSites", isDark, clampOpacity(opacity) / OPACITY_DEFAULT, HEATMAP_INTENSITY),
  } as HeatmapLayer;
}

/** 日本避難場所：靜態 PMTiles 點層，z15+ overzoom z14；filterIdx 0=全部、1–8 災害種別、9=指定福祉避難所。 */
export function useJpEvacuationSitesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  filterIdx: number,
  isDarkTheme = true,
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
          attribution: JP_EVACUATION_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(HEATMAP_LAYER_ID)) {
        map.addLayer(heatmapLayer(opacity, filterIdx, isDark), map.getLayer(LAYER_ID) ? LAYER_ID : undefined);
      }
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", "visible");
        applyHeatmapStyle(map, HEATMAP_LAYER_ID, "jpEvacuationSites", isDark, clampOpacity(opacity) / OPACITY_DEFAULT);
        map.setFilter(HEATMAP_LAYER_ID, jpEvacuationFilter(filterIdx));
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(circleLayer(opacity, scale, filterIdx, isDark));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("S", scale));
        for (const [k, v] of Object.entries(pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT))) {
          map.setPaintProperty(LAYER_ID, k as "circle-stroke-color", v as never);
        }
        map.setFilter(LAYER_ID, jpEvacuationFilter(filterIdx));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-evacuation-sites:render", "避難場所 避難場所載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, filterIdx, isDarkTheme, mapTick, heatStyle]);
}
