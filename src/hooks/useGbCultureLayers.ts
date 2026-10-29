import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_ARTS_KINDS, GB_CULTURAL_KINDS, GB_CULTURAL_OSM_FILL_FACTOR, GB_CULTURAL_OSM_STROKE_WIDTH, GB_CULTURE_FALLBACK_COLOR,
  GB_CULTURE_MINZOOM, GB_CULTURE_TILE_ZOOM, GB_LIBRARIES_NI_ATTRIBUTION, GB_VISITOR_KINDS,
} from "../data/gbCultureTypes";
import { GB_OSM_ATTRIBUTION } from "../data/gbCivicTypes";
import { useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 8 波文化與觀光 3 層：文化設施（官方實心、OSM 補缺同色空心）、藝文場館、
 * 觀光體驗（景點 z9 起、其他 z7 起，同 source 兩個 circle）。靜態資料、不訂閱時間。
 */
export const GB_CULTURAL_FACILITIES_CIRCLE_ID = "gb-cultural-facilities-circle";
export const GB_ARTS_VENUES_CIRCLE_ID = "gb-arts-venues-circle";
export const GB_VISITOR_ATTRACTION_CIRCLE_ID = "gb-visitor-attraction-circle";
export const GB_VISITOR_OTHER_CIRCLE_ID = "gb-visitor-other-circle";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
function kindColor(pairs: readonly { value: string; color: string }[]): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "kind"], ""]];
  for (const p of pairs) expr.push(p.value, p.color);
  expr.push(GB_CULTURE_FALLBACK_COLOR);
  return expr;
}
/** 一般點：類別色＋底圖色細縫（P-2 A）。 */
function pointPaint(key: string, color: unknown, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault(key)),
    "circle-color": color,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault(key, 0.8)),
  };
}
const source = (id: string, file: string, attribution: string, loading: string): SourceSpec => ({ id, file, ...GB_CULTURE_TILE_ZOOM, attribution, loading });

// ─────────────────────────── 文化設施 ───────────────────────────

const CULTURAL_SOURCE = source("gb-cultural-facilities", "gb_cultural_facilities.pmtiles", `${GB_OSM_ATTRIBUTION}; ${GB_LIBRARIES_NI_ATTRIBUTION}`, "英國文化設施載入中");
const IS_OSM: Expr = ["==", ["get", "source"], "osm"];
/** 官方（Libraries NI）實心＋底圖色細縫；OSM 補缺同色空心（比照第 7 波消防站）。 */
function culturalPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const color = kindColor(GB_CULTURAL_KINDS);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbCulturalFacilities", 0.8));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbCulturalFacilities")),
    "circle-color": color,
    "circle-opacity": ["case", IS_OSM, op * GB_CULTURAL_OSM_FILL_FACTOR, op],
    "circle-stroke-color": ["case", IS_OSM, color, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_OSM, GB_CULTURAL_OSM_STROKE_WIDTH, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_OSM, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbCulturalFacilitiesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, CULTURAL_SOURCE, visible, () => [{
    id: GB_CULTURAL_FACILITIES_CIRCLE_ID,
    layer: () => ({
      id: GB_CULTURAL_FACILITIES_CIRCLE_ID, type: "circle", source: CULTURAL_SOURCE.id, "source-layer": "gb_cultural_facilities",
      minzoom: GB_CULTURE_MINZOOM.default, layout: { visibility: "none" }, paint: culturalPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_CULTURAL_FACILITIES_CIRCLE_ID, culturalPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 藝文場館 ───────────────────────────

const ARTS_SOURCE = source("gb-arts-venues", "gb_arts_venues.pmtiles", GB_OSM_ATTRIBUTION, "英國藝文場館載入中");

export function useGbArtsVenuesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => pointPaint("gbArtsVenues", kindColor(GB_ARTS_KINDS), isDark, opacity, scale);
  useGbPmtilesLayers(mapRef, ARTS_SOURCE, visible, () => [{
    id: GB_ARTS_VENUES_CIRCLE_ID,
    layer: () => ({
      id: GB_ARTS_VENUES_CIRCLE_ID, type: "circle", source: ARTS_SOURCE.id, "source-layer": "gb_arts_venues",
      minzoom: GB_CULTURE_MINZOOM.default, layout: { visibility: "none" }, paint: paint(),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_ARTS_VENUES_CIRCLE_ID, paint()),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 觀光體驗 ───────────────────────────

const VISITOR_SOURCE = source("gb-visitor-experience", "gb_visitor_experience.pmtiles", GB_OSM_ATTRIBUTION, "英國觀光體驗載入中");
const IS_ATTRACTION: Expr = ["==", ["get", "kind"], "attraction"];

export function useGbVisitorExperienceLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => pointPaint("gbVisitorExperience", kindColor(GB_VISITOR_KINDS), isDark, opacity, scale);
  useGbPmtilesLayers(mapRef, VISITOR_SOURCE, visible, () => [
    {
      // 景點 5,436 點：縮放 9 級起，畫在其他類別下面
      id: GB_VISITOR_ATTRACTION_CIRCLE_ID,
      layer: () => ({
        id: GB_VISITOR_ATTRACTION_CIRCLE_ID, type: "circle", source: VISITOR_SOURCE.id, "source-layer": "gb_visitor_experience",
        minzoom: GB_CULTURE_MINZOOM.attraction, filter: IS_ATTRACTION, layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_VISITOR_ATTRACTION_CIRCLE_ID, paint()),
    },
    {
      id: GB_VISITOR_OTHER_CIRCLE_ID,
      layer: () => ({
        id: GB_VISITOR_OTHER_CIRCLE_ID, type: "circle", source: VISITOR_SOURCE.id, "source-layer": "gb_visitor_experience",
        minzoom: GB_CULTURE_MINZOOM.default, filter: ["!", IS_ATTRACTION], layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_VISITOR_OTHER_CIRCLE_ID, paint()),
    },
  ], [opacity, scale, isDark]);
}
