import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint } from "../map/lineFillSpec";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { paramDefault } from "../data/layerParamsSpec";
import { JMA_QUAKE_RADIUS_STOPS } from "../data/jmaTypes";
import {
  GB_GAMMA_ATTRIBUTION, GB_GAMMA_CLASSES, GB_GAMMA_MINZOOM, GB_GAMMA_MISSING_STROKE, GB_GAMMA_TILE_ZOOM,
  GB_GEOSURE_ATTRIBUTION, GB_GEOSURE_MINZOOM, GB_GEOSURE_TILE_ZOOM, GB_LANDSLIDE_ATTRIBUTION, GB_LANDSLIDE_COLOR, GB_LANDSLIDE_COUNT,
  GB_LANDSLIDE_HOLLOW_STROKE, GB_LANDSLIDE_MINZOOM, GB_LANDSLIDE_TILE_ZOOM, GB_QUAKE_ATTRIBUTION, GB_QUAKE_COLOR,
  GB_QUAKE_HOLLOW_STROKE, GB_QUAKE_MINOR_BELOW, GB_QUAKE_MINOR_MINZOOM, GB_QUAKE_TILE_ZOOM, GB_RADON_ATTRIBUTION,
  GB_RADON_CLASSES, GB_RADON_MINZOOM, GB_RADON_TILE_ZOOM, GB_SUSCEPTIBILITY, gbGeoHazardFromIdx, gbRadonColors,
} from "../data/gbHazardTypes";
import { gbHeatmapBuild, useGbPmtilesLayers, type SourceSpec } from "./useGbWaterLayers";

/**
 * 英國第 9 波災害地質 5 層：GeoSure 易發性（5 km 六角格面，一次一種災害）、山崩紀錄（點）、
 * 氡氣指示圖（1 km 方格面）、加馬劑量率固定站（點）、地震目錄（點，依規模大小）。靜態資料、不訂閱時間。
 */
export const GB_GEOSURE_FILL_ID = "gb-geosure-fill";
export const GB_LANDSLIDE_CIRCLE_ID = "gb-landslides-circle";
export const GB_RADON_FILL_ID = "gb-radon-fill";
export const GB_GAMMA_CIRCLE_ID = "gb-gamma-dose-circle";
export const GB_QUAKE_MAJOR_CIRCLE_ID = "gb-earthquakes-major-circle";
export const GB_QUAKE_MINOR_CIRCLE_ID = "gb-earthquakes-minor-circle";
export const GB_LANDSLIDE_HEATMAP_ID = "gb-landslides-heatmap";

type MapRef = React.RefObject<MapboxMap | null>;
type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};

// ─────────────────────────── GeoSure ───────────────────────────

const GEOSURE_SOURCE: SourceSpec = {
  id: "gb-geosure", file: "gb_geosure_hex.pmtiles", ...GB_GEOSURE_TILE_ZOOM, attribution: GB_GEOSURE_ATTRIBUTION, loading: "英國地質災害易發性載入中",
};
function geosureColor(): Expr {
  const expr: unknown[] = ["match", ["coalesce", ["get", "susceptibility"], ""]];
  for (const s of GB_SUSCEPTIBILITY) expr.push(s.value, s.color);
  expr.push("rgba(0,0,0,0)");
  return expr;
}
export const gbGeoHazardFilter = (hazardIdx: number): Expr => ["==", ["get", "hazard"], gbGeoHazardFromIdx(hazardIdx)];

export function useGbGroundStabilityLayer(mapRef: MapRef, visible: boolean, opacity: number, hazardIdx: number, isDark: boolean) {
  const def = opacityDefault("gbGroundStability", 0.55);
  const paint = (op: number) => hookFillPaint("gbGroundStability", GB_GEOSURE_FILL_ID,
    { "fill-color": geosureColor(), "fill-opacity": clamp01(op) }, { "fill-color": geosureColor(), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, GEOSURE_SOURCE, visible, () => [{
    id: GB_GEOSURE_FILL_ID,
    layer: () => ({
      id: GB_GEOSURE_FILL_ID, type: "fill", source: GEOSURE_SOURCE.id, "source-layer": "gb_geosure_hex", minzoom: GB_GEOSURE_MINZOOM,
      filter: gbGeoHazardFilter(hazardIdx), layout: { visibility: "none" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(GB_GEOSURE_FILL_ID, gbGeoHazardFilter(hazardIdx) as any);
      map.setPaintProperty(GB_GEOSURE_FILL_ID, "fill-opacity", paint(opacity)["fill-opacity"] as any);
    },
  }], [opacity, hazardIdx, isDark]);
}

// ─────────────────────────── 山崩紀錄 ───────────────────────────

const LANDSLIDE_SOURCE: SourceSpec = {
  id: "gb-landslides", file: "gb_landslides.pmtiles", ...GB_LANDSLIDE_TILE_ZOOM, attribution: GB_LANDSLIDE_ATTRIBUTION, loading: "英國山崩紀錄載入中",
};
const IS_CHECKED: Expr = ["==", ["get", "grid_checked_by_bgs"], "Y"];

/** BGS 已複核（Y）實心＋底圖色描邊；未複核（N／U／缺值）同色空心環。 */
function landslidePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbLandslide", 0.7));
  return {
    "circle-radius": pointRadius("S", scale / scaleDefault("gbLandslide")),
    "circle-color": GB_LANDSLIDE_COLOR,
    "circle-opacity": ["case", IS_CHECKED, op, 0],
    "circle-stroke-color": ["case", IS_CHECKED, seam["circle-stroke-color"], GB_LANDSLIDE_COLOR],
    "circle-stroke-width": ["case", IS_CHECKED, seam["circle-stroke-width"], GB_LANDSLIDE_HOLLOW_STROKE],
    "circle-stroke-opacity": ["case", IS_CHECKED, seam["circle-stroke-opacity"], op],
  };
}

/** R5（P-4／G-2，2026-10-30）：18,699 點 z<10 熱區、z≥10 畫點（原 z7 起）。 */
const LANDSLIDE_POINTS_FROM = densePointsFromZoom(GB_LANDSLIDE_COUNT, GB_LANDSLIDE_MINZOOM);
const LANDSLIDE_HEAT_INTENSITY = 2;

export function useGbLandslideLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const heatStyle = useHeatmapStyleSignature(["gbLandslide"]);
  useGbPmtilesLayers(mapRef, LANDSLIDE_SOURCE, visible, () => [gbHeatmapBuild({
    id: GB_LANDSLIDE_HEATMAP_ID, key: "gbLandslide", sourceId: LANDSLIDE_SOURCE.id, sourceLayer: "gb_landslides",
    maxzoom: heatmapMaxzoom(LANDSLIDE_POINTS_FROM), isDark,
    opacityScale: clamp01(opacity) / opacityDefault("gbLandslide", 0.75), intensity: LANDSLIDE_HEAT_INTENSITY,
  }), {
    id: GB_LANDSLIDE_CIRCLE_ID,
    layer: () => ({
      id: GB_LANDSLIDE_CIRCLE_ID, type: "circle", source: LANDSLIDE_SOURCE.id, "source-layer": "gb_landslides", minzoom: LANDSLIDE_POINTS_FROM,
      layout: { visibility: "none" }, paint: landslidePaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_LANDSLIDE_CIRCLE_ID, landslidePaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark, heatStyle]);
}

// ─────────────────────────── 氡氣指示圖 ───────────────────────────

const RADON_SOURCE: SourceSpec = {
  id: "gb-radon", file: "gb_radon_atlas.pmtiles", ...GB_RADON_TILE_ZOOM, attribution: GB_RADON_ATTRIBUTION, loading: "英國氡氣指示圖載入中",
};
function radonColor(isDark: boolean): Expr {
  const colors = gbRadonColors(isDark);
  const expr: unknown[] = ["match", ["to-number", ["get", "radon_class"], 0]];
  GB_RADON_CLASSES.forEach((c, i) => expr.push(c.value, colors[i]));
  expr.push("rgba(0,0,0,0)");
  return expr;
}

export function useGbRadonLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const def = opacityDefault("gbRadon", 0.7);
  const paint = (op: number) => hookFillPaint("gbRadon", GB_RADON_FILL_ID,
    { "fill-color": radonColor(isDark), "fill-opacity": clamp01(op) }, { "fill-color": radonColor(isDark), "fill-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, RADON_SOURCE, visible, () => [{
    id: GB_RADON_FILL_ID,
    layer: () => ({
      id: GB_RADON_FILL_ID, type: "fill", source: RADON_SOURCE.id, "source-layer": "gb_radon_atlas", minzoom: GB_RADON_MINZOOM,
      layout: { visibility: "none" }, paint: paint(opacity),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_RADON_FILL_ID, paint(opacity)),
  }], [opacity, isDark]);
}

// ─────────────────────────── 加馬劑量率 ───────────────────────────

const GAMMA_SOURCE: SourceSpec = {
  id: "gb-gamma-dose", file: "gb_gamma_dose.pmtiles", ...GB_GAMMA_TILE_ZOOM, attribution: GB_GAMMA_ATTRIBUTION, loading: "英國加馬劑量率載入中",
};
const HAS_DOSE: Expr = ["has", "dose_mean"];
function gammaColor(): Expr {
  const expr: unknown[] = ["step", ["to-number", ["get", "dose_mean"], 0], GB_GAMMA_CLASSES[0]!.color];
  for (let i = 1; i < GB_GAMMA_CLASSES.length; i++) expr.push(GB_GAMMA_CLASSES[i - 1]!.upper, GB_GAMMA_CLASSES[i]!.color);
  return expr;
}
/** 月平均缺值 → 灰框空心（不畫成最低級）。 */
function gammaPaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbRadiation", 0.9));
  return {
    "circle-radius": pointRadius("M", scale / scaleDefault("gbRadiation")),
    "circle-color": gammaColor(),
    "circle-opacity": ["case", HAS_DOSE, op, 0],
    "circle-stroke-color": ["case", HAS_DOSE, seam["circle-stroke-color"], GB_GAMMA_MISSING_STROKE],
    "circle-stroke-width": ["case", HAS_DOSE, seam["circle-stroke-width"], 1.5],
    "circle-stroke-opacity": ["case", HAS_DOSE, seam["circle-stroke-opacity"], op],
  };
}

export function useGbRadiationLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, GAMMA_SOURCE, visible, () => [{
    id: GB_GAMMA_CIRCLE_ID,
    layer: () => ({
      id: GB_GAMMA_CIRCLE_ID, type: "circle", source: GAMMA_SOURCE.id, "source-layer": "gb_gamma_dose", minzoom: GB_GAMMA_MINZOOM,
      layout: { visibility: "none" }, paint: gammaPaint(isDark, opacity, scale),
    } as unknown as AnyLayer),
    update: (map) => setPaint(map, GB_GAMMA_CIRCLE_ID, gammaPaint(isDark, opacity, scale)),
  }], [opacity, scale, isDark]);
}

// ─────────────────────────── 地震目錄 ───────────────────────────

const QUAKE_SOURCE: SourceSpec = {
  id: "gb-earthquakes", file: "gb_earthquakes.pmtiles", ...GB_QUAKE_TILE_ZOOM, attribution: GB_QUAKE_ATTRIBUTION, loading: "英國地震目錄載入中",
};
const IS_HISTORICAL: Expr = ["==", ["get", "catalogue"], "historical"];
/** 規模缺值以 99 代入「不屬小地震」，和歷史地震一起 z4 起顯示（不是規模 99，半徑另走最小值）。 */
const MAG_OR_HIGH: Expr = ["to-number", ["coalesce", ["get", "magnitude"], 99], 99];
const QUAKE_MINOR_FILTER: Expr = ["all", ["!", IS_HISTORICAL], ["<", MAG_OR_HIGH, GB_QUAKE_MINOR_BELOW]];
const QUAKE_MAJOR_FILTER: Expr = ["any", IS_HISTORICAL, [">=", MAG_OR_HIGH, GB_QUAKE_MINOR_BELOW]];

/** 規模半徑（JMA_QUAKE_RADIUS_STOPS × 大小滑桿）；規模未知用最小半徑。 */
export function gbQuakeRadiusPx(magnitude: number | null, sizeScale = 1): number {
  const stops = JMA_QUAKE_RADIUS_STOPS;
  if (magnitude == null) return stops[0]![1] * sizeScale;
  if (magnitude <= stops[0]![0]) return stops[0]![1] * sizeScale;
  for (let i = 1; i < stops.length; i++) {
    const [m1, p1] = stops[i]!;
    const [m0, p0] = stops[i - 1]!;
    if (magnitude <= m1) return (p0 + ((magnitude - m0) / (m1 - m0)) * (p1 - p0)) * sizeScale;
  }
  return stops[stops.length - 1]![1] * sizeScale;
}
function quakePaint(isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const s = scale / scaleDefault("gbEarthquakes");
  const seam = pointStrokePaint(isDark, op / opacityDefault("gbEarthquakes", 0.8));
  return {
    "circle-radius": ["case", ["!", ["has", "magnitude"]], JMA_QUAKE_RADIUS_STOPS[0]![1] * s,
      ["interpolate", ["linear"], ["get", "magnitude"], ...JMA_QUAKE_RADIUS_STOPS.flatMap(([m, px]) => [m, px * s])]],
    "circle-color": GB_QUAKE_COLOR,
    "circle-opacity": ["case", IS_HISTORICAL, 0, op],
    "circle-stroke-color": ["case", IS_HISTORICAL, GB_QUAKE_COLOR, seam["circle-stroke-color"]],
    "circle-stroke-width": ["case", IS_HISTORICAL, GB_QUAKE_HOLLOW_STROKE, seam["circle-stroke-width"]],
    "circle-stroke-opacity": ["case", IS_HISTORICAL, op, seam["circle-stroke-opacity"]],
  };
}
const quakeLayer = (id: string, minzoom: number, filter: Expr, paint: Record<string, unknown>) => ({
  id, type: "circle", source: QUAKE_SOURCE.id, "source-layer": "gb_earthquakes", minzoom, filter,
  // 大地震畫在上面
  layout: { visibility: "none", "circle-sort-key": ["to-number", ["coalesce", ["get", "magnitude"], 0], 0] }, paint,
} as unknown as AnyLayer);

export function useGbEarthquakesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  useGbPmtilesLayers(mapRef, QUAKE_SOURCE, visible, () => [
    {
      id: GB_QUAKE_MINOR_CIRCLE_ID,
      layer: () => quakeLayer(GB_QUAKE_MINOR_CIRCLE_ID, GB_QUAKE_MINOR_MINZOOM, QUAKE_MINOR_FILTER, quakePaint(isDark, opacity, scale)),
      update: (map) => setPaint(map, GB_QUAKE_MINOR_CIRCLE_ID, quakePaint(isDark, opacity, scale)),
    },
    {
      id: GB_QUAKE_MAJOR_CIRCLE_ID,
      layer: () => quakeLayer(GB_QUAKE_MAJOR_CIRCLE_ID, GB_QUAKE_TILE_ZOOM.minzoom, QUAKE_MAJOR_FILTER, quakePaint(isDark, opacity, scale)),
      update: (map) => setPaint(map, GB_QUAKE_MAJOR_CIRCLE_ID, quakePaint(isDark, opacity, scale)),
    },
  ], [opacity, scale, isDark]);
}
