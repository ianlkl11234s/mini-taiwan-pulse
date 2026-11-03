import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, gradedSeamPaint, hatchImageData, hatchImageId, labelHaloPaint, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import {
  CA_ADMIN_COLOR, CA_CIMD_DIMENSIONS, CA_CIMD_PALETTE_ID, CA_CIMD_POLYGON_FROM_ZOOM, CA_CIMD_SOURCE, CA_FED_LABEL_FROM_ZOOM, CA_FED_POLYGON_FROM_ZOOM,
  CA_FED_SOURCE, CA_FSA_CLASSES, CA_FSA_LABEL_FROM_ZOOM, CA_FSA_POLYGON_FROM_ZOOM, CA_FSA_SOURCE, CA_INDIGENOUS_POLYGON_FROM_ZOOM, CA_INDIGENOUS_SOURCE,
  CA_INDIGENOUS_TYPES, CA_RENT_UNITS, CA_RENTS_PALETTE_ID, CA_RENTS_POLYGON_FROM_ZOOM, CA_RENTS_SOURCE, type CaCimdDimension, type CaRentUnit,
} from "../data/caInfraTypes";
import { caCatColor, caCatFilter } from "./useCaTransportLayers";
import { gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";

/**
 * 加拿大第 2 波面資料與社經 5 層（C134 聯邦選區、X010 FSA、C019 原住民法定土地、C023 CIMD、C026 CMHC 租金）。靜態 PMTiles、不訂閱時間。
 * 每支 PMTiles 都另有代表點層：V-1 國家全覽 z3.5 用點（或熱區），放大再換面。layer id 寫字面值（gisClickRegistry／lineFillTiers 以字面值比對）。
 * 分級面（CIMD、租金）：F-3 合規色階（BuPu／YlOrBr，暗底越高越亮）、缺值＝透明底＋45° 斜線（F-3 A），代表點缺值畫灰點，皆不當 0。
 */
export const CA_FED_FILL_ID = "ca-fed-fill";
export const CA_FED_LINE_ID = "ca-fed-line";
export const CA_FED_POINTS_CIRCLE_ID = "ca-fed-points-circle";
export const CA_FED_LABEL_ID = "ca-fed-label";
export const CA_FSA_HEATMAP_ID = "ca-fsa-heatmap";
export const CA_FSA_FILL_ID = "ca-fsa-fill";
export const CA_FSA_LINE_ID = "ca-fsa-line";
export const CA_FSA_LABEL_ID = "ca-fsa-label";
export const CA_INDIGENOUS_FILL_ID = "ca-indigenous-lands-fill";
export const CA_INDIGENOUS_OUTLINE_ID = "ca-indigenous-lands-outline";
export const CA_INDIGENOUS_POINTS_CIRCLE_ID = "ca-indigenous-lands-points-circle";
export const CA_CIMD_FILL_ID = "ca-cimd-fill";
export const CA_CIMD_NA_FILL_ID = "ca-cimd-na-fill";
export const CA_CIMD_SEAM_ID = "ca-cimd-seam";
export const CA_CIMD_POINTS_CIRCLE_ID = "ca-cimd-points-circle";
export const CA_RENTS_FILL_ID = "ca-rents-fill";
export const CA_RENTS_NA_FILL_ID = "ca-rents-na-fill";
export const CA_RENTS_SEAM_ID = "ca-rents-seam";
export const CA_RENTS_POINTS_CIRCLE_ID = "ca-rents-points-circle";

type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const setPaint = (map: MapboxMap, id: string, paint: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
};
const sig = (v: unknown) => JSON.stringify(v);
/** 子項全關或模式不畫時用的永假 filter（不移除 layer，換底圖重掛也一致）。 */
const NONE: Expr = ["==", ["literal", "__ca_none__"], "__ca_part__"];
/** 缺值點（無指數／不公布）：行政界中性灰（不吃色階、不當 0）。 */
export const CA_NA_POINT_COLOR = CA_ADMIN_COLOR;
const textColor = (isDark: boolean) => (isDark ? "#e5e7eb" : "#1f2937");

type Spec = { id: string; source: SourceSpec; sourceLayer: string; minzoom: number; maxzoom?: number; filter: Expr | null };
function build(type: "fill" | "line" | "circle" | "symbol", o: Spec & { paint: () => Record<string, unknown>; layout?: Record<string, unknown>; before?: LayerBuild["before"] }): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type, source: o.source.id, "source-layer": o.sourceLayer, minzoom: o.minzoom, ...(o.maxzoom ? { maxzoom: o.maxzoom } : {}),
      ...(o.filter ? { filter: o.filter } : {}), layout: { visibility: "none", ...(o.layout ?? {}) }, paint: o.paint(),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(o.id, (o.filter ?? null) as any);
      map.setLayerZoomRange(o.id, o.minzoom, o.maxzoom ?? 24);
      setPaint(map, o.id, o.paint());
    },
    ...(o.before ? { before: o.before } : {}),
  };
}
function ensureHatchImages(map: MapboxMap): undefined {
  for (const dark of [true, false]) {
    const id = hatchImageId("missing", dark);
    if (!map.hasImage(id)) map.addImage(id, hatchImageData("missing", dark));
  }
  return undefined;
}
const labelLayout = (field: unknown, size: number) => ({
  "text-field": field, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-size": size, "text-allow-overlap": false,
  "text-padding": 4, "text-max-width": 8,
});
const labelPaint = (isDark: boolean, opacity: number) => () => ({ "text-color": textColor(isDark), "text-opacity": clamp01(opacity), ...labelHaloPaint(isDark) });
const fadeOpacity = (opacity: number, def: number) => clamp01(opacity) / def;

// ─────────────────────────── 聯邦選區（338，邊界類） ───────────────────────────

const FED_SOURCE: SourceSpec = { id: "ca-federal-districts", file: "ca_federal_districts.pmtiles", minzoom: 2, maxzoom: 12, attribution: CA_FED_SOURCE.short, loading: "加拿大聯邦選區載入中" };

/** 行政界中性灰外框＋透明面（點擊熱區）；z<6 疊代表點小圓點（都市選區太小），z8 起標選區英文名。 */
export function useCaFederalDistrictsLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean) {
  const key = "caFederalDistricts";
  const def = opacityDefault(key, 0.85);
  const gray = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  useGbPmtilesLayers(mapRef, FED_SOURCE, visible, () => [
    build("fill", { id: CA_FED_FILL_ID, source: FED_SOURCE, sourceLayer: "ca_fed", minzoom: 2, filter: null, paint: () => ({ "fill-color": gray, "fill-opacity": 0 }) }),
    build("line", {
      id: CA_FED_LINE_ID, source: FED_SOURCE, sourceLayer: "ca_fed", minzoom: 2, filter: null, layout: hookLineLayout(key, CA_FED_LINE_ID),
      paint: () => ({
        ...hookLinePaint(key, CA_FED_LINE_ID, { "line-color": gray, "line-width": 1, "line-opacity": clamp01(opacity) }, { "line-color": gray, "line-width": 1, "line-opacity": def }, isDark),
        "line-color": gray,
      }),
    }),
    build("circle", {
      id: CA_FED_POINTS_CIRCLE_ID, source: FED_SOURCE, sourceLayer: "ca_fed_points", minzoom: 2, maxzoom: CA_FED_POLYGON_FROM_ZOOM, filter: null,
      paint: () => ({ "circle-radius": pointRadius("S", 1), "circle-color": gray, "circle-opacity": clamp01(opacity), ...pointStrokePaint(isDark, fadeOpacity(opacity, def)) }),
    }),
    build("symbol", {
      id: CA_FED_LABEL_ID, source: FED_SOURCE, sourceLayer: "ca_fed_points", minzoom: CA_FED_LABEL_FROM_ZOOM, filter: null,
      layout: labelLayout(["coalesce", ["get", "name_en"], ["get", "name"]], 11), paint: labelPaint(isDark, opacity),
    }),
  ], [opacity, isDark]);
}

// ─────────────────────────── 郵遞分區 FSA（1,643，都市／農村） ───────────────────────────

const FSA_SOURCE: SourceSpec = { id: "ca-postal-fsa", file: "ca_postal_fsa.pmtiles", minzoom: 2, maxzoom: 12, attribution: CA_FSA_SOURCE.short, loading: "加拿大郵遞分區載入中" };
export const caFsaClassFilter = (mask: number | undefined) => caCatFilter("rural", CA_FSA_CLASSES, mask);
const FSA_HEAT_INTENSITY = 1.5;

/** z<6：外框細線＋代表點熱區（都市密集處）；z6 起依都市／農村填色（農村較淡），z7 起標 FSA 代碼。 */
export function useCaPostalFsaLayer(mapRef: MapRef, visible: boolean, opacity: number, isDark: boolean, catMask?: number) {
  const key = "caPostalFsa";
  const def = opacityDefault(key, 0.7);
  const heatStyle = useHeatmapStyleSignature([key]);
  const filter = caFsaClassFilter(catMask);
  const color = caCatColor("rural", CA_FSA_CLASSES);
  const gray = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  useGbPmtilesLayers(mapRef, FSA_SOURCE, visible, () => [
    gbHeatmapBuild({
      id: CA_FSA_HEATMAP_ID, key, sourceId: FSA_SOURCE.id, sourceLayer: "ca_fsa_points", maxzoom: CA_FSA_POLYGON_FROM_ZOOM + 0.01,
      filter, isDark, opacityScale: fadeOpacity(opacity, def), intensity: FSA_HEAT_INTENSITY,
    }),
    build("fill", {
      id: CA_FSA_FILL_ID, source: FSA_SOURCE, sourceLayer: "ca_fsa", minzoom: CA_FSA_POLYGON_FROM_ZOOM, filter,
      paint: () => hookFillPaint(key, CA_FSA_FILL_ID, { "fill-color": color, "fill-opacity": clamp01(opacity) }, { "fill-color": color, "fill-opacity": def }, isDark),
    }),
    build("line", {
      id: CA_FSA_LINE_ID, source: FSA_SOURCE, sourceLayer: "ca_fsa", minzoom: 2, filter, layout: hookLineLayout(key, CA_FSA_LINE_ID),
      paint: () => ({
        ...hookLinePaint(key, CA_FSA_LINE_ID, { "line-color": gray, "line-width": 0.6, "line-opacity": clamp01(opacity) }, { "line-color": gray, "line-width": 0.6, "line-opacity": def }, isDark),
        "line-color": gray,
      }),
    }),
    build("symbol", {
      id: CA_FSA_LABEL_ID, source: FSA_SOURCE, sourceLayer: "ca_fsa_points", minzoom: CA_FSA_LABEL_FROM_ZOOM, filter,
      layout: labelLayout(["get", "fsa"], 11), paint: labelPaint(isDark, opacity),
    }),
  ], [opacity, isDark, heatStyle, sig(filter)]);
}

// ─────────────────────────── 原住民法定土地（3,377，4 類） ───────────────────────────

const INDIGENOUS_SOURCE: SourceSpec = { id: "ca-indigenous-lands", file: "ca_indigenous_lands.pmtiles", minzoom: 2, maxzoom: 12, attribution: CA_INDIGENOUS_SOURCE.short, loading: "加拿大原住民土地載入中" };
export const caIndigenousTypeFilter = (mask: number | undefined) => caCatFilter("dist_type_en", CA_INDIGENOUS_TYPES, mask);

/**
 * `mode`：polygon＝自動（面各縮放都畫，NU／NT 大面拉遠可見；z<7 另疊代表點，保留地多為小面）；point＝各縮放只畫代表點。
 */
export function useCaIndigenousLandsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, mode: "point" | "polygon", catMask?: number) {
  const key = "caIndigenousLands";
  const def = opacityDefault(key, 0.55);
  const filter = caIndigenousTypeFilter(catMask);
  const polyF = mode === "point" ? NONE : filter;
  const color = caCatColor("dist_type_en", CA_INDIGENOUS_TYPES);
  const s = scale / scaleDefault(key);
  useGbPmtilesLayers(mapRef, INDIGENOUS_SOURCE, visible, () => [
    build("fill", {
      id: CA_INDIGENOUS_FILL_ID, source: INDIGENOUS_SOURCE, sourceLayer: "ca_indigenous_lands", minzoom: 2, filter: polyF,
      paint: () => hookFillPaint(key, CA_INDIGENOUS_FILL_ID, { "fill-color": color, "fill-opacity": clamp01(opacity) }, { "fill-color": color, "fill-opacity": def }, isDark),
    }),
    build("line", {
      id: CA_INDIGENOUS_OUTLINE_ID, source: INDIGENOUS_SOURCE, sourceLayer: "ca_indigenous_lands", minzoom: 2, filter: polyF, layout: hookLineLayout(key, CA_INDIGENOUS_OUTLINE_ID),
      paint: () => hookLinePaint(key, CA_INDIGENOUS_OUTLINE_ID,
        { "line-color": color, "line-width": 1, "line-opacity": Math.min(1, clamp01(opacity) + 0.25) }, { "line-color": color, "line-width": 1, "line-opacity": Math.min(1, def + 0.25) }, isDark),
    }),
    build("circle", {
      id: CA_INDIGENOUS_POINTS_CIRCLE_ID, source: INDIGENOUS_SOURCE, sourceLayer: "ca_indigenous_lands_points", minzoom: 2,
      maxzoom: mode === "point" ? undefined : CA_INDIGENOUS_POLYGON_FROM_ZOOM, filter,
      paint: () => ({
        "circle-radius": pointRadius("S", s), "circle-color": color,
        "circle-opacity": Math.min(1, fadeOpacity(opacity, def) * 0.9), ...pointStrokePaint(isDark, fadeOpacity(opacity, def)),
      }),
    }),
  ], [opacity, scale, isDark, mode, sig(filter)]);
}

// ─────────────────────────── 分級面共用（CIMD、租金） ───────────────────────────

/** 5 級色階（暗底越高越亮、淡底越高越深；色盤庫 7 階重新取樣）。 */
export const caCimdColors = (isDark: boolean) => resampleRamp(paletteRamp(CA_CIMD_PALETTE_ID, isDark) ?? [], 5);
export const caRentColors = (isDark: boolean) => resampleRamp(paletteRamp(CA_RENTS_PALETTE_ID, isDark) ?? [], 5);

function gradedBuilds(o: {
  key: string; source: SourceSpec; polyLayer: string; pointLayer: string; polyFrom: number; fillId: string; naId: string; seamId: string; pointId: string;
  color: Expr; hasValue: Expr; isDark: boolean; opacity: number; def: number; radius: unknown;
}): LayerBuild[] {
  const { key, isDark, opacity, def } = o;
  const op = clamp01(opacity);
  const missing: Expr = ["!", o.hasValue];
  const fillColor: Expr = ["case", o.hasValue, o.color, "rgba(0,0,0,0)"];
  const pointColor: Expr = ["case", o.hasValue, o.color, CA_NA_POINT_COLOR];
  const hatch = hatchImageId("missing", isDark);
  return [
    build("fill", {
      id: o.fillId, source: o.source, sourceLayer: o.polyLayer, minzoom: o.polyFrom, filter: o.hasValue,
      paint: () => hookFillPaint(key, o.fillId, { "fill-color": fillColor, "fill-opacity": op }, { "fill-color": fillColor, "fill-opacity": def }, isDark),
    }),
    build("fill", {
      id: o.naId, source: o.source, sourceLayer: o.polyLayer, minzoom: o.polyFrom, filter: missing, before: ensureHatchImages,
      paint: () => hookFillPaint(key, o.naId, { "fill-pattern": hatch, "fill-opacity": op }, { "fill-pattern": hatch, "fill-opacity": def }, isDark),
    }),
    build("line", {
      id: o.seamId, source: o.source, sourceLayer: o.polyLayer, minzoom: o.polyFrom, filter: null, layout: hookLineLayout(key, o.seamId),
      paint: () => hookLinePaint(key, o.seamId, gradedSeamPaint(isDark, o.hasValue), gradedSeamPaint(isDark, o.hasValue), isDark),
    }),
    build("circle", {
      id: o.pointId, source: o.source, sourceLayer: o.pointLayer, minzoom: 2, maxzoom: o.polyFrom, filter: null,
      paint: () => ({
        "circle-radius": o.radius, "circle-color": pointColor, "circle-opacity": Math.min(1, fadeOpacity(opacity, def) * 0.9),
        ...pointStrokePaint(isDark, fadeOpacity(opacity, def)),
      }),
    }),
  ];
}

// ─────────────────────────── 剝奪指數 CIMD（55,726 DA，4 面向擇一） ───────────────────────────

const CIMD_SOURCE: SourceSpec = { id: "ca-deprivation", file: "ca_deprivation.pmtiles", minzoom: 3, maxzoom: 12, attribution: CA_CIMD_SOURCE.short, loading: "加拿大剝奪指數載入中" };
export const caCimdDimensionFromIdx = (idx: number | undefined): CaCimdDimension => CA_CIMD_DIMENSIONS[idx ?? 0]?.value ?? "econ_dep";

/** 五分位 1–5 → 5 級色；`<dim>_q` 缺值（另 2,206 DA）＝斜線／灰點。 */
export function caCimdColorExpr(dim: CaCimdDimension, isDark: boolean): Expr {
  const c = caCimdColors(isDark);
  return ["match", ["to-number", ["coalesce", ["get", `${dim}_q`], 0]], 1, c[0], 2, c[1], 3, c[2], 4, c[3], 5, c[4], CA_NA_POINT_COLOR];
}
export const caCimdHasValue = (dim: CaCimdDimension): Expr => ["in", ["to-number", ["coalesce", ["get", `${dim}_q`], 0]], ["literal", [1, 2, 3, 4, 5]]];

export function useCaDeprivationLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, dim: CaCimdDimension) {
  const key = "caDeprivation";
  const def = opacityDefault(key, 0.55);
  const s = scale / scaleDefault(key);
  useGbPmtilesLayers(mapRef, CIMD_SOURCE, visible, () => gradedBuilds({
    key, source: CIMD_SOURCE, polyLayer: "ca_cimd_da", pointLayer: "ca_cimd_points", polyFrom: CA_CIMD_POLYGON_FROM_ZOOM,
    fillId: CA_CIMD_FILL_ID, naId: CA_CIMD_NA_FILL_ID, seamId: CA_CIMD_SEAM_ID, pointId: CA_CIMD_POINTS_CIRCLE_ID,
    color: caCimdColorExpr(dim, isDark), hasValue: caCimdHasValue(dim), isDark, opacity, def,
    radius: ["*", ["interpolate", ["linear"], ["zoom"], 3, 1.2, 5, 2, 6, 2.6], s],
  }), [opacity, scale, isDark, dim]);
}

// ─────────────────────────── CMHC 租金（146 CMA／CA，4 房型擇一） ───────────────────────────

const RENTS_SOURCE: SourceSpec = { id: "ca-rents", file: "ca_rents.pmtiles", minzoom: 2, maxzoom: 12, attribution: CA_RENTS_SOURCE.short, loading: "加拿大租金載入中" };
export const caRentUnitFromIdx = (idx: number | undefined): CaRentUnit => CA_RENT_UNITS[idx ?? 0]?.value ?? "br2";
const rentUnit = (unit: CaRentUnit) => CA_RENT_UNITS.find((u) => u.value === unit) ?? CA_RENT_UNITS[0];

export const caRentHasValue = (unit: CaRentUnit): Expr => ["==", ["typeof", ["get", rentUnit(unit).prop]], "number"];
export function caRentColorExpr(unit: CaRentUnit, isDark: boolean): Expr {
  const u = rentUnit(unit);
  const c = caRentColors(isDark);
  return ["step", ["to-number", ["coalesce", ["get", u.prop], 0]], c[0], u.breaks[0], c[1], u.breaks[1], c[2], u.breaks[2], c[3], u.breaks[3], c[4]];
}

export function useCaRentsLayer(mapRef: MapRef, visible: boolean, opacity: number, scale: number, isDark: boolean, unit: CaRentUnit) {
  const key = "caRents";
  const def = opacityDefault(key, 0.55);
  const s = scale / scaleDefault(key);
  useGbPmtilesLayers(mapRef, RENTS_SOURCE, visible, () => gradedBuilds({
    key, source: RENTS_SOURCE, polyLayer: "ca_rents_cma", pointLayer: "ca_rents_points", polyFrom: CA_RENTS_POLYGON_FROM_ZOOM,
    fillId: CA_RENTS_FILL_ID, naId: CA_RENTS_NA_FILL_ID, seamId: CA_RENTS_SEAM_ID, pointId: CA_RENTS_POINTS_CIRCLE_ID,
    color: caRentColorExpr(unit, isDark), hasValue: caRentHasValue(unit), isDark, opacity, def,
    radius: pointRadius("M", s),
  }), [opacity, scale, isDark, unit]);
}

