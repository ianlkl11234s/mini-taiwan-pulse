import { useEffect } from "react";
import type { CircleLayer, ExpressionSpecification, FilterSpecification, HeatmapLayer, Map as MapboxMap } from "mapbox-gl";
import {
  JP_POLICE_ATTRIBUTION,
  JP_POLICE_DEGRADED_COLOR,
  JP_POLICE_FACILITY_TYPES,
  JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION,
} from "../data/jpPoliceFacilityTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { densePointsFromZoom, heatmapMaxzoom, heatmapOpacity, heatmapPaint, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-police-facilities";
const SOURCE_LAYER = "jp_police_facilities";
const LAYER_ID = "jp-police-facilities-circle";
const HEATMAP_LAYER_ID = "jp-police-facilities-heatmap";
// Content revision prevents mixing cached byte ranges from the previous sparse archive.
const FILE = "jp_police_facilities.pmtiles?v=3b6236fbf0a9";
const MINZOOM = 5;
const MAXZOOM = 14;
// R5（P-4／G-2）：13,195 點（10k–100k）z < 10 畫熱區、z ≥ 10 畫點（source z5 起有磚）。
const POINTS_FROM_ZOOM = densePointsFromZoom(13_195);
// 2026-10-02 校正（本州 z6 視角 heatmap 離線模擬；準則見 overlayRegistry denseHeatmapLayer 說明）
const HEATMAP_INTENSITY = 5;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

const OPACITY_DEFAULT = Number(paramDefault("jpPoliceFacilities", "jpPoliceFacilitiesOpacity"));
const IS_DEGRADED: ExpressionSpecification = ["==", ["get", "geom_status"], "degraded"];

/**
 * 描邊：geom_status=degraded（地址只解析到丁目／町域＝約略位置）是資料編碼，維持橘色 1.5px 外框
 * （圖例「橘色外框＝約略位置」）；其餘點用底圖色細縫。
 */
function policeStrokePaint(isDark: boolean, opacity: number) {
  const seam = pointStrokePaint(isDark, clampOpacity(opacity) / OPACITY_DEFAULT);
  return {
    "circle-stroke-color": ["case", IS_DEGRADED, JP_POLICE_DEGRADED_COLOR, seam["circle-stroke-color"]] as unknown as ExpressionSpecification,
    "circle-stroke-width": ["case", IS_DEGRADED, 1.5, seam["circle-stroke-width"]] as unknown as ExpressionSpecification,
    "circle-stroke-opacity": seam["circle-stroke-opacity"],
  };
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

/** 0=全部；1–4 依 `JP_POLICE_FACILITY_TYPES` 順序選取一種設施。無效 index fail closed。 */
export function jpPoliceFacilityTypeFilter(typeIndex: number): FilterSpecification | null {
  if (typeIndex === 0) return null;
  const type = JP_POLICE_FACILITY_TYPES[typeIndex - 1];
  return type
    ? ["==", ["get", "facility_type"], type.value] as unknown as FilterSpecification
    : ["literal", false] as unknown as FilterSpecification;
}

/** `addLayer` 不接受 `filter: null`；全部類型時必須省略欄位。 */
export function jpPoliceFacilityInitialFilter(typeIndex: number): FilterSpecification | undefined {
  return jpPoliceFacilityTypeFilter(typeIndex) ?? undefined;
}

function policeCircleLayer(opacity: number, scale: number, typeIndex: number, isDark: boolean): CircleLayer {
  const initialFilter = jpPoliceFacilityInitialFilter(typeIndex);
  return {
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    minzoom: POINTS_FROM_ZOOM,
    ...(initialFilter === undefined
      ? {}
      : { filter: initialFilter }),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("M", scale),
      "circle-color": JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      ...policeStrokePaint(isDark, opacity),
    },
  } as CircleLayer;
}

/** G-2 熱區：與點同一個設施類別 filter，畫在出點縮放以下，不可點擊。 */
function policeHeatmapLayer(opacity: number, typeIndex: number): HeatmapLayer {
  const initialFilter = jpPoliceFacilityInitialFilter(typeIndex);
  return {
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    maxzoom: heatmapMaxzoom(POINTS_FROM_ZOOM),
    ...(initialFilter === undefined ? {} : { filter: initialFilter }),
    layout: { visibility: "none" },
    paint: heatmapPaint(clampOpacity(opacity) / OPACITY_DEFAULT, HEATMAP_INTENSITY),
  } as HeatmapLayer;
}

/** 日本警察設施：靜態 PMTiles 點層，z15+ overzoom z14；typeIndex 0=全部、1–4=設施類別。 */
export function useJpPoliceFacilitiesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  typeIndex: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);

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
          attribution: JP_POLICE_ATTRIBUTION,
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(HEATMAP_LAYER_ID)) {
        map.addLayer(policeHeatmapLayer(opacity, typeIndex), map.getLayer(LAYER_ID) ? LAYER_ID : undefined);
      }
      if (map.getLayer(HEATMAP_LAYER_ID)) {
        map.setLayoutProperty(HEATMAP_LAYER_ID, "visibility", "visible");
        map.setPaintProperty(HEATMAP_LAYER_ID, "heatmap-opacity", heatmapOpacity(clampOpacity(opacity) / OPACITY_DEFAULT));
        map.setFilter(HEATMAP_LAYER_ID, jpPoliceFacilityTypeFilter(typeIndex));
      }
      if (!map.getLayer(LAYER_ID)) map.addLayer(policeCircleLayer(opacity, scale, typeIndex, isDark));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("M", scale));
        for (const [k, v] of Object.entries(policeStrokePaint(isDark, opacity))) {
          map.setPaintProperty(LAYER_ID, k as "circle-stroke-color", v as never);
        }
        map.setFilter(LAYER_ID, jpPoliceFacilityTypeFilter(typeIndex));
      }
      if (sourceAdded) {
        keepLoadingUntilMapIdle(map, "jp-police-facilities:render", "警察設施 警察施設載入中", SOURCE_ID);
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, typeIndex, isDarkTheme, mapTick]);
}
