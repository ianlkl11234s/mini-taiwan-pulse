import { useEffect } from "react";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_ZONING_ATTRIBUTION,
  JP_ZONING_COLOR_EXPRESSION,
  jpZoningFilter,
} from "../data/jpZoningUseDistrictTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-zoning-use-districts";
const SOURCE_LAYER = "jp_zoning_use_districts";
const LAYER_ID = "jp-zoning-use-districts-fill";
const FILE = "jp_zoning_use_districts.pmtiles?v=3cab9ffe0c6e";
// 契約：PMTiles z8–14、z12 起全保留；低於 z8 沒有磚。
const MINZOOM = 8;
const MAXZOOM = 14;
const OPACITY_DEFAULT = Number(paramDefault("jpZoningUseDistricts", "jpZoningUseDistrictsOpacity"));

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function fillLayer(opacity: number, classIdx: number): FillLayer {
  const filter = jpZoningFilter(classIdx);
  return {
    id: LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: MINZOOM,
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none" },
    paint: hookFillPaint(
      "jpZoningUseDistricts", LAYER_ID,
      { "fill-color": JP_ZONING_COLOR_EXPRESSION, "fill-opacity": clampOpacity(opacity) },
      { "fill-color": JP_ZONING_COLOR_EXPRESSION, "fill-opacity": OPACITY_DEFAULT },
    ),
  } as FillLayer;
}

/**
 * 日本用途地域（A55，13 類）：靜態 PMTiles 面層，依 youto_code 上色；classIdx 見 `jpZoningFilter`（0=全部、1–3 大類、4–16 單類）。
 * 「－」（無決定）的市町村不畫、猪名川町／延岡市未涵蓋、都市計画区域外沒有面都是正常的（圖例已寫）。
 */
export function useJpZoningUseDistrictsLayer(
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
          attribution: JP_ZONING_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(fillLayer(opacity, classIdx));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "fill-opacity", hookFillOpacity("jpZoningUseDistricts", LAYER_ID, clampOpacity(opacity), OPACITY_DEFAULT));
        map.setFilter(LAYER_ID, jpZoningFilter(classIdx));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-zoning-use-districts:render", "用途地域 用途地域載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, classIdx, mapTick]);
}
