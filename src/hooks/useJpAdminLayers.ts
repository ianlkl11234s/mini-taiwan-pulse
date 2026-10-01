import { useEffect } from "react";
import type { Map as MapboxMap, FillLayer, LineLayer, ExpressionSpecification } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { paramDefault } from "../data/layerParamsSpec";
import { hookFillOpacity, hookFillPaint, hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";

const opacityDefault = (key: "jpAdminPrefecture" | "jpAdminBoundaries") => Number(paramDefault(key, `${key}Opacity`) ?? 1);

const PREFECTURE_SOURCE_ID = "jp-admin-prefecture";
const PREFECTURE_SOURCE_LAYER = "jp_admin_boundaries_prefecture";
const PREFECTURE_FILL_LAYER_ID = "jp-admin-prefecture-fill";
const PREFECTURE_LINE_LAYER_ID = "jp-admin-prefecture-line";
const PREFECTURE_COLOR = "#f59e0b";
const PREFECTURE_MINZOOM = 2;
const PREFECTURE_MAXZOOM = 9;

const MUNICIPALITY_SOURCE_ID = "jp-admin-municipality";
const MUNICIPALITY_SOURCE_LAYER = "jp_admin_boundaries";
const MUNICIPALITY_FILL_LAYER_ID = "jp-admin-municipality-fill";
const MUNICIPALITY_LINE_LAYER_ID = "jp-admin-municipality-line";
const MUNICIPALITY_COLOR = "#fbbf24";
const MUNICIPALITY_MINZOOM = 4;
const MUNICIPALITY_MAXZOOM = 11;

const LINE_WIDTH: ExpressionSpecification = [
  "interpolate", ["linear"], ["zoom"],
  6, 0.5,
  14, 2,
] as unknown as ExpressionSpecification;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function fillLayer(key: "jpAdminPrefecture" | "jpAdminBoundaries", id: string, source: string, sourceLayer: string, color: string, opacity: number): FillLayer {
  return {
    id,
    type: "fill",
    source,
    "source-layer": sourceLayer,
    layout: { visibility: "none" },
    paint: hookFillPaint(key, id, { "fill-color": color, "fill-opacity": clampOpacity(opacity) }, { "fill-color": color, "fill-opacity": opacityDefault(key) }),
  } as FillLayer;
}

function lineLayer(key: "jpAdminPrefecture" | "jpAdminBoundaries", id: string, source: string, sourceLayer: string, color: string, isDarkTheme: boolean): LineLayer {
  return {
    id,
    type: "line",
    source,
    "source-layer": sourceLayer,
    layout: { visibility: "none", ...hookLineLayout(key, id) },
    paint: hookLinePaint(key, id, { "line-color": color, "line-opacity": 0.6, "line-width": LINE_WIDTH }, { "line-color": color, "line-opacity": 0.6, "line-width": LINE_WIDTH }, isDarkTheme),
  } as LineLayer;
}

interface AdminPolygonConfig {
  key: "jpAdminPrefecture" | "jpAdminBoundaries";
  sourceId: string;
  sourceLayer: string;
  fillLayerId: string;
  lineLayerId: string;
  color: string;
  minzoom: number;
  maxzoom: number;
  file: string;
}

const PREFECTURE_CONFIG: AdminPolygonConfig = {
  key: "jpAdminPrefecture",
  sourceId: PREFECTURE_SOURCE_ID,
  sourceLayer: PREFECTURE_SOURCE_LAYER,
  fillLayerId: PREFECTURE_FILL_LAYER_ID,
  lineLayerId: PREFECTURE_LINE_LAYER_ID,
  color: PREFECTURE_COLOR,
  minzoom: PREFECTURE_MINZOOM,
  maxzoom: PREFECTURE_MAXZOOM,
  file: "jp_admin_boundaries_prefecture.pmtiles",
};

const MUNICIPALITY_CONFIG: AdminPolygonConfig = {
  key: "jpAdminBoundaries",
  sourceId: MUNICIPALITY_SOURCE_ID,
  sourceLayer: MUNICIPALITY_SOURCE_LAYER,
  fillLayerId: MUNICIPALITY_FILL_LAYER_ID,
  lineLayerId: MUNICIPALITY_LINE_LAYER_ID,
  color: MUNICIPALITY_COLOR,
  minzoom: MUNICIPALITY_MINZOOM,
  maxzoom: MUNICIPALITY_MAXZOOM,
  file: "jp_admin_boundaries.pmtiles",
};

function useAdminPolygonLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  config: AdminPolygonConfig,
  isDarkTheme: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(config.fillLayerId)) map.setLayoutProperty(config.fillLayerId, "visibility", "none");
      if (map.getLayer(config.lineLayerId)) map.setLayoutProperty(config.lineLayerId, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(config.sourceId)) {
        map.addSource(config.sourceId, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(config.file),
          minzoom: config.minzoom,
          maxzoom: config.maxzoom,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(config.fillLayerId)) {
        map.addLayer(fillLayer(config.key, config.fillLayerId, config.sourceId, config.sourceLayer, config.color, opacity));
      }
      if (!map.getLayer(config.lineLayerId)) {
        map.addLayer(lineLayer(config.key, config.lineLayerId, config.sourceId, config.sourceLayer, config.color, isDarkTheme));
      }
      if (map.getLayer(config.fillLayerId)) {
        map.setLayoutProperty(config.fillLayerId, "visibility", "visible");
        map.setPaintProperty(config.fillLayerId, "fill-opacity", hookFillOpacity(config.key, config.fillLayerId, clampOpacity(opacity), opacityDefault(config.key)));
      }
      if (map.getLayer(config.lineLayerId)) {
        map.setLayoutProperty(config.lineLayerId, "visibility", "visible");
        map.setPaintProperty(config.lineLayerId, "line-opacity", hookLineOpacity(config.key, config.lineLayerId, 0.6, 0.6, isDarkTheme));
        map.setPaintProperty(config.lineLayerId, "line-color", hookLinePaint(config.key, config.lineLayerId, { "line-color": config.color }, { "line-color": config.color }, isDarkTheme)["line-color"] as string);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, mapTick, config, isDarkTheme]);
}

export interface JpAdminLayerVisibility {
  jpAdminPrefecture: boolean;
  jpAdminBoundaries: boolean;
}

export interface JpAdminLayerOpacity {
  jpAdminPrefecture: number;
  jpAdminBoundaries: number;
}

/** 兩個獨立的 PMTiles polygon 子層（縣界 / 市界），彼此不做前端融合。 */
export function useJpAdminLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: JpAdminLayerVisibility,
  opacity: JpAdminLayerOpacity,
  isDarkTheme = true,
) {
  useAdminPolygonLayer(mapRef, visibility.jpAdminPrefecture, opacity.jpAdminPrefecture, PREFECTURE_CONFIG, isDarkTheme);
  useAdminPolygonLayer(mapRef, visibility.jpAdminBoundaries, opacity.jpAdminBoundaries, MUNICIPALITY_CONFIG, isDarkTheme);
}
