import { useEffect } from "react";
import type { CircleLayer, FilterSpecification, Map as MapboxMap } from "mapbox-gl";
import {
  JP_POLICE_ATTRIBUTION,
  JP_POLICE_FACILITY_TYPES,
  JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION,
} from "../data/jpPoliceFacilityTypes";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { mapSeamColor, POINT_STROKE, pointRadius } from "../map/mapStyleScale";
import { useMapReadyTick } from "./useMapReadyTick";

const SOURCE_ID = "jp-police-facilities";
const SOURCE_LAYER = "jp_police_facilities";
const LAYER_ID = "jp-police-facilities-circle";
// Content revision prevents mixing cached byte ranges from the previous sparse archive.
const FILE = "jp_police_facilities.pmtiles?v=3b6236fbf0a9";
const MINZOOM = 5;
const MAXZOOM = 14;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
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
    ...(initialFilter === undefined
      ? {}
      : { filter: initialFilter }),
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("M", scale),
      "circle-color": JP_POLICE_FACILITY_TYPE_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      "circle-stroke-color": mapSeamColor(isDark),
      "circle-stroke-width": POINT_STROKE.width,
      "circle-stroke-opacity": Math.min(1, POINT_STROKE.opacity[isDark ? "dark" : "light"] * clampOpacity(opacity) / 0.75),
    },
  } as CircleLayer;
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
      if (!map.getLayer(LAYER_ID)) map.addLayer(policeCircleLayer(opacity, scale, typeIndex, isDark));
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("M", scale));
        map.setPaintProperty(LAYER_ID, "circle-stroke-color", mapSeamColor(isDark));
        map.setPaintProperty(LAYER_ID, "circle-stroke-width", POINT_STROKE.width);
        map.setPaintProperty(LAYER_ID, "circle-stroke-opacity", Math.min(1, POINT_STROKE.opacity[isDark ? "dark" : "light"] * clampOpacity(opacity) / 0.75));
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
