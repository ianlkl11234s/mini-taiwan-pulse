import { useEffect } from "react";
import type { ExpressionSpecification, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_ROAD_ATTRIBUTION,
  JP_ROAD_COLOR_EXPRESSION,
  JP_ROAD_SORT_KEY,
  JP_ROAD_CLASSES,
  jpRoadFilter,
} from "../data/jpRoadTypes";
import { LINE_WIDTH } from "../map/mapStyleScale";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-major-roads";
const SOURCE_LAYER = "jp_major_roads";
const LAYER_ID = "jp-major-roads-line";
const FILE = "jp_major_roads.pmtiles?v=c5921aa49cee";
// 契約：PMTiles z6–13；z6–8 只有國道與高速，都道府縣道 z9 起；z14 以上由前端 overzoom（source maxzoom=13）。
const MINZOOM = 6;
const MAXZOOM = 13;
const OPACITY_DEFAULT = Number(paramDefault("jpMajorRoads", "jpMajorRoadsOpacity"));

/** L-1 三階依道路等級：zoom interpolate 外殼、各停點內 match 等級；widthScale 為線寬滑桿。 */
export function jpRoadWidthExpression(widthScale = 1): ExpressionSpecification {
  const at = (i: 0 | 1) => [
    "match", ["get", "road_class_code"],
    ...JP_ROAD_CLASSES.flatMap((c) => [c.code, LINE_WIDTH[c.tier][i] * widthScale]),
    LINE_WIDTH.thin[i] * widthScale,
  ];
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)] as unknown as ExpressionSpecification;
}

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function lineLayer(opacity: number, classIdx: number): LineLayer {
  const filter = jpRoadFilter(classIdx);
  const width = jpRoadWidthExpression();
  return {
    id: LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: MINZOOM,
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none", ...hookLineLayout("jpMajorRoads", LAYER_ID), "line-sort-key": JP_ROAD_SORT_KEY },
    paint: hookLinePaint(
      "jpMajorRoads", LAYER_ID,
      { "line-color": JP_ROAD_COLOR_EXPRESSION, "line-width": width, "line-opacity": clampOpacity(opacity) },
      { "line-color": JP_ROAD_COLOR_EXPRESSION, "line-width": width, "line-opacity": OPACITY_DEFAULT },
    ),
  } as LineLayer;
}

/**
 * 日本主要道路（N13：國道、都道府縣道、高速自動車國道等）：靜態 PMTiles 線層，依 road_class_code 上色與分線寬，
 * line-sort-key 讓高速／國道畫在縣道上面。不含市町村道，不可拿來算道路密度或里程（圖例已寫）。
 */
export function useJpMajorRoadsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  classIdx: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, "visibility", "none");
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
          attribution: JP_ROAD_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(lineLayer(opacity, classIdx));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "line-opacity", hookLineOpacity("jpMajorRoads", LAYER_ID, clampOpacity(opacity), OPACITY_DEFAULT));
        map.setFilter(LAYER_ID, jpRoadFilter(classIdx));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-major-roads:render", "主要道路 主要道路載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, classIdx, mapTick]);
}
