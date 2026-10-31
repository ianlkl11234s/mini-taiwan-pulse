import { useEffect } from "react";
import { hookCategoryFilter } from "../data/categoryFilters";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import { JP_FOREST_ATTRIBUTION, JP_FOREST_COLOR_EXPRESSION } from "../data/jpNationalForestTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-national-forests";
const SOURCE_LAYER = "jp_national_forests";
const LAYER_ID = "jp-national-forests-fill";
const FILE = "jp_national_forests.pmtiles?v=45d19fe32538";
// 契約：PMTiles z8–13、z12 起全保留；z14 以上由前端 overzoom（source maxzoom=13），低於 z8 沒有磚。
const MINZOOM = 8;
const MAXZOOM = 13;
const OPACITY_DEFAULT = Number(paramDefault("jpNationalForests", "jpNationalForestsOpacity"));

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function fillLayer(opacity: number): FillLayer {
  const color = JP_FOREST_COLOR_EXPRESSION;
  return {
    id: LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: MINZOOM,
    layout: { visibility: "none" },
    paint: hookFillPaint(
      "jpNationalForests", LAYER_ID,
      { "fill-color": color, "fill-opacity": clampOpacity(opacity) },
      { "fill-color": color, "fill-opacity": OPACITY_DEFAULT },
    ),
  } as FillLayer;
}

/**
 * 日本国有林（林野庁 国有林GISデータ）：靜態 PMTiles 面層，依機能類型 function_type_en 上色（空白＝灰）。
 * 只有國有林、民有林不在內；每個面是合併分類面，不是小班。
 */
export function useJpNationalForestsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  catMask?: number,
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
          attribution: JP_FOREST_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(fillLayer(opacity));
      if (map.getLayer(LAYER_ID)) {
        map.setFilter(LAYER_ID, (hookCategoryFilter("jpNationalForests", { jpNationalForestsCatMask: catMask as number }) ?? null) as never);
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "fill-opacity", hookFillOpacity("jpNationalForests", LAYER_ID, clampOpacity(opacity), OPACITY_DEFAULT));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-national-forests:render", "国有林 国有林載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, mapTick, catMask]);
}
