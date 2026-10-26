import { useEffect } from "react";
import type { CircleLayer, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_WELFARE_ATTRIBUTION,
  JP_WELFARE_COLOR_EXPRESSION,
  JP_WELFARE_LAYER_MAJOR,
  JP_WELFARE_POINT_COUNT,
  jpWelfareFilter,
  type JpWelfareLayerKey,
} from "../data/jpWelfareFacilityTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { applyHeatmapStyle, heatmapLayerPaint, useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

// 兩個 manifest key（障礙／兒童）共用同一份 PMTiles source，各自一組 circle＋heatmap layer，依 major 過濾。
const SOURCE_ID = "jp-welfare-facilities";
const SOURCE_LAYER = "jp_welfare_facilities";
const FILE = "jp_welfare_facilities.pmtiles?v=db5cbd38ce48";
// 契約：PMTiles z5–14，z10 起全保留；z5–9 抽稀概覽不可數筆數；z15+ overzoom。
const MINZOOM = 5;
const MAXZOOM = 14;
const HEATMAP_INTENSITY = 5;

const LAYER_IDS: Readonly<Record<JpWelfareLayerKey, { circle: string; heatmap: string; label: string }>> = {
  jpWelfareDisability: { circle: "jp-welfare-disability-circle", heatmap: "jp-welfare-disability-heatmap", label: "障礙福祉設施 障害福祉施設載入中" },
  jpWelfareChild: { circle: "jp-welfare-child-circle", heatmap: "jp-welfare-child-heatmap", label: "兒童福祉設施 児童福祉施設載入中" },
};

// R5（P-4／G-2）：各層點數決定出點縮放；出點前畫熱區。
const POINTS_FROM_ZOOM: Readonly<Record<JpWelfareLayerKey, number>> = {
  jpWelfareDisability: densePointsFromZoom(JP_WELFARE_POINT_COUNT.jpWelfareDisability),
  jpWelfareChild: densePointsFromZoom(JP_WELFARE_POINT_COUNT.jpWelfareChild),
};

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function opacityDefault(key: JpWelfareLayerKey): number {
  return Number(paramDefault(key, `${key}Opacity`));
}

function circleLayer(key: JpWelfareLayerKey, opacity: number, scale: number, categoryIdx: number, accuracyIdx: number, isDark: boolean): CircleLayer {
  return {
    id: LAYER_IDS[key].circle,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: POINTS_FROM_ZOOM[key],
    filter: jpWelfareFilter(JP_WELFARE_LAYER_MAJOR[key], categoryIdx, accuracyIdx),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("M", scale),
      "circle-color": JP_WELFARE_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      ...pointStrokePaint(isDark, clampOpacity(opacity) / opacityDefault(key)),
    },
  } as CircleLayer;
}

/** G-2 熱區：與點同一個 filter，畫在出點縮放以下，不可點擊。 */
function heatmapLayer(key: JpWelfareLayerKey, opacity: number, categoryIdx: number, accuracyIdx: number, isDark: boolean): HeatmapLayer {
  return {
    id: LAYER_IDS[key].heatmap,
    type: "heatmap",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    maxzoom: heatmapMaxzoom(POINTS_FROM_ZOOM[key]),
    filter: jpWelfareFilter(JP_WELFARE_LAYER_MAJOR[key], categoryIdx, accuracyIdx),
    layout: { visibility: "none" },
    paint: heatmapLayerPaint(key, isDark, clampOpacity(opacity) / opacityDefault(key), HEATMAP_INTENSITY),
  } as HeatmapLayer;
}

/**
 * 日本障礙／兒童福祉設施（P14 令和5年度）：靜態 PMTiles 點層，依 category_code 的性質色組上色。
 * categoryIdx 見 `jpWelfareFilter`（0=全部、色組、中分類單選）；accuracyIdx 0=只畫位置正確度 ≤3（預設）、1=含代表點。
 */
export function useJpWelfareFacilitiesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  key: JpWelfareLayerKey,
  visible: boolean,
  opacity: number,
  scale: number,
  categoryIdx: number,
  accuracyIdx: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const heatStyle = useHeatmapStyleSignature([key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ids = LAYER_IDS[key];
    if (!visible) {
      if (map.getLayer(ids.circle)) map.setLayoutProperty(ids.circle, "visibility", "none");
      if (map.getLayer(ids.heatmap)) map.setLayoutProperty(ids.heatmap, "visibility", "none");
      return;
    }

    const mount = () => {
      const isDark = isDarkTheme;
      const def = opacityDefault(key);
      const filter = jpWelfareFilter(JP_WELFARE_LAYER_MAJOR[key], categoryIdx, accuracyIdx);
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      if (!map.getSource(SOURCE_ID)) {
        sourceAdded = true;
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(FILE),
          attribution: JP_WELFARE_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
        } as any);
      }
      if (!map.getLayer(ids.heatmap)) {
        map.addLayer(heatmapLayer(key, opacity, categoryIdx, accuracyIdx, isDark), map.getLayer(ids.circle) ? ids.circle : undefined);
      }
      if (map.getLayer(ids.heatmap)) {
        map.setLayoutProperty(ids.heatmap, "visibility", "visible");
        applyHeatmapStyle(map, ids.heatmap, key, isDark, clampOpacity(opacity) / def);
        map.setFilter(ids.heatmap, filter);
      }
      if (!map.getLayer(ids.circle)) map.addLayer(circleLayer(key, opacity, scale, categoryIdx, accuracyIdx, isDark));
      if (map.getLayer(ids.circle)) {
        map.setLayoutProperty(ids.circle, "visibility", "visible");
        map.setPaintProperty(ids.circle, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(ids.circle, "circle-radius", pointRadius("M", scale));
        for (const [k, v] of Object.entries(pointStrokePaint(isDark, clampOpacity(opacity) / def))) {
          map.setPaintProperty(ids.circle, k as "circle-stroke-color", v as never);
        }
        map.setFilter(ids.circle, filter);
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, `${SOURCE_ID}:render`, ids.label, SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, key, visible, opacity, scale, categoryIdx, accuracyIdx, isDarkTheme, mapTick, heatStyle]);
}
