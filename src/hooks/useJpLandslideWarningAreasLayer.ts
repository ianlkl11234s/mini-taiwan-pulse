import { useEffect } from "react";
import type { FillLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_LANDSLIDE_ATTRIBUTION,
  JP_LANDSLIDE_SORT_KEY,
  JP_LANDSLIDE_ZONE_COLOR_EXPRESSION,
  jpLandslideFilter,
} from "../data/jpLandslideWarningTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { hookFillOpacity, hookFillPaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import { gbHeatmapBuild, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";
import { repPointHeatIntensity, repPointLayer, repPointThinnedWeight } from "../data/repPointLayers";
import { heatmapMaxzoom } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-landslide-warning-areas";
const SOURCE_LAYER = "jp_landslide_warning_areas";
const LAYER_ID = "jp-landslide-warning-areas-fill";
const FILE = "jp_landslide_warning_areas.pmtiles?v=b85c1008459b";
// 契約：PMTiles z8–12、z12 起全保留；z13 以上由前端 overzoom（source maxzoom=12），低於 z8 沒有磚。
const MINZOOM = 8;
const MAXZOOM = 12;
const OPACITY_DEFAULT = Number(paramDefault("jpLandslideWarningAreas", "jpLandslideWarningAreasOpacity"));

// §3.8 V-5 特例：代表點檔（179 萬點）只有 z4–7，z8 起由面接手。所以「點／面」兩種樣式畫的東西相同——
// z4–8 熱區（maxzoom = heatmapMaxzoom(8)，與面的 minzoom 8 接棒）、z8 起面照畫；面不隨樣式關閉，否則 z8 起會空白。
const REP = repPointLayer("jpLandslideWarningAreas")!;
const POINTS_SOURCE: SourceSpec = {
  id: "jp-landslide-warning-areas-points", file: REP.file, minzoom: 4, maxzoom: REP.maxzoom ?? 7,
  attribution: JP_LANDSLIDE_ATTRIBUTION, loading: "土砂災害警戒區域 代表點載入中",
};
const HEAT_ID = "jp-landslide-warning-areas-heatmap";

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function fillLayer(opacity: number, zoneIdx: number, phenomenonIdx: number): FillLayer {
  const filter = jpLandslideFilter(zoneIdx, phenomenonIdx);
  return {
    id: LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: MINZOOM,
    ...(filter === null ? {} : { filter }),
    layout: { visibility: "none", "fill-sort-key": JP_LANDSLIDE_SORT_KEY },
    paint: hookFillPaint(
      "jpLandslideWarningAreas", LAYER_ID,
      { "fill-color": JP_LANDSLIDE_ZONE_COLOR_EXPRESSION, "fill-opacity": clampOpacity(opacity) },
      { "fill-color": JP_LANDSLIDE_ZONE_COLOR_EXPRESSION, "fill-opacity": OPACITY_DEFAULT },
    ),
  } as FillLayer;
}

/**
 * 日本土砂災害警戒區域（A33）：靜態 PMTiles 面層。紅區（特別警戒）在黃區（警戒）之內，
 * 用 fill-sort-key 讓紅區疊在黃區上面；zoneIdx／phenomenonIdx 見 `jpLandslideFilter`。
 */
export function useJpLandslideWarningAreasLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  zoneIdx: number,
  phenomenonIdx: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature(["jpLandslideWarningAreas"]);
  const heatFilterJson = JSON.stringify(jpLandslideFilter(zoneIdx, phenomenonIdx));
  useGbPmtilesLayers(mapRef, POINTS_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: HEAT_ID, key: "jpLandslideWarningAreas", sourceId: POINTS_SOURCE.id, sourceLayer: REP.sourceLayer,
      maxzoom: heatmapMaxzoom(MINZOOM), filter: JSON.parse(heatFilterJson) as unknown[] | null, isDark: isDarkTheme,
      opacityScale: clampOpacity(opacity) / OPACITY_DEFAULT, intensity: repPointHeatIntensity(REP), weight: repPointThinnedWeight(2.5),
    }),
  ], [opacity, isDarkTheme, heatFilterJson, heatStyle]);

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
          attribution: JP_LANDSLIDE_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(fillLayer(opacity, zoneIdx, phenomenonIdx));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "fill-opacity", hookFillOpacity("jpLandslideWarningAreas", LAYER_ID, clampOpacity(opacity), OPACITY_DEFAULT));
        map.setFilter(LAYER_ID, jpLandslideFilter(zoneIdx, phenomenonIdx));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-landslide-warning-areas:render", "土砂災害警戒區域 土砂災害警戒区域載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, zoneIdx, phenomenonIdx, mapTick]);
}
