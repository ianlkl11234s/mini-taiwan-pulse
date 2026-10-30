import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import {
  GB_CARE_CQC_ATTRIBUTION, GB_CARE_KINDS, GB_CIVIC_FALLBACK_COLOR, GB_COURT_KINDS, GB_COURTS_ATTRIBUTION, GB_FIRE_COLOR,
  GB_FIRE_MHCLG_ATTRIBUTION, GB_FIRE_OSM_FILL_FACTOR, GB_FIRE_OSM_STROKE_WIDTH, GB_HEALTH_KINDS, GB_HEALTH_MINZOOM,
  GB_HEALTH_ODS_ATTRIBUTION, GB_SCHOOL_CATEGORIES, GB_SCHOOLS_ATTRIBUTION, GB_SCHOOLS_COUNT, GB_CARE_HOMES_COUNT,
  GB_CARE_SERVICES_COUNT, gbHealthColor,
} from "../data/gbCivicTypes";
import { gbHeatmapBuild, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 7 波公共服務 6 層：學校、醫療（醫院 z5 起、GP／藥局 z10 起，同 source 兩個 circle）、
 * 住宿照顧＋長照服務（同一個 PMTiles，兩個 key 依 care_home 篩，各自呼叫 useGbPmtilesLayers 共用 source）、
 * 消防站（官方實心、OSM 補缺空心）、法院。靜態資料、不訂閱時間。
 *
 * R5（P-4／G-2，2026-10-30）：學校、GP＋藥局、照護兩層都 ≥1 萬點 → z<10 熱區、z≥10 畫點（原 z9 起）；
 * 醫院、消防站、法院 <1 萬點直接 z5 起畫。熱區強度在全英 z5.5–6 目視校正。
 */
export const GB_SCHOOLS_CIRCLE_ID = "gb-schools-circle";
export const GB_HEALTH_HOSPITAL_CIRCLE_ID = "gb-health-hospital-circle";
export const GB_HEALTH_PRIMARY_CIRCLE_ID = "gb-health-primary-circle";
export const GB_CARE_HOMES_CIRCLE_ID = "gb-care-homes-circle";
export const GB_CARE_SERVICES_CIRCLE_ID = "gb-care-services-circle";
export const GB_FIRE_STATIONS_CIRCLE_ID = "gb-fire-stations-circle";
export const GB_COURTS_CIRCLE_ID = "gb-courts-circle";
export const GB_SCHOOLS_HEATMAP_ID = "gb-schools-heatmap";
export const GB_HEALTH_PRIMARY_HEATMAP_ID = "gb-health-primary-heatmap";
export const GB_CARE_HOMES_HEATMAP_ID = "gb-care-homes-heatmap";
export const GB_CARE_SERVICES_HEATMAP_ID = "gb-care-services-heatmap";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
function matchColor(field: string, pairs: readonly (readonly [unknown, string])[], fallback: string): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", field], ""]];
  for (const [v, c] of pairs) expr.push(v, c);
  expr.push(fallback);
  return expr;
}
/** 一般點：類別色＋底圖色細縫（P-2 A）。 */
function pointPaint(key: string, fallbackOpacity: number, color: unknown, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault(key)),
    "circle-color": color,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / opacityDefault(key, fallbackOpacity)),
  };
}

// ─────────────────────────── 學校 ───────────────────────────

const SCHOOLS_SOURCE: SourceSpec = {
  id: "gb-schools", file: "gb_schools.pmtiles", minzoom: 5, maxzoom: 12, attribution: GB_SCHOOLS_ATTRIBUTION, loading: "英國學校載入中",
};
const schoolColor = (): Expr => matchColor("category", GB_SCHOOL_CATEGORIES.map((c) => [c.value, c.color] as const), GB_CIVIC_FALLBACK_COLOR);

const SCHOOLS_POINTS_FROM = densePointsFromZoom(GB_SCHOOLS_COUNT, 9);
const SCHOOLS_HEAT_INTENSITY = 2;

export function useGbSchoolsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => pointPaint("gbSchools", 0.8, schoolColor(), isDark, opacity, scale);
  const heatStyle = useHeatmapStyleSignature(["gbSchools"]);
  useGbPmtilesLayers(mapRef, SCHOOLS_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: GB_SCHOOLS_HEATMAP_ID, key: "gbSchools", sourceId: SCHOOLS_SOURCE.id, sourceLayer: "gb_schools",
      maxzoom: heatmapMaxzoom(SCHOOLS_POINTS_FROM), isDark, opacityScale: clamp01(opacity) / opacityDefault("gbSchools", 0.75), intensity: SCHOOLS_HEAT_INTENSITY,
    }),
    {
      id: GB_SCHOOLS_CIRCLE_ID,
      layer: () => ({
        id: GB_SCHOOLS_CIRCLE_ID, type: "circle", source: SCHOOLS_SOURCE.id, "source-layer": "gb_schools", minzoom: SCHOOLS_POINTS_FROM,
        layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_SCHOOLS_CIRCLE_ID, paint()),
    },
  ], [opacity, scale, isDark, heatStyle]);
}

// ─────────────────────────── 醫療 ───────────────────────────

const HEALTH_SOURCE: SourceSpec = {
  id: "gb-health-facilities", file: "gb_health_facilities.pmtiles", minzoom: 5, maxzoom: 12, attribution: GB_HEALTH_ODS_ATTRIBUTION, loading: "英國醫療院所載入中",
};
const healthColor = (isDark: boolean): Expr =>
  matchColor("kind", GB_HEALTH_KINDS.map((k) => [k.value, gbHealthColor(k.value, isDark)] as const), GB_CIVIC_FALLBACK_COLOR);
const IS_HOSPITAL: Expr = ["==", ["get", "kind"], "hospital"];

/** GP 診所＋藥局點數（醫院 <1 萬點維持畫點、不進熱區）。 */
const HEALTH_PRIMARY_COUNT = GB_HEALTH_KINDS.filter((k) => k.value !== "hospital").reduce((n, k) => n + k.count, 0);
const HEALTH_PRIMARY_POINTS_FROM = densePointsFromZoom(HEALTH_PRIMARY_COUNT, GB_HEALTH_MINZOOM.other);
const HEALTH_HEAT_INTENSITY = 2;
const IS_PRIMARY: Expr = ["!", IS_HOSPITAL];

export function useGbHealthFacilitiesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => pointPaint("gbHealthFacilities", 0.8, healthColor(isDark), isDark, opacity, scale);
  const heatStyle = useHeatmapStyleSignature(["gbHealthFacilities"]);
  useGbPmtilesLayers(mapRef, HEALTH_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: GB_HEALTH_PRIMARY_HEATMAP_ID, key: "gbHealthFacilities", sourceId: HEALTH_SOURCE.id, sourceLayer: "gb_health_facilities",
      maxzoom: heatmapMaxzoom(HEALTH_PRIMARY_POINTS_FROM), filter: IS_PRIMARY,
      isDark, opacityScale: clamp01(opacity) / opacityDefault("gbHealthFacilities", 0.75), intensity: HEALTH_HEAT_INTENSITY,
    }),
    {
      // GP 診所＋藥局（2 萬點）z<10 熱區、z≥10 畫點，畫在醫院下面
      id: GB_HEALTH_PRIMARY_CIRCLE_ID,
      layer: () => ({
        id: GB_HEALTH_PRIMARY_CIRCLE_ID, type: "circle", source: HEALTH_SOURCE.id, "source-layer": "gb_health_facilities", minzoom: HEALTH_PRIMARY_POINTS_FROM,
        filter: IS_PRIMARY, layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_HEALTH_PRIMARY_CIRCLE_ID, paint()),
    },
    {
      id: GB_HEALTH_HOSPITAL_CIRCLE_ID,
      layer: () => ({
        id: GB_HEALTH_HOSPITAL_CIRCLE_ID, type: "circle", source: HEALTH_SOURCE.id, "source-layer": "gb_health_facilities", minzoom: GB_HEALTH_MINZOOM.hospital,
        filter: IS_HOSPITAL, layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, GB_HEALTH_HOSPITAL_CIRCLE_ID, paint()),
    },
  ], [opacity, scale, isDark, heatStyle]);
}

// ─────────────────────────── 照護（同檔兩層） ───────────────────────────

const CARE_SOURCE: SourceSpec = {
  id: "gb-care-services", file: "gb_care_services.pmtiles", minzoom: 5, maxzoom: 12, attribution: GB_CARE_CQC_ATTRIBUTION, loading: "英國照護服務載入中",
};
const careColor = (): Expr => matchColor("care_kind", GB_CARE_KINDS.map((k) => [k.value, k.color] as const), GB_CIVIC_FALLBACK_COLOR);

const CARE_HOMES_POINTS_FROM = densePointsFromZoom(GB_CARE_HOMES_COUNT, 9);
const CARE_SERVICES_POINTS_FROM = densePointsFromZoom(GB_CARE_SERVICES_COUNT, 9);
const CARE_HEAT_INTENSITY = 2;

function useGbCareLayer(mapRef: MapRef, key: "gbCareHomes" | "gbCareServices", id: string, heatId: string, home: boolean, pointsFrom: number,
  visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => pointPaint(key, 0.8, careColor(), isDark, opacity, scale);
  const heatStyle = useHeatmapStyleSignature([key]);
  const filter: Expr = ["==", ["get", "care_home"], home];
  useGbPmtilesLayers(mapRef, CARE_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: heatId, key, sourceId: CARE_SOURCE.id, sourceLayer: "gb_care_services", maxzoom: heatmapMaxzoom(pointsFrom), filter,
      isDark, opacityScale: clamp01(opacity) / opacityDefault(key, 0.75), intensity: CARE_HEAT_INTENSITY,
    }),
    {
      id,
      layer: () => ({
        id, type: "circle", source: CARE_SOURCE.id, "source-layer": "gb_care_services", minzoom: pointsFrom,
        filter, layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, id, paint()),
    },
  ], [opacity, scale, isDark, heatStyle]);
}
export function useGbCareHomesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbCareLayer(mapRef, "gbCareHomes", GB_CARE_HOMES_CIRCLE_ID, GB_CARE_HOMES_HEATMAP_ID, true, CARE_HOMES_POINTS_FROM, visible, opacity, scale, isDark);
}
export function useGbCareServicesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbCareLayer(mapRef, "gbCareServices", GB_CARE_SERVICES_CIRCLE_ID, GB_CARE_SERVICES_HEATMAP_ID, false, CARE_SERVICES_POINTS_FROM, visible, opacity, scale, isDark);
}

// ─────────────────────────── 消防站 ───────────────────────────

const FIRE_SOURCE: SourceSpec = {
  id: "gb-fire-stations", file: "gb_fire_stations.pmtiles", minzoom: 4, maxzoom: 12, attribution: GB_FIRE_MHCLG_ATTRIBUTION, loading: "英國消防站載入中",
};
const IS_OSM: Expr = ["==", ["get", "source"], "osm"];
/** 官方實心＋底圖色細縫；OSM 補缺同色空心（填色淡化、描邊同色，資料編碼描邊）。 */
function firePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbFireStations", 0.85));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbFireStations")),
    "circle-color": GB_FIRE_COLOR,
    "circle-opacity": ["case", IS_OSM, op * GB_FIRE_OSM_FILL_FACTOR, op],
    "circle-stroke-color": ["case", IS_OSM, GB_FIRE_COLOR, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_OSM, GB_FIRE_OSM_STROKE_WIDTH, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_OSM, op, seam["circle-stroke-opacity"]],
  };
}

export function useGbFireStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, FIRE_SOURCE, visible, () => [{
    id: GB_FIRE_STATIONS_CIRCLE_ID,
    layer: () => ({
      id: GB_FIRE_STATIONS_CIRCLE_ID, type: "circle", source: FIRE_SOURCE.id, "source-layer": "gb_fire_stations", minzoom: 5,
      layout: { visibility: "none" }, paint: firePaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_FIRE_STATIONS_CIRCLE_ID, firePaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 法院 ───────────────────────────

const COURTS_SOURCE: SourceSpec = {
  id: "gb-courts", file: "gb_courts.pmtiles", minzoom: 4, maxzoom: 12, attribution: GB_COURTS_ATTRIBUTION, loading: "英國法院載入中",
};
const courtColor = (): Expr => matchColor("court_kind", GB_COURT_KINDS.map((k) => [k.value, k.color] as const), GB_CIVIC_FALLBACK_COLOR);

export function useGbCourtsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const paint = () => pointPaint("gbCourts", 0.85, courtColor(), isDark, opacity, scale);
  useGbPmtilesLayers(mapRef, COURTS_SOURCE, visible, () => [{
    id: GB_COURTS_CIRCLE_ID,
    layer: () => ({
      id: GB_COURTS_CIRCLE_ID, type: "circle", source: COURTS_SOURCE.id, "source-layer": "gb_courts", minzoom: 5,
      layout: { visibility: "none" }, paint: paint(),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_COURTS_CIRCLE_ID, paint()),
  }], [opacity, scale, isDark]);
}
