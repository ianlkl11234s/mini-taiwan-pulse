import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { LINE_DASH, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paramDefault } from "../data/layerParamsSpec";
import { selectedMultiSelectValues } from "../data/multiSelectMapbox";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import {
  CA_CAPACITY_BANDS, CA_GRID_PARTS, CA_GRID_SOURCE, CA_MAJOR_FACILITY_TYPES, CA_ODI_PIPE_POINTS_FROM_ZOOM, CA_ODI_PIPELINES_FROM_ZOOM, CA_OIL_GAS_FACILITIES_COUNT,
  CA_OIL_GAS_FACILITY_COLOR, CA_OIL_GAS_PARTS, CA_OIL_GAS_PIPE_POINT_COLOR, CA_OIL_GAS_SOURCE, CA_OIL_GAS_WELL_COLOR, CA_OIL_GAS_WELLS_COUNT,
  CA_PIPELINE_SUBSTANCES, CA_PLANT_FUELS, CA_PLANTS_SOURCE, CA_POP_BANDS, CA_POP_CLASSES, CA_POP_POLYGON_FROM_ZOOM, CA_POP_SOURCE, CA_POWER_LINE_COLOR,
  CA_SUBSTATION_COLOR, CA_SUBSTATIONS_FROM_ZOOM, CA_WIND_COLOR, CA_WIND_SOURCE, type CaOilGasPart,
} from "../data/caInfraTypes";
import { caCatColor, caCatFilter } from "./useCaTransportLayers";
import { gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

/**
 * 加拿大第 1 波能源 4 層（C086 電廠、C088 風機、C087 電網、C090 油氣）＋人口中心（C022）。靜態 PMTiles、不訂閱時間。
 * 規格在 `data/caInfraTypes.ts`；V-1：電廠、風機、電力線、主要管線與主要設施 z3 起直接畫；油氣井與井場設施（≥1 萬點）拉遠畫熱區；
 * V-4：燃料別、子項、管線物質、設施類別、人口規模多選；V-5：人口中心「自動（拉遠點、拉近面）／點位」切換。
 */
export const CA_POWER_PLANTS_CIRCLE_ID = "ca-power-plants-circle";
export const CA_WIND_TURBINES_CIRCLE_ID = "ca-wind-turbines-circle";
export const CA_POWER_LINES_LINE_ID = "ca-power-lines-line";
export const CA_POWER_CABLES_LINE_ID = "ca-power-cables-line";
export const CA_SUBSTATIONS_CIRCLE_ID = "ca-power-substations-circle";
export const CA_OG_MAJOR_PIPELINES_LINE_ID = "ca-oil-gas-major-pipelines-line";
export const CA_OG_PIPELINES_LINE_ID = "ca-oil-gas-pipelines-line";
export const CA_OG_WELLS_HEATMAP_ID = "ca-oil-gas-wells-heatmap";
export const CA_OG_WELLS_CIRCLE_ID = "ca-oil-gas-wells-circle";
export const CA_OG_FACILITIES_HEATMAP_ID = "ca-oil-gas-facilities-heatmap";
export const CA_OG_FACILITIES_CIRCLE_ID = "ca-oil-gas-facilities-circle";
export const CA_OG_PIPE_POINTS_CIRCLE_ID = "ca-oil-gas-pipeline-points-circle";
export const CA_OG_MAJOR_FACILITIES_CIRCLE_ID = "ca-oil-gas-major-facilities-circle";
export const CA_POP_POINTS_CIRCLE_ID = "ca-population-centres-points-circle";
export const CA_POP_FILL_ID = "ca-population-centres-fill";
export const CA_POP_OUTLINE_ID = "ca-population-centres-outline";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
const sig = (v: unknown) => JSON.stringify(v);
/** 子項全關時用的永假 filter（不移除 layer，換底圖重掛也一致）。 */
const NONE: Expr = ["==", ["literal", "__ca_none__"], "__ca_part__"];
/** 子項多選：mask 未給或全選＝全開。 */
function partOn(mask: number | undefined, ids: readonly string[], id: string): boolean {
  if (mask === undefined || !Number.isFinite(mask)) return true;
  return selectedMultiSelectValues(mask, ids).includes(id);
}
function bandRadius(prop: string, bands: readonly { min: number; radius: number }[], scale: number): Expr {
  const step: unknown[] = ["step", ["coalesce", ["get", prop], 0], bands[0]!.radius];
  for (const b of bands.slice(1)) step.push(b.min, b.radius);
  return ["*", step, scale];
}
function circleBuild(o: { id: string; source: SourceSpec; sourceLayer: string; minzoom: number; maxzoom?: number; filter: unknown[] | null; paint: () => Record<string, unknown>; sortKey?: unknown }): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type: "circle", source: o.source.id, "source-layer": o.sourceLayer, minzoom: o.minzoom, ...(o.maxzoom ? { maxzoom: o.maxzoom } : {}),
      ...(o.filter ? { filter: o.filter } : {}),
      layout: { visibility: "none", ...(o.sortKey ? { "circle-sort-key": o.sortKey } : {}) }, paint: o.paint(),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(o.id, (o.filter ?? null) as any);
      map.setLayerZoomRange(o.id, o.minzoom, o.maxzoom ?? 24);
      setPaint(map, o.id, o.paint());
    },
  };
}
function lineBuild(o: { key: string; id: string; source: SourceSpec; sourceLayer: string; minzoom: number; filter: unknown[] | null; paint: () => Record<string, unknown> }): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type: "line", source: o.source.id, "source-layer": o.sourceLayer, minzoom: o.minzoom, ...(o.filter ? { filter: o.filter } : {}),
      layout: { visibility: "none", ...hookLineLayout(o.key, o.id) }, paint: o.paint(),
    } as unknown as AnyLayer),
    update: (map) => { map.setFilter(o.id, (o.filter ?? null) as any); map.setPaintProperty(o.id, "line-opacity", o.paint()["line-opacity"] as any); },
  };
}
const pointPaint = (_key: string, color: unknown, radius: unknown, isDark: boolean, opacity: number, def: number) => () => ({
  "circle-radius": radius, "circle-color": color, "circle-opacity": clamp01(opacity), ...pointStrokePaint(isDark, clamp01(opacity) / def),
});
const lineWidthBy = (base: number): Expr => ["interpolate", ["linear"], ["zoom"], 4, 0.5 * base, 10, base, 14, 1.8 * base];

// ─────────────────────────── 電廠（1,125 點，燃料色、容量 4 級大小） ───────────────────────────

const PLANTS_SOURCE: SourceSpec = { id: "ca-power-plants", file: "ca_power_plants.pmtiles", minzoom: 3, maxzoom: 12, attribution: CA_PLANTS_SOURCE.short, loading: "加拿大電廠載入中" };
export const caPlantFuelFilter = (mask: number | undefined) => caCatFilter("fuel_group", CA_PLANT_FUELS, mask);

export function useCaPowerPlantsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number) {
  const def = opacityDefault("caPowerPlants", 0.8);
  const filter = caPlantFuelFilter(catMask);
  useGbPmtilesLayers(mapRef, PLANTS_SOURCE, visible, () => [circleBuild({
    id: CA_POWER_PLANTS_CIRCLE_ID, source: PLANTS_SOURCE, sourceLayer: "ca_power_plants", minzoom: 3, filter, sortKey: ["coalesce", ["get", "capacity_mw"], 0],
    paint: pointPaint("caPowerPlants", caCatColor("fuel_group", CA_PLANT_FUELS), bandRadius("capacity_mw", CA_CAPACITY_BANDS, scale / scaleDefault("caPowerPlants")), isDark, opacity, def),
  })], [opacity, scale, isDark, sig(filter)]);
}

// ─────────────────────────── 風機（7,841 點，<1 萬：V-1 直接畫點） ───────────────────────────

const WIND_SOURCE: SourceSpec = { id: "ca-wind-turbines", file: "ca_wind_turbines.pmtiles", minzoom: 3, maxzoom: 13, attribution: CA_WIND_SOURCE.short, loading: "加拿大風機載入中" };

export function useCaWindTurbinesLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean) {
  const def = opacityDefault("caWindTurbines", 0.8);
  useGbPmtilesLayers(mapRef, WIND_SOURCE, visible, () => [circleBuild({
    id: CA_WIND_TURBINES_CIRCLE_ID, source: WIND_SOURCE, sourceLayer: "ca_wind_turbines", minzoom: 3, filter: null,
    paint: pointPaint("caWindTurbines", CA_WIND_COLOR, pointRadius("S", scale / scaleDefault("caWindTurbines")), isDark, opacity, def),
  })], [opacity, scale, isDark]);
}

// ─────────────────────────── 電網（電力線不分電壓＋變電站） ───────────────────────────

const GRID_SOURCE: SourceSpec = { id: "ca-power-grid", file: "ca_power_grid.pmtiles", minzoom: 3, maxzoom: 12, attribution: CA_GRID_SOURCE.short, loading: "加拿大電網載入中" };
const GRID_PART_IDS = CA_GRID_PARTS.map((p) => p.id);

export function useCaPowerGridLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, partMask?: number) {
  const def = opacityDefault("caPowerGrid", 0.85);
  const on = (id: string) => partOn(partMask, GRID_PART_IDS, id);
  const aboveF: Expr = on("above") ? ["!=", ["get", "location"], "Underwater"] : NONE;
  const underF: Expr = on("under") ? ["==", ["get", "location"], "Underwater"] : NONE;
  const subF: Expr | null = on("substation") ? null : NONE;
  const linePaint = (id: string, dashed: boolean) => () => hookLinePaint("caPowerGrid", id,
    { "line-color": CA_POWER_LINE_COLOR, "line-width": lineWidthBy(1.4), "line-opacity": clamp01(opacity), ...(dashed ? { "line-dasharray": [...LINE_DASH.general] } : {}) },
    { "line-color": CA_POWER_LINE_COLOR, "line-width": lineWidthBy(1.4), "line-opacity": def, ...(dashed ? { "line-dasharray": [...LINE_DASH.general] } : {}) }, isDark);
  useGbPmtilesLayers(mapRef, GRID_SOURCE, visible, () => [
    lineBuild({ key: "caPowerGrid", id: CA_POWER_CABLES_LINE_ID, source: GRID_SOURCE, sourceLayer: "ca_power_lines", minzoom: 3, filter: underF, paint: linePaint(CA_POWER_CABLES_LINE_ID, true) }),
    lineBuild({ key: "caPowerGrid", id: CA_POWER_LINES_LINE_ID, source: GRID_SOURCE, sourceLayer: "ca_power_lines", minzoom: 3, filter: aboveF, paint: linePaint(CA_POWER_LINES_LINE_ID, false) }),
    circleBuild({
      id: CA_SUBSTATIONS_CIRCLE_ID, source: GRID_SOURCE, sourceLayer: "ca_power_substations", minzoom: CA_SUBSTATIONS_FROM_ZOOM, filter: subF,
      paint: pointPaint("caPowerGrid", CA_SUBSTATION_COLOR, pointRadius("S", scale / scaleDefault("caPowerGrid")), isDark, opacity, def),
    }),
  ], [opacity, scale, isDark, sig([aboveF, underF, subF])]);
}

// ─────────────────────────── 油氣（6 個 tile layer＝子項） ───────────────────────────

const OIL_GAS_SOURCE: SourceSpec = { id: "ca-oil-gas", file: "ca_oil_gas.pmtiles", minzoom: 3, maxzoom: 12, attribution: CA_OIL_GAS_SOURCE.short, loading: "加拿大油氣設施載入中" };
const OG_PART_IDS = CA_OIL_GAS_PARTS.map((p) => p.id);
/** 井與井場設施（9.6 萬／3.6 萬點）：P-4 z10 起單點、之下熱區（圖磚低縮放已依密度丟點）。 */
export const CA_OG_POINTS_FROM_ZOOM = densePointsFromZoom(CA_OIL_GAS_WELLS_COUNT);
const OG_FACILITIES_POINTS_FROM_ZOOM = densePointsFromZoom(CA_OIL_GAS_FACILITIES_COUNT);
const OG_HEAT_INTENSITY = 2;
export const caPipeSubstanceFilter = (prop: string, mask: number | undefined) => caCatFilter(prop, CA_PIPELINE_SUBSTANCES, mask, true);
export const caMajorFacilityFilter = (mask: number | undefined) => caCatFilter("facility_type", CA_MAJOR_FACILITY_TYPES, mask);

export function useCaOilGasLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, partMask?: number, pipeMask?: number, facilityMask?: number) {
  const def = opacityDefault("caOilGas", 0.7);
  const heatStyle = useHeatmapStyleSignature(["caOilGas"]);
  const part = (id: CaOilGasPart, filter: Expr | null): Expr | null => (partOn(partMask, OG_PART_IDS, id) ? filter : NONE);
  const majorPipeF = part("major_pipelines", caPipeSubstanceFilter("product", pipeMask));
  const pipeF = part("pipelines", caPipeSubstanceFilter("substance", pipeMask));
  const wellsF = part("wells", null);
  const facF = part("facilities", null);
  const pipePtF = part("pipeline_points", null);
  const majorFacF = part("major_facilities", caMajorFacilityFilter(facilityMask));
  const op = clamp01(opacity);
  const pipePaint = (id: string, prop: string, base: number) => () => hookLinePaint("caOilGas", id,
    { "line-color": caCatColor(prop, CA_PIPELINE_SUBSTANCES, CA_PIPELINE_SUBSTANCES[2]!.color), "line-width": lineWidthBy(base), "line-opacity": op },
    { "line-color": caCatColor(prop, CA_PIPELINE_SUBSTANCES, CA_PIPELINE_SUBSTANCES[2]!.color), "line-width": lineWidthBy(base), "line-opacity": def }, isDark);
  const s = scale / scaleDefault("caOilGas");
  useGbPmtilesLayers(mapRef, OIL_GAS_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: CA_OG_WELLS_HEATMAP_ID, key: "caOilGas", sourceId: OIL_GAS_SOURCE.id, sourceLayer: "ca_oil_gas_wells", maxzoom: heatmapMaxzoom(CA_OG_POINTS_FROM_ZOOM),
      filter: wellsF, isDark, opacityScale: op / def, intensity: OG_HEAT_INTENSITY,
    }),
    gbHeatmapBuild({
      id: CA_OG_FACILITIES_HEATMAP_ID, key: "caOilGas", sourceId: OIL_GAS_SOURCE.id, sourceLayer: "ca_oil_gas_facilities", maxzoom: heatmapMaxzoom(OG_FACILITIES_POINTS_FROM_ZOOM),
      filter: facF, isDark, opacityScale: op / def, intensity: OG_HEAT_INTENSITY,
    }),
    lineBuild({ key: "caOilGas", id: CA_OG_PIPELINES_LINE_ID, source: OIL_GAS_SOURCE, sourceLayer: "ca_oil_gas_pipelines", minzoom: CA_ODI_PIPELINES_FROM_ZOOM, filter: pipeF, paint: pipePaint(CA_OG_PIPELINES_LINE_ID, "substance", 0.8) }),
    lineBuild({ key: "caOilGas", id: CA_OG_MAJOR_PIPELINES_LINE_ID, source: OIL_GAS_SOURCE, sourceLayer: "ca_oil_gas_major_pipelines", minzoom: 3, filter: majorPipeF, paint: pipePaint(CA_OG_MAJOR_PIPELINES_LINE_ID, "product", 1.6) }),
    circleBuild({ id: CA_OG_WELLS_CIRCLE_ID, source: OIL_GAS_SOURCE, sourceLayer: "ca_oil_gas_wells", minzoom: CA_OG_POINTS_FROM_ZOOM, filter: wellsF, paint: pointPaint("caOilGas", CA_OIL_GAS_WELL_COLOR, pointRadius("S", s), isDark, opacity, def) }),
    circleBuild({ id: CA_OG_FACILITIES_CIRCLE_ID, source: OIL_GAS_SOURCE, sourceLayer: "ca_oil_gas_facilities", minzoom: OG_FACILITIES_POINTS_FROM_ZOOM, filter: facF, paint: pointPaint("caOilGas", CA_OIL_GAS_FACILITY_COLOR, pointRadius("S", s), isDark, opacity, def) }),
    circleBuild({ id: CA_OG_PIPE_POINTS_CIRCLE_ID, source: OIL_GAS_SOURCE, sourceLayer: "ca_oil_gas_pipeline_points", minzoom: CA_ODI_PIPE_POINTS_FROM_ZOOM, filter: pipePtF, paint: pointPaint("caOilGas", CA_OIL_GAS_PIPE_POINT_COLOR, pointRadius("S", s), isDark, opacity, def) }),
    circleBuild({
      id: CA_OG_MAJOR_FACILITIES_CIRCLE_ID, source: OIL_GAS_SOURCE, sourceLayer: "ca_oil_gas_major_facilities", minzoom: 3, filter: majorFacF,
      paint: pointPaint("caOilGas", caCatColor("facility_type", CA_MAJOR_FACILITY_TYPES), pointRadius("M", s), isDark, opacity, def),
    }),
  ], [opacity, scale, isDark, heatStyle, sig([majorPipeF, pipeF, wellsF, facF, pipePtF, majorFacF])]);
}

// ─────────────────────────── 人口中心（代表點／面） ───────────────────────────

const POP_SOURCE: SourceSpec = { id: "ca-population-centres", file: "ca_population_centres.pmtiles", minzoom: 3, maxzoom: 13, attribution: CA_POP_SOURCE.short, loading: "加拿大人口中心載入中" };
export const caPopClassFilter = (mask: number | undefined) => caCatFilter("pc_class", CA_POP_CLASSES, mask);
/** `mode`：polygon＝自動（z<6 代表點、z≥6 面）；point＝各縮放都畫代表點。 */
export function useCaPopulationCentresLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, mode: "point" | "polygon", catMask?: number) {
  const def = opacityDefault("caPopulationCentres", 0.55);
  const filter = caPopClassFilter(catMask);
  const polyF = mode === "point" ? NONE : filter;
  const color = caCatColor("pc_class", CA_POP_CLASSES);
  const fillPaint = () => hookFillPaint("caPopulationCentres", CA_POP_FILL_ID, { "fill-color": color, "fill-opacity": clamp01(opacity) }, { "fill-color": color, "fill-opacity": def }, isDark);
  const outlinePaint = () => hookLinePaint("caPopulationCentres", CA_POP_OUTLINE_ID,
    { "line-color": color, "line-width": 1, "line-opacity": Math.min(1, clamp01(opacity) + 0.25) }, { "line-color": color, "line-width": 1, "line-opacity": Math.min(1, def + 0.25) }, isDark);
  useGbPmtilesLayers(mapRef, POP_SOURCE, visible, () => [
    {
      id: CA_POP_FILL_ID,
      layer: () => ({
        id: CA_POP_FILL_ID, type: "fill", source: POP_SOURCE.id, "source-layer": "ca_population_centres", minzoom: CA_POP_POLYGON_FROM_ZOOM,
        ...(polyF ? { filter: polyF } : {}), layout: { visibility: "none" }, paint: fillPaint(),
      } as unknown as AnyLayer),
      update: (map) => { map.setFilter(CA_POP_FILL_ID, (polyF ?? null) as any); map.setPaintProperty(CA_POP_FILL_ID, "fill-opacity", fillPaint()["fill-opacity"] as any); },
    },
    lineBuild({ key: "caPopulationCentres", id: CA_POP_OUTLINE_ID, source: POP_SOURCE, sourceLayer: "ca_population_centres", minzoom: CA_POP_POLYGON_FROM_ZOOM, filter: polyF, paint: outlinePaint }),
    circleBuild({
      id: CA_POP_POINTS_CIRCLE_ID, source: POP_SOURCE, sourceLayer: "ca_population_centres_points", minzoom: 3, maxzoom: mode === "point" ? undefined : CA_POP_POLYGON_FROM_ZOOM + 0.01,
      filter, sortKey: ["coalesce", ["get", "population_2021"], 0],
      paint: () => ({
        "circle-radius": bandRadius("population_2021", CA_POP_BANDS, scale / scaleDefault("caPopulationCentres")), "circle-color": color,
        "circle-opacity": Math.min(1, clamp01(opacity) / def * 0.85), ...pointStrokePaint(isDark, clamp01(opacity) / def),
      }),
    }),
  ], [opacity, scale, isDark, mode, sig(filter)]);
}
