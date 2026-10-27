import { useEffect } from "react";
import type { CircleLayer, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_PUBLIC_OFFICE_ATTRIBUTION,
  JP_PUBLIC_OFFICE_CLASS_COLOR_EXPRESSION,
  jpPublicOfficeFilter,
} from "../data/jpPublicOfficeTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-public-offices";
const SOURCE_LAYER = "jp_public_offices";
const LAYER_ID = "jp-public-offices-circle";
const HEATMAP_LAYER_ID = "jp-public-offices-heatmap";
const FILE = "jp_public_offices.pmtiles?v=c5d56c6347ad";
const MINZOOM = 5;
const MAXZOOM = 14;
// R5（P-4／G-2）：79_532 點，出點前畫熱區；PMTiles 在出點縮放前為抽稀概覽，不可當筆數依據。
const POINTS_FROM_ZOOM = densePointsFromZoom(79_532);
const HEAT_KEYS = ["jpPublicOffices"] as const;
const HEATMAP_INTENSITY = 5;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

const OPACITY_DEFAULT = Number(paramDefault("jpPublicOffices", "jpPublicOfficesOpacity"));

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function circleLayer(opacity: number, scale: number, filterIdx: number, isDark: boolean): CircleLayer {
  const filter = jpPublicOfficeFilter(filterIdx);
  return {
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: POINTS_FROM_ZOOM,
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("M", scale),
      "circle-color": JP_PUBLIC_OFFICE_CLASS_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT),
    },
  } as CircleLayer;
}

/** G-2 熱區：與點同一個 filter，畫在出點縮放以下，不可點擊。 */
function heatmapLayer(opacity: number, filterIdx: number, isDark: boolean): HeatmapLayer {
  const filter = jpPublicOfficeFilter(filterIdx);
  return {
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    maxzoom: heatmapMaxzoom(POINTS_FROM_ZOOM),
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none" },
    paint: heatmapLayerPaint("jpPublicOffices", isDark, clampOpacity(opacity) / OPACITY_DEFAULT, HEATMAP_INTENSITY),
  } as HeatmapLayer;
}

/** 日本役所與公民館：靜態 PMTiles 點層；filterIdx 0=預設（隱藏集會施設）、1=全部、2–6=單一分類。 */
export function useJpPublicOfficesLayer(
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
          attribution: JP_PUBLIC_OFFICE_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(HEATMAP_LAYER_ID)) {
        map.addLayer(heatmapLayer(opacity, filterIdx, isDark), map.getLayer(LAYER_ID) ? LAYER_ID : undefined);
      }
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", "visible");
        applyHeatmapStyle(map, HEATMAP_LAYER_ID, "jpPublicOffices", isDark, clampOpacity(opacity) / OPACITY_DEFAULT);
        map.setFilter(HEATMAP_LAYER_ID, jpPublicOfficeFilter(filterIdx));
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(circleLayer(opacity, scale, filterIdx, isDark));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("M", scale));
        for (const [k, v] of Object.entries(pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT))) {
          map.setPaintProperty(LAYER_ID, k as "circle-stroke-color", v as never);
        }
        map.setFilter(LAYER_ID, jpPublicOfficeFilter(filterIdx));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-public-offices:render", "役所與公民館 市町村役場・公民館載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, filterIdx, isDarkTheme, mapTick, heatStyle]);
}
