import { useEffect } from "react";
import type { CircleLayer, Map as MapboxMap } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { mapSeamColor, POINT_STROKE, pointRadius } from "../map/mapStyleScale";
import { useMapReadyTick } from "./useMapReadyTick";
import { JP_SCHOOL_TYPE_COLOR_EXPRESSION } from "../data/jpSchoolTypes";

const SOURCE_ID = "jp-schools";
const SOURCE_LAYER = "jp_schools";
const LAYER_ID = "jp-schools-circle";
const FILE = "jp_schools.pmtiles";
const MINZOOM = 4;
// ⚠️ 產製配方是 tippecanoe -Z4 -z11 —— 沒有 z12~z14 的磚。
//    這裡若照宗教層寫 14，Mapbox 會去要不存在的磚 → z11 以上整層消失。
const MAXZOOM = 11;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function schoolsCircleLayer(opacity: number, scale: number, isDark: boolean): CircleLayer {
  return {
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    "source-layer": SOURCE_LAYER,
    layout: { visibility: "none" },
    paint: {
      "circle-radius": pointRadius("M", scale),
      "circle-color": JP_SCHOOL_TYPE_COLOR_EXPRESSION,
      "circle-opacity": clampOpacity(opacity),
      "circle-stroke-color": mapSeamColor(isDark),
      "circle-stroke-width": POINT_STROKE.width,
      "circle-stroke-opacity": Math.min(1, POINT_STROKE.opacity[isDark ? "dark" : "light"] * clampOpacity(opacity) / 0.75),
    },
  } as CircleLayer;
}

/** 日本學校：單一 PMTiles point 子層，按学校分類 13 色分色，靜態無時間維度。 */
export function useJpSchoolsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
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
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: absoluteUrl(FILE),
          minzoom: MINZOOM,
          maxzoom: MAXZOOM,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(LAYER_ID)) {
        // 圖層不設 maxzoom；z12+ 必須 overzoom z11 tiles，不能變空白。
        map.addLayer(schoolsCircleLayer(opacity, scale, isDark));
      }
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, "visibility", "visible");
        map.setPaintProperty(LAYER_ID, "circle-opacity", clampOpacity(opacity));
        map.setPaintProperty(LAYER_ID, "circle-radius", pointRadius("M", scale));
        map.setPaintProperty(LAYER_ID, "circle-stroke-color", mapSeamColor(isDark));
        map.setPaintProperty(LAYER_ID, "circle-stroke-width", POINT_STROKE.width);
        map.setPaintProperty(LAYER_ID, "circle-stroke-opacity", Math.min(1, POINT_STROKE.opacity[isDark ? "dark" : "light"] * clampOpacity(opacity) / 0.75));
      }
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, opacity, scale, isDarkTheme, mapTick]);
}
