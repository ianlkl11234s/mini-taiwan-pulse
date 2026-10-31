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
const DETAIL_LAYER_ID = "jp-major-roads-line";
const FILE = "jp_major_roads.pmtiles?v=c5921aa49cee";
// §3.8 V-1／V-2：z5（全國視角）另有小檔（只含高速道路與一般國道），兩個 source 接續：z5 小檔畫到 z5.5 前，原檔 z5.5 起
// （pmtiles source 的圖磚縮放四捨五入，z5.5 起抓 z6 圖磚，z5 小檔此時畫不出來）
const Z5_SOURCE_ID = "jp-major-roads-z5";
const Z5_LAYER_ID = "jp-major-roads-z5-line";
const Z5_FILE = "jp_major_roads_z5.pmtiles";
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

function lineLayer(opacity: number, classIdx: number, z5 = false): LineLayer {
  const filter = jpRoadFilter(classIdx);
  const width = jpRoadWidthExpression();
  const LAYER_ID = z5 ? Z5_LAYER_ID : DETAIL_LAYER_ID;
  return {
    id: LAYER_ID,
    type: "line",
    source: z5 ? Z5_SOURCE_ID : SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: z5 ? 5 : MINZOOM - 0.5,
    ...(z5 ? { maxzoom: MINZOOM - 0.5 } : {}),
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
      for (const id of [DETAIL_LAYER_ID, Z5_LAYER_ID]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
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
      if (!map.getSource(Z5_SOURCE_ID)) {
        map.addSource(Z5_SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(Z5_FILE),
          attribution: JP_ROAD_ATTRIBUTION,
          minzoom: 5,
          maxzoom: 5,
        } as any);
      }
      if (!map.getLayer(Z5_LAYER_ID)) map.addLayer(lineLayer(opacity, classIdx, true));
      if (!map.getLayer(DETAIL_LAYER_ID)) map.addLayer(lineLayer(opacity, classIdx));
      for (const id of [Z5_LAYER_ID, DETAIL_LAYER_ID]) {
        if (!map.getLayer(id)) continue;
        map.setLayoutProperty(id, "visibility", "visible");
        map.setPaintProperty(id, "line-opacity", hookLineOpacity("jpMajorRoads", id, clampOpacity(opacity), OPACITY_DEFAULT));
        map.setFilter(id, jpRoadFilter(classIdx));
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
