import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint } from "../map/lineFillSpec";
import { densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { gridRampFor, useGridPaletteSignature, useHeatmapStyleSignature } from "../state/layerPalette";
import { JMA_QUAKE_RADIUS_STOPS } from "../data/jmaTypes";
import {
  CA_AQHI_COLOR, CA_AQHI_SOURCE, CA_CLIMATE_SOURCE, CA_CLIMATE_STATUSES, CA_NPRI_COUNT, CA_NPRI_GROUPS, CA_NPRI_RECENT, CA_NPRI_SOURCE,
  CA_POP_GRID_BREAKS, CA_POP_GRID_LEVELS, CA_POP_GRID_SOURCE, CA_QUAKE_CLASSES, CA_QUAKE_COLOR, CA_QUAKE_COUNT, CA_QUAKE_SOURCE,
  CA_RADIATION_COLOR, CA_RADIATION_SOURCE, CA_WSER_BANDS, CA_WSER_SOURCE, CA_WSER_STATUSES,
} from "../data/caEnvTypes";
import { caCatColor, caCatFilter } from "./useCaTransportLayers";
import { gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

/**
 * 加拿大第 3 波（C095 氣象站、C096 AQHI、C076 輻射監測站、C099 NPRI、C098 WSER、C070 歷史地震）＋ GHSL 人口網格。
 * 靜態 PMTiles、不訂閱時間。規格在 `data/caEnvTypes.ts`。
 * V-1（加拿大全覽 z3.5）：<1 萬點的層 z2–3 起直接畫點；NPRI（2.5 萬）拉遠畫熱區、z10 起點；地震（10 萬）拉遠熱區、
 * 規模 ≥4 另一個 tile layer 各縮放直接畫點；人口網格 z2 起 H3 第 5 級。V-4：狀態、產業群、規模多選。
 */
export const CA_CLIMATE_CIRCLE_ID = "ca-climate-stations-circle";
export const CA_AQHI_CIRCLE_ID = "ca-aqhi-stations-circle";
export const CA_RADIATION_CIRCLE_ID = "ca-radiation-stations-circle";
export const CA_NPRI_HEATMAP_ID = "ca-npri-facilities-heatmap";
export const CA_NPRI_CIRCLE_ID = "ca-npri-facilities-circle";
export const CA_WSER_CIRCLE_ID = "ca-wastewater-systems-circle";
export const CA_QUAKE_HEATMAP_ID = "ca-earthquakes-heatmap";
export const CA_QUAKE_CIRCLE_ID = "ca-earthquakes-circle";
export const CA_QUAKE_MAJOR_CIRCLE_ID = "ca-earthquakes-major-circle";
/** 字面 id（點擊註冊表契約測試以字面比對，不可用樣板字串組）。 */
const CA_POP_GRID_FILL_ID_BY_RES: Readonly<Record<number, string>> = {
  5: "ca-population-grid-r5-fill", 6: "ca-population-grid-r6-fill", 7: "ca-population-grid-r7-fill",
};
export const caPopGridFillId = (res: number) => CA_POP_GRID_FILL_ID_BY_RES[res]!;
export const CA_POP_GRID_FILL_IDS = CA_POP_GRID_LEVELS.map((l) => caPopGridFillId(l.res));

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
const sig = (v: unknown) => JSON.stringify(v);
const allOf = (...fs: (Expr | null)[]): Expr | null => {
  const xs = fs.filter((f): f is Expr => f != null);
  return xs.length === 0 ? null : xs.length === 1 ? xs[0]! : ["all", ...xs];
};

function circleBuild(o: { id: string; source: SourceSpec; sourceLayer: string; minzoom: number; filter: Expr | null; paint: () => Record<string, unknown>; sortKey?: unknown }): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type: "circle", source: o.source.id, "source-layer": o.sourceLayer, minzoom: o.minzoom,
      ...(o.filter ? { filter: o.filter } : {}),
      layout: { visibility: "none", ...(o.sortKey ? { "circle-sort-key": o.sortKey } : {}) }, paint: o.paint(),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(o.id, (o.filter ?? null) as any); setPaint(map, o.id, o.paint()); },
  };
}
const pointPaint = (color: unknown, radius: unknown, isDark: boolean, opacity: number, def: number) => () => ({
  "circle-radius": radius, "circle-color": color, "circle-opacity": clamp01(opacity), ...pointStrokePaint(isDark, clamp01(opacity) / def),
});

// ─────────────────────────── 氣象站（8,435 點，<1 萬：z3 起畫點；現役／歷史多選） ───────────────────────────

const CLIMATE_SOURCE: SourceSpec = { id: "ca-climate-stations", file: "ca_climate_stations.pmtiles", minzoom: 3, maxzoom: 10, attribution: CA_CLIMATE_SOURCE.short, loading: "加拿大氣象站載入中" };
export const caClimateStatusFilter = (mask: number | undefined) => caCatFilter("status", CA_CLIMATE_STATUSES, mask);

export function useCaClimateStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("caClimateStations", 0.8);
  const filter = caClimateStatusFilter(catMask);
  useGbPmtilesLayers(mapRef, CLIMATE_SOURCE, visible, () => [circleBuild({
    id: CA_CLIMATE_CIRCLE_ID, source: CLIMATE_SOURCE, sourceLayer: "ca_climate_stations", minzoom: 3, filter,
    // 現役站畫在歷史站上面
    sortKey: ["match", ["get", "status"], "active", 1, 0],
    paint: pointPaint(caCatColor("status", CA_CLIMATE_STATUSES), pointRadius("S", scale / scaleDefault("caClimateStations")), isDark, opacity, def),
  })], [opacity, scale, isDark, sig(filter)]);
}

// ─────────────────────────── AQHI 地點（134 點） ───────────────────────────

const AQHI_SOURCE: SourceSpec = { id: "ca-aqhi-stations", file: "ca_aqhi_stations.pmtiles", minzoom: 2, maxzoom: 10, attribution: CA_AQHI_SOURCE.short, loading: "加拿大 AQHI 地點載入中" };

export function useCaAqhiStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const def = opacityDefault("caAqhiStations", 0.9);
  useGbPmtilesLayers(mapRef, AQHI_SOURCE, visible, () => [circleBuild({
    id: CA_AQHI_CIRCLE_ID, source: AQHI_SOURCE, sourceLayer: "ca_aqhi_stations", minzoom: 2, filter: null,
    paint: pointPaint(CA_AQHI_COLOR, pointRadius("M", scale / scaleDefault("caAqhiStations")), isDark, opacity, def),
  })], [opacity, scale, isDark]);
}

// ─────────────────────────── 輻射監測站（46 點） ───────────────────────────

const RADIATION_SOURCE: SourceSpec = { id: "ca-radiation-stations", file: "ca_radiation_stations.pmtiles", minzoom: 2, maxzoom: 10, attribution: CA_RADIATION_SOURCE.short, loading: "加拿大輻射監測站載入中" };

export function useCaRadiationStationsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const def = opacityDefault("caRadiationStations", 0.9);
  useGbPmtilesLayers(mapRef, RADIATION_SOURCE, visible, () => [circleBuild({
    id: CA_RADIATION_CIRCLE_ID, source: RADIATION_SOURCE, sourceLayer: "ca_radiation_stations", minzoom: 2, filter: null,
    paint: pointPaint(CA_RADIATION_COLOR, pointRadius("M", scale / scaleDefault("caRadiationStations")), isDark, opacity, def),
  })], [opacity, scale, isDark]);
}

// ─────────────────────────── NPRI 申報設施（24,540 點：拉遠熱區、z10 起點；產業群、仍申報多選） ───────────────────────────

const NPRI_SOURCE: SourceSpec = { id: "ca-npri-facilities", file: "ca_npri_facilities.pmtiles", minzoom: 3, maxzoom: 10, attribution: CA_NPRI_SOURCE.short, loading: "加拿大 NPRI 申報設施載入中" };
export const CA_NPRI_POINTS_FROM_ZOOM = densePointsFromZoom(CA_NPRI_COUNT);
export const caNpriGroupFilter = (mask: number | undefined) => caCatFilter("sector_group", CA_NPRI_GROUPS, mask);
export const caNpriRecentFilter = (mask: number | undefined) => caCatFilter("recent", CA_NPRI_RECENT, mask);

export function useCaNpriFacilitiesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number, recentMask?: number) {
  const def = opacityDefault("caNpriFacilities", 0.7);
  const heatStyle = useHeatmapStyleSignature(["caNpriFacilities"]);
  const filter = allOf(caNpriGroupFilter(catMask), caNpriRecentFilter(recentMask));
  const op = clamp01(opacity);
  useGbPmtilesLayers(mapRef, NPRI_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: CA_NPRI_HEATMAP_ID, key: "caNpriFacilities", sourceId: NPRI_SOURCE.id, sourceLayer: "ca_npri_facilities",
      maxzoom: heatmapMaxzoom(CA_NPRI_POINTS_FROM_ZOOM), filter, isDark, opacityScale: op / def, intensity: 1.5,
    }),
    circleBuild({
      id: CA_NPRI_CIRCLE_ID, source: NPRI_SOURCE, sourceLayer: "ca_npri_facilities", minzoom: CA_NPRI_POINTS_FROM_ZOOM, filter,
      paint: pointPaint(caCatColor("sector_group", CA_NPRI_GROUPS), pointRadius("S", scale / scaleDefault("caNpriFacilities")), isDark, opacity, def),
    }),
  ], [opacity, scale, isDark, heatStyle, sig(filter)]);
}

// ─────────────────────────── 污水處理系統（2,537 點；狀態多選、放流量 3 級大小） ───────────────────────────

const WSER_SOURCE: SourceSpec = { id: "ca-wastewater-systems", file: "ca_wastewater_systems.pmtiles", minzoom: 2, maxzoom: 10, attribution: CA_WSER_SOURCE.short, loading: "加拿大污水處理系統載入中" };
export const caWserStatusFilter = (mask: number | undefined) => caCatFilter("status", CA_WSER_STATUSES, mask);

export function useCaWastewaterSystemsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("caWastewaterSystems", 0.85);
  const filter = caWserStatusFilter(catMask);
  const s = scale / scaleDefault("caWastewaterSystems");
  const radius: Expr = ["*", ["step", ["coalesce", ["get", "effluent_m3_day"], 0], CA_WSER_BANDS[0]!.radius, ...CA_WSER_BANDS.slice(1).flatMap((b) => [b.min, b.radius])], s];
  useGbPmtilesLayers(mapRef, WSER_SOURCE, visible, () => [circleBuild({
    id: CA_WSER_CIRCLE_ID, source: WSER_SOURCE, sourceLayer: "ca_wastewater_systems", minzoom: 2, filter,
    sortKey: ["coalesce", ["get", "effluent_m3_day"], 0],
    paint: pointPaint(caCatColor("status", CA_WSER_STATUSES), radius, isDark, opacity, def),
  })], [opacity, scale, isDark, sig(filter)]);
}

// ─────────────────────────── 歷史地震（101,365 點：拉遠熱區、z12 起點；M≥4 各縮放畫點；規模多選） ───────────────────────────

const QUAKE_SOURCE: SourceSpec = { id: "ca-earthquakes", file: "ca_earthquakes.pmtiles", minzoom: 3, maxzoom: 10, attribution: CA_QUAKE_SOURCE.short, loading: "加拿大歷史地震載入中" };
export const CA_QUAKE_POINTS_FROM_ZOOM = densePointsFromZoom(CA_QUAKE_COUNT);
export const caQuakeClassFilter = (mask: number | undefined) => caCatFilter("mag_class", CA_QUAKE_CLASSES, mask);
/** 規模半徑（同日本、英國地震：JMA_QUAKE_RADIUS_STOPS × 大小滑桿）。 */
export const caQuakeRadius = (s: number): Expr =>
  ["interpolate", ["linear"], ["to-number", ["coalesce", ["get", "magnitude"], 0], 0], ...JMA_QUAKE_RADIUS_STOPS.flatMap(([m, px]) => [m, px * s])];

export function useCaEarthquakesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("caEarthquakes", 0.7);
  const heatStyle = useHeatmapStyleSignature(["caEarthquakes"]);
  const filter = caQuakeClassFilter(catMask);
  const op = clamp01(opacity);
  const s = scale / scaleDefault("caEarthquakes");
  const sortKey = ["to-number", ["coalesce", ["get", "magnitude"], 0], 0];
  useGbPmtilesLayers(mapRef, QUAKE_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: CA_QUAKE_HEATMAP_ID, key: "caEarthquakes", sourceId: QUAKE_SOURCE.id, sourceLayer: "ca_earthquakes",
      maxzoom: heatmapMaxzoom(CA_QUAKE_POINTS_FROM_ZOOM), filter, isDark, opacityScale: op / def, intensity: 1,
    }),
    circleBuild({
      id: CA_QUAKE_CIRCLE_ID, source: QUAKE_SOURCE, sourceLayer: "ca_earthquakes", minzoom: CA_QUAKE_POINTS_FROM_ZOOM, filter, sortKey,
      paint: pointPaint(CA_QUAKE_COLOR, caQuakeRadius(s), isDark, opacity, def),
    }),
    // M≥4：獨立 tile layer（各縮放不丟點），拉遠也畫點；z12 起交給全量點層（避免重疊）
    {
      ...circleBuild({
        id: CA_QUAKE_MAJOR_CIRCLE_ID, source: QUAKE_SOURCE, sourceLayer: "ca_earthquakes_major", minzoom: 3, filter, sortKey,
        paint: pointPaint(CA_QUAKE_COLOR, caQuakeRadius(s), isDark, opacity, def),
      }),
      layer: () => ({
        id: CA_QUAKE_MAJOR_CIRCLE_ID, type: "circle", source: QUAKE_SOURCE.id, "source-layer": "ca_earthquakes_major", minzoom: 3,
        maxzoom: CA_QUAKE_POINTS_FROM_ZOOM, ...(filter ? { filter } : {}),
        layout: { visibility: "none", "circle-sort-key": sortKey }, paint: pointPaint(CA_QUAKE_COLOR, caQuakeRadius(s), isDark, opacity, def)(),
      } as unknown as AnyLayer),
    },
  ], [opacity, scale, isDark, heatStyle, sig(filter)]);
}

// ─────────────────────────── 人口網格（GHSL 2020 → H3 r5／r6／r7，密度 7 級） ───────────────────────────

const POP_GRID_SOURCE: SourceSpec = { id: "ca-population-grid", file: "ca_population_grid.pmtiles", minzoom: 2, maxzoom: 10, attribution: CA_POP_GRID_SOURCE.short, loading: "加拿大人口網格載入中" };
/** 密度 step 表達式（色盤由網格選色解析器給，7 階重新取樣）。 */
export function caPopGridColorExpr(colors: readonly string[]): Expr {
  const expr: unknown[] = ["step", ["to-number", ["coalesce", ["get", "density"], 0], 0], colors[0]];
  CA_POP_GRID_BREAKS.slice(1).forEach((b, i) => expr.push(b.min, colors[i + 1]));
  return expr;
}
export const caPopGridColors = (isDark: boolean) => gridRampFor("caPopulationGrid", isDark, CA_POP_GRID_BREAKS.length);

export function useCaPopulationGridLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const key = "caPopulationGrid";
  const def = opacityDefault(key, 0.6);
  const palette = useGridPaletteSignature(key);
  const color = caPopGridColorExpr(caPopGridColors(isDark));
  const op = clamp01(opacity);
  useGbPmtilesLayers(mapRef, POP_GRID_SOURCE, visible, () => CA_POP_GRID_LEVELS.map((lv): LayerBuild => {
    const id = caPopGridFillId(lv.res);
    const paint = () => hookFillPaint(key, id, { "fill-color": color, "fill-opacity": op }, { "fill-color": color, "fill-opacity": def }, isDark);
    return {
      id,
      layer: () => ({
        id, type: "fill", source: POP_GRID_SOURCE.id, "source-layer": `ca_population_grid_r${lv.res}`, minzoom: lv.minzoom,
        ...(lv.maxzoom != null ? { maxzoom: lv.maxzoom } : {}), layout: { visibility: "none" }, paint: paint(),
      } as unknown as AnyLayer),
      update: (map) => setPaint(map, id, paint()),
    };
  }), [opacity, isDark, palette]);
}
