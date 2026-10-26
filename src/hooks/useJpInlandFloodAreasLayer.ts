import { useEffect } from "react";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_INLAND_FLOOD_ATTRIBUTION,
  JP_INLAND_FLOOD_STEPS,
  jpInlandFloodFillColor,
} from "../data/jpInlandFloodTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { gridRampFor, useGridPaletteSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-inland-flood-areas";
const SOURCE_LAYER = "jp_inland_flood_areas";
const LAYER_ID = "jp-inland-flood-areas-fill";
const FILE = "jp_inland_flood_areas.pmtiles?v=21eb77d38c59";
// 契約：PMTiles z8–14、z12 起全保留；低於 z8 沒有磚。
const MINZOOM = 8;
const MAXZOOM = 14;
const OPACITY_DEFAULT = Number(paramDefault("jpInlandFloodAreas", "jpInlandFloodAreasOpacity"));

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

/** 色盤選單＋底圖 → depth_rank 1–8 的 match 表達式（圖例讀同一組色階）。 */
export function jpInlandFloodColor(isDark: boolean) {
  return jpInlandFloodFillColor(gridRampFor("jpInlandFloodAreas", isDark, JP_INLAND_FLOOD_STEPS));
}

function fillLayer(opacity: number, isDark: boolean): FillLayer {
  const color = jpInlandFloodColor(isDark);
  return {
    id: LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: MINZOOM,
    layout: { visibility: "none" },
    paint: hookFillPaint(
      "jpInlandFloodAreas", LAYER_ID,
      { "fill-color": color, "fill-opacity": clampOpacity(opacity) },
      { "fill-color": color, "fill-opacity": OPACITY_DEFAULT },
    ),
  } as FillLayer;
}

/**
 * 日本內水浸水想定區域（A51，想定最大規模降雨）：靜態 PMTiles 面層，depth_rank 1–8 分級。
 * 只涵蓋 28 個市町村；無資料≠無風險（圖例與 popup 必須寫明）。與外水洪水 `jpWaterFloodHazard` 是不同的層。
 */
export function useJpInlandFloodAreasLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const palette = useGridPaletteSignature("jpInlandFloodAreas");

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
          attribution: JP_INLAND_FLOOD_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(fillLayer(opacity, isDarkTheme));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "fill-opacity", hookFillOpacity("jpInlandFloodAreas", LAYER_ID, clampOpacity(opacity), OPACITY_DEFAULT));
        map.setPaintProperty(LAYER_ID, "fill-color", jpInlandFloodColor(isDarkTheme) as never);
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-inland-flood-areas:render", "內水浸水想定 雨水出水浸水想定区域載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, isDarkTheme, mapTick, palette]);
}
