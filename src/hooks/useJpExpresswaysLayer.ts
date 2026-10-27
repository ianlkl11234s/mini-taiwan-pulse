import { useEffect } from "react";
import type { CircleLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_EXPRESSWAY_ATTRIBUTION,
  JP_EXPRESSWAY_COLOR_EXPRESSION,
  JP_EXPRESSWAY_JUNCTION_COLOR_EXPRESSION,
  JP_EXPRESSWAY_JUNCTION_MINZOOM,
  jpExpresswayFilter,
} from "../data/jpRoadTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { lineWidthExpr, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-expressways";
const LINE_SOURCE_LAYER = "jp_expressways";
const POINT_SOURCE_LAYER = "jp_expressway_junctions";
const LINE_LAYER_ID = "jp-expressways-line";
const POINT_LAYER_ID = "jp-expressway-junctions-circle";
const FILE = "jp_expressways.pmtiles?v=b74bad90ddf0";
// 契約：PMTiles z5–13，兩個 layer 全 zoom 全保留（線 1,289、點 2,384）；z14+ overzoom。
const MINZOOM = 5;
const MAXZOOM = 13;
const OPACITY_DEFAULT = Number(paramDefault("jpExpressways", "jpExpresswaysOpacity"));

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function lineLayer(opacity: number, categoryIdx: number): LineLayer {
  const filter = jpExpresswayFilter(categoryIdx);
  const width = lineWidthExpr("emphasis");
  return {
    id: LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    "source-layer": LINE_SOURCE_LAYER,
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none", ...hookLineLayout("jpExpressways", LINE_LAYER_ID) },
    paint: hookLinePaint(
      "jpExpressways", LINE_LAYER_ID,
      { "line-color": JP_EXPRESSWAY_COLOR_EXPRESSION, "line-width": width, "line-opacity": clampOpacity(opacity) },
      { "line-color": JP_EXPRESSWAY_COLOR_EXPRESSION, "line-width": width, "line-opacity": OPACITY_DEFAULT },
    ),
  } as LineLayer;
}

function pointLayer(opacity: number, isDark: boolean): CircleLayer {
  return {
    id: POINT_LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": POINT_SOURCE_LAYER,
    minzoom: JP_EXPRESSWAY_JUNCTION_MINZOOM,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("M"),
      "circle-color": JP_EXPRESSWAY_JUNCTION_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT),
    },
  } as CircleLayer;
}

/**
 * 日本高速道路（N06 令和7年版，2025 年現況）：線依路線種別上色、暫定供用淡化；IC／JCT 點 z9 起。
 * categoryIdx 只篩線（0=全部、1–5 路線種別）；接合部種別沒有 SA/PA。
 */
export function useJpExpresswaysLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  categoryIdx: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of [LINE_LAYER_ID, POINT_LAYER_ID]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      return;
    }

    const mount = () => {
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(SOURCE_ID)) {
        sourceAdded = true;
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(FILE),
          attribution: JP_EXPRESSWAY_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(LINE_LAYER_ID)) map.addLayer(lineLayer(opacity, categoryIdx));
      if (!map.getLayer(POINT_LAYER_ID)) map.addLayer(pointLayer(opacity, isDarkTheme));
      if (map.getLayer(LINE_LAYER_ID)) {
        map.setLayoutProperty(LINE_LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LINE_LAYER_ID, "line-opacity", hookLineOpacity("jpExpressways", LINE_LAYER_ID, clampOpacity(opacity), OPACITY_DEFAULT));
        map.setFilter(LINE_LAYER_ID, jpExpresswayFilter(categoryIdx));
      }
      if (map.getLayer(POINT_LAYER_ID)) {
        map.setLayoutProperty(POINT_LAYER_ID, "visibility", "visible");
        map.setPaintProperty(POINT_LAYER_ID, "circle-opacity", clampOpacity(opacity));
        for (const [k, v] of Object.entries(pointStrokePaint(isDarkTheme, clampOpacity(opacity) / OPACITY_DEFAULT))) {
          map.setPaintProperty(POINT_LAYER_ID, k as "circle-stroke-color", v as never);
        }
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-expressways:render", "高速道路 高速道路載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, categoryIdx, isDarkTheme, mapTick]);
}
