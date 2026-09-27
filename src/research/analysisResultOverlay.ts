import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map } from "mapbox-gl";
import { RESULT_COLLECTION_LIMITS, type PresentableResult } from "./researchAnalysisSession";
import { prefersReducedMotion } from "./researchMotion";
import type { ResultCollection } from "./bridgeClient";
import { VIZ_SPEC, type Theme } from "./vizSpec";
import { ensureNullHatchImage } from "./vizNullPattern";
import { TITLE_KEYS } from "./researchResultPopup";
import {
  warehouseFillNullFilter, warehouseHeatmapFilter, warehouseHeatmapPaint, warehouseProportionalColor, warehouseProportionalLabelFilter,
  warehouseProportionalSizeFilter, warehouseProportionalSortKey, warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend,
  type WarehouseResultStyle, type WarehouseStyleLegend,
} from "./warehouseResultStyle";

const MAX_RESULTS = RESULT_COLLECTION_LIMITS.maxLogicalResults;
const COLORS = ["#00b8d9", "#ff8f00", "#d81b60", "#7e57c2", "#43a047", "#5c6bc0", "#e53935", "#00897b"];
const COUNT_STOPS = [5, 10] as const;
const COUNT_COLORS = ["#bae6fd", "#0284c7", "#075985"] as const;
const NUMERIC_COLORS = ["#e0f2fe", "#7dd3fc", "#38bdf8", "#0284c7", "#075985"] as const;
const NUMERIC_SINGLE_COLOR = "#0369a1";
const MISSING_NUMERIC_COLOR = "#cbd5e1";
const SUPPRESSED_NUMERIC_COLOR = "#64748b";
const sourceId = (index: number) => `research-analysis-result-${index}`;
const layerId = (index: number) => `research-analysis-result-points-${index}`;
/** Heatmaps are not pickable, so a styled heatmap keeps a close-zoom circle layer for popup/select. */
const heatPointsLayerId = (index: number) => `research-analysis-result-heat-points-${index}`;
/** Numbered marker labels (1..N) for a compare-styled point result; decorative only, not pickable. */
const compareLabelLayerId = (index: number) => `research-analysis-result-compare-label-${index}`;
/** Choropleth/bivariate `nullStyle: "hatch"` overlay: a transparent fill-pattern layer drawn only
 *  over the features the main fill layer leaves transparent (missing `_style_value`). Not
 *  independently pickable — the main fill layer already covers the same features for click/popup. */
const nullHatchLayerId = (index: number) => `research-analysis-result-null-hatch-${index}`;
/** Proportional-symbol top-N name labels; decorative only, not pickable (like compareLabelLayerId). */
const proportionalLabelLayerId = (index: number) => `research-analysis-result-proportional-label-${index}`;
/** Bivariate V3's y-size bubbles need their own point source: the primary source's geometry is
 *  often the x-fill's polygon, not a good bubble position, so each row's precomputed `_size_anchor`
 *  is turned into a sibling point feature (bivariateSizeCollection). Empty hollow circles, not
 *  independently pickable — the primary fill layer already covers the same features for popup. */
const bivariateSizeSourceId = (index: number) => `research-analysis-result-bivariate-size-${index}`;
const bivariateSizeLayerId = (index: number) => `research-analysis-result-bivariate-size-circle-${index}`;
/** Stroke for a bivariate V3 size bubble: a neutral grey contrasting with each basemap theme, per
 *  the viz-library PLAN phase-B message (not itself a viz-spec value — SPEC GAP: this should live
 *  next to `VIZ_SPEC.ring` in viz-spec.json, see this worker's phase-B report). */
const BIVARIATE_SIZE_RING: Record<Theme, string> = { dark: "#f3f4f6", light: "#111827" };
/**
 * A `properties._role === "scope"` feature (e.g. a nearby_profile search-radius circle, MCP
 * contract in warehouse/engine.ts `scopeCircleFeature`) draws as a dashed, unfilled outline
 * sharing the result's own polygon source, never as part of its fill/circle layer.
 */
const scopeRingLayerId = (index: number) => `research-analysis-result-scope-${index}`;
const SCOPE_ROLE_FILTER = ["==", ["get", "_role"], "scope"] as unknown as ExpressionSpecification;
const SCOPE_ROLE_EXCLUDE_FILTER = ["!=", ["get", "_role"], "scope"] as unknown as ExpressionSpecification;
const SCOPE_RING_COLOR = "#e2e8f0";
const HEAT_POINTS_MINZOOM = 13;
const reveals = new WeakMap<Map, globalThis.Map<number, () => void>>();

function isAnalysisScopeArea(result: PresentableResult): boolean { return result.datasetId === "derived:analysis-scope-area"; }
function isAnalysisScopeCenter(result: PresentableResult): boolean { return result.datasetId === "derived:analysis-scope-center"; }
/** A row tagged by the MCP nearby_profile scope-circle contract; never a real analysis match. */
function isScopeRow(row: Record<string, unknown>): boolean { return row._role === "scope"; }
function hasScopeRows(result: PresentableResult): boolean {
  return (result.geometry.type === "Polygon" || result.geometry.type === "MultiPolygon") && result.rows.some(isScopeRow);
}
function scopeRadiusM(result: PresentableResult): number | null {
  const row = result.rows.find(isScopeRow);
  const value = row?.radiusM;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type AnalysisResultPresentation = {
  resultId: string;
  datasetId: string;
  displayLabel: string;
  geometryType: PresentableResult["geometry"]["type"];
  featureCount: number;
  /** Exact paint color for this rendered result; absent before it is installed. */
  color?: string;
  /** Derived display scope uses a lighter fill than authoritative polygon results. */
  scopeArea?: true;
  /** A proportional-symbol circle's own base opacity ratio (spec M3 `fillOpacity`), composed with
   *  the user's opacity slider the same way `scopeArea` composes with a polygon's fill ratio. */
  circleOpacityRatio?: number;
  /** A nearby_profile search-radius circle is mixed into this result's own rows (_role "scope");
   *  it renders as a dashed unfilled outline and is excluded from featureCount/popup stats. */
  scopeRing?: { radiusM: number | null };
  /** Only emitted for the existing neighborhood count presentation. */
  countLegend?: { label: string; radiusM: number; entries: readonly { label: string; color: string }[] };
  /** Administrative comparison values and the exact colors used by the map. */
  numericLegend?: NumericResultLegend;
  /** Server-computed warehouse style legend (choropleth / bivariate / heatmap). */
  styleLegend?: WarehouseStyleLegend;
  /** Server-computed field x point comparison table; rendered as a table, never a colour legend. */
  compareTable?: Extract<WarehouseResultStyle, { kind: "compare" }>;
};

/** User-selected opacity is owned by resultId so hidden or reordered results retain it. */
export type AnalysisResultOpacity = { defaultOpacity: number; byResult: Readonly<Record<string, number>> };

export type NumericResultLegend = {
  field: "normalizedValue" | "value";
  unit: string;
  method: "equal_interval" | "single_value";
  entries: readonly NumericResultLegendEntry[];
  label: string;
};

export type NumericResultLegendEntry = {
  label: string;
  color: string;
  min?: number;
  max?: number;
  status?: "missing" | "suppressed";
};

export type AnalysisResultReadback = {
  mode: "none" | "analysis_result";
  /** Canonical collection requested by the scene, including hidden entries/groups. */
  collection: ResultCollection | null;
  /** Ordered result IDs actually rendered after item/group visibility is applied. */
  renderedResultIds: string[];
  resultIds: string[];
  datasets: string[];
  featureCount: number;
  sourceIds: string[];
  layerIds: string[];
  sourcesReady: boolean;
  layersReady: boolean;
  ready: boolean;
};

function cancelReveal(map: Map, index: number): void {
  const listener = reveals.get(map)?.get(index);
  if (listener) map.off("render", listener);
  reveals.get(map)?.delete(index);
}

function collection(result: PresentableResult): FeatureCollection<Point | LineString | MultiLineString | Polygon | MultiPolygon> {
  const features: Feature<Point | LineString | MultiLineString | Polygon | MultiPolygon>[] = result.rows.flatMap<Feature<Point | LineString | MultiLineString | Polygon | MultiPolygon>>((row, rowIndex) => {
    const geometry = row.geometry as { type?: unknown; coordinates?: unknown } | undefined;
    if (geometry?.type !== result.geometry.type) return [];
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: propertiesFor(row, result), geometry: geometry as Polygon | MultiPolygon }];
    }
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: propertiesFor(row, result), geometry: geometry as LineString | MultiLineString }];
    }
    if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return [];
    const [lng, lat] = geometry.coordinates;
    if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) return [];
    return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: propertiesFor(row, result), geometry: { type: "Point", coordinates: [lng, lat] } }];
  });
  return { type: "FeatureCollection", features };
}

/** One Point feature per row that carries a valid `_size_anchor` ([lon, lat], same shape/validity
 *  rule as the ordinary Point coordinate check above); a malformed anchor skips that row's bubble
 *  rather than throwing and failing the whole install. */
function bivariateSizeCollection(result: PresentableResult, style: Extract<WarehouseResultStyle, { kind: "bivariate" }>): FeatureCollection<Point> {
  const features: Feature<Point>[] = result.rows.flatMap<Feature<Point>>((row, rowIndex) => {
    const anchor = row[style.sizeAnchorProperty];
    if (!Array.isArray(anchor) || anchor.length !== 2) return [];
    const [lng, lat] = anchor;
    if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180 || typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) return [];
    return [{ type: "Feature", id: `${result.resultId}:size:${rowIndex}`, properties: propertiesFor(row, result), geometry: { type: "Point", coordinates: [lng, lat] } }];
  });
  return { type: "FeatureCollection", features };
}

function propertiesFor(row: Record<string, unknown>, result: PresentableResult): Record<string, string | number | boolean | null> {
  const properties = Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== "geometry" && (value === null || ["string", "number", "boolean"].includes(typeof value))));
  const valueUnit = result.units?.value;
  const differenceUnit = result.units?.absoluteDifference;
  const normalizedUnit = result.units?.normalizedValue;
  const sourceAreaUnit = result.units?.area_ha;
  const magnitudeUnit = result.units?.magnitude;
  const depthUnit = result.units?.depth_km;
  const styleFact = result.resultStyle ? warehouseStyleFact(result.resultStyle, row) : null;
  return {
    ...properties,
    ...(styleFact ? { styleFactLabel: styleFact.label, styleFactValue: styleFact.value } : {}),
    ...(result.units && Object.prototype.hasOwnProperty.call(result.units, "value") ? { unit: valueUnit ?? null } : {}),
    ...(result.units && Object.prototype.hasOwnProperty.call(result.units, "absoluteDifference") ? { differenceUnit: differenceUnit ?? null } : {}),
    ...(result.units && Object.prototype.hasOwnProperty.call(result.units, "normalizedValue") ? { normalizedUnit: normalizedUnit ?? null } : {}),
    ...(result.units && Object.prototype.hasOwnProperty.call(result.units, "area_ha") ? { sourceAreaUnit: sourceAreaUnit ?? null } : {}),
    ...(result.units && Object.prototype.hasOwnProperty.call(result.units, "magnitude") ? { magnitudeUnit: magnitudeUnit ?? null } : {}),
    ...(result.units && Object.prototype.hasOwnProperty.call(result.units, "depth_km") ? { depthUnit: depthUnit ?? null } : {}),
    resultId: result.resultId,
    datasetId: result.datasetId,
  };
}

type NumericField = "normalizedValue" | "value";

function nonEmptyString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }

function isRegionComparisonPolygon(result: PresentableResult): boolean {
  if (result.geometry.type !== "Polygon" && result.geometry.type !== "MultiPolygon") return false;
  return result.rows.length > 0 && result.rows.every(row =>
    nonEmptyString(row.area_code) !== null &&
    ["observed", "missing", "suppressed", "not_reported"].includes(String(row.status)) &&
    ["valid", "missing", "suppressed", "not_reported", "baseline_missing", "baseline_suppressed", "baseline_not_reported", "baseline_zero"].includes(String(row.comparison_status)) &&
    ["not_requested", "valid", "missing", "suppressed", "not_reported", "denominator_missing", "denominator_suppressed", "denominator_not_reported", "zero_denominator"].includes(String(row.normalization_status))
  );
}

function numericValue(row: Record<string, unknown>, field: NumericField): number | null {
  const value = row[field];
  if (row.status !== "observed" || typeof value !== "number" || !Number.isFinite(value)) return null;
  if (field === "normalizedValue" && row.normalization_status !== "valid") return null;
  return value;
}

function numberLabel(value: number): string {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 4 }).format(value);
}

/** Only exact compare_regions-shaped administrative polygons receive a numeric fill. */
export function numericResultLegend(result: PresentableResult): NumericResultLegend | undefined {
  if (!isRegionComparisonPolygon(result)) return undefined;
  const normalizedUnit = nonEmptyString(result.units?.normalizedValue);
  const valueUnit = nonEmptyString(result.units?.value);
  const field: NumericField | null = normalizedUnit ? "normalizedValue" : valueUnit ? "value" : null;
  const unit = normalizedUnit ?? valueUnit;
  if (!field || !unit) return undefined;
  const values = result.rows.map(row => numericValue(row, field)).filter((value): value is number => value !== null);
  if (!values.length) return undefined;
  const unique = [...new Set(values)].sort((left, right) => left - right);
  const min = unique[0]!;
  const max = unique[unique.length - 1]!;
  const binCount = Math.min(5, unique.length);
  const colors = binCount === 1 ? [NUMERIC_SINGLE_COLOR] : Array.from({ length: binCount }, (_, index) => NUMERIC_COLORS[Math.round(index * (NUMERIC_COLORS.length - 1) / (binCount - 1))]!);
  const entries: NumericResultLegendEntry[] = [];
  if (binCount === 1) entries.push({ min, max, color: colors[0]!, label: `${numberLabel(min)} ${unit}` });
  else {
    const step = (max - min) / binCount;
    for (let index = 0; index < binCount; index += 1) {
      const lower = min + step * index;
      const upper = index === binCount - 1 ? max : min + step * (index + 1);
      entries.push({ min: lower, max: upper, color: colors[index]!, label: `${numberLabel(lower)}${index === binCount - 1 ? "–" : "–<"}${numberLabel(upper)} ${unit}` });
    }
  }
  entries.push({ status: "suppressed", color: SUPPRESSED_NUMERIC_COLOR, label: "受抑制／分母受抑制" });
  entries.push({ status: "missing", color: MISSING_NUMERIC_COLOR, label: "缺值／未報告／分母無法計算" });
  return { field, unit, method: binCount === 1 ? "single_value" : "equal_interval", entries, label: `${field === "normalizedValue" ? "標準化值" : "原始值"}（${unit}）` };
}

function numericFillColor(legend: NumericResultLegend): ExpressionSpecification {
  const valueEntries = legend.entries.filter((entry): entry is NumericResultLegendEntry & Required<Pick<NumericResultLegendEntry, "min" | "max">> => entry.min !== undefined && entry.max !== undefined);
  const colors = valueEntries.map(entry => entry.color);
  const thresholds = valueEntries.slice(1).map(entry => entry.min);
  const scale: unknown = valueEntries.length === 1 ? colors[0]! : (() => {
    const expression: unknown[] = ["step", ["get", legend.field], colors[0]!];
    thresholds.forEach((threshold, index) => expression.push(threshold, colors[index + 1]!));
    return expression;
  })();
  const valid = legend.field === "normalizedValue"
    ? ["all", ["==", ["get", "status"], "observed"], ["==", ["get", "normalization_status"], "valid"], ["==", ["typeof", ["get", legend.field]], "number"], [">=", ["get", legend.field], valueEntries[0]!.min], ["<=", ["get", legend.field], valueEntries[valueEntries.length - 1]!.max]]
    : ["all", ["==", ["get", "status"], "observed"], ["==", ["typeof", ["get", legend.field]], "number"], [">=", ["get", legend.field], valueEntries[0]!.min], ["<=", ["get", legend.field], valueEntries[valueEntries.length - 1]!.max]];
  return ["case", valid, scale, ["any", ["==", ["get", "status"], "suppressed"], ["==", ["get", "normalization_status"], "denominator_suppressed"]], SUPPRESSED_NUMERIC_COLOR, MISSING_NUMERIC_COLOR] as unknown as ExpressionSpecification;
}

/** The single representative swatch colour for a styled result's row-item icon: the "most" end of
 *  its resolved palette. Bivariate/proportional have no flat `colors` fallback (always `palette`);
 *  choropleth/heatmap may still be the stage-A flat-`colors` format. */
function styleSwatchColor(style: Exclude<WarehouseResultStyle, { kind: "compare" }>, theme: Theme): string {
  const colors = "colors" in style ? (style.palette ? style.palette[theme] : style.colors) : style.palette[theme];
  return colors[colors.length - 1]!;
}

function presentation(result: PresentableResult, featureCount: number, theme: Theme, index?: number): AnalysisResultPresentation {
  const countLegend = result.presentation && result.geometry.type === "Point" ? {
    label: result.presentation.label,
    radiusM: result.presentation.radiusM,
    entries: [
      { label: `0–${COUNT_STOPS[0] - 1} 筆`, color: COUNT_COLORS[0] },
      { label: `${COUNT_STOPS[0]}–${COUNT_STOPS[1] - 1} 筆`, color: COUNT_COLORS[1] },
      { label: `≥${COUNT_STOPS[1]} 筆`, color: COUNT_COLORS[2] },
    ],
  } : undefined;
  const numericLegend = numericResultLegend(result);
  const style = result.resultStyle;
  const styleSwatch = style && style.kind !== "compare" ? styleSwatchColor(style, theme) : undefined;
  return {
    resultId: result.resultId, datasetId: result.datasetId, displayLabel: result.displayLabel ?? result.datasetId,
    geometryType: result.geometry.type, featureCount, ...(index === undefined || countLegend ? {} : { color: styleSwatch ?? (numericLegend ? numericLegend.entries[0]!.color : isAnalysisScopeCenter(result) ? "#fef3c7" : COLORS[index]!) }),
    ...(style && style.kind !== "compare" ? { styleLegend: warehouseStyleLegend(style, theme, result.rows) } : {}),
    ...(style?.kind === "compare" ? { compareTable: style } : {}),
    ...(isAnalysisScopeArea(result) ? { scopeArea: true as const } : {}),
    ...(style?.kind === "proportional" ? { circleOpacityRatio: style.fillOpacity } : {}),
    ...(hasScopeRows(result) ? { scopeRing: { radiusM: scopeRadiusM(result) } } : {}),
    ...(countLegend ? { countLegend } : {}),
    ...(numericLegend ? { numericLegend } : {}),
  };
}

/** A scope-circle row is a supplementary visualization aid, never a counted analysis match. */
function nonScopeRowCount(result: PresentableResult): number {
  return hasScopeRows(result) ? result.rows.filter(row => !isScopeRow(row)).length : result.rows.length;
}

/** Metadata for the whole authorized collection, including effectively hidden items. `theme` picks
 *  which side of a styled result's `palette` the swatch/legend colours come from (default dark). */
export function describeAnalysisResults(results: readonly PresentableResult[], theme: Theme = "dark"): AnalysisResultPresentation[] {
  return results.map(result => {
    const data = collection(result);
    if (data.features.length !== result.rows.length) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    return presentation(result, nonScopeRowCount(result), theme);
  });
}

/** Transient result layers are independent of the permanent layer catalogue. `theme` follows the
 *  basemap (see vizSpec.ts `vizThemeForBasemap`); a basemap switch re-runs this (MainMapConnection's
 *  `style.load` redraw), so palette + null-hatch pattern always match the currently visible basemap. */
export function installAnalysisResults(map: Map, results: readonly PresentableResult[], opacity: number | AnalysisResultOpacity = 0.55, theme: Theme = "dark"): AnalysisResultPresentation[] {
  if (results.length > MAX_RESULTS) throw new Error("TOO_MANY_PRESENTED_RESULTS");
  // Validate every result before mutating Mapbox so a bad later result cannot
  // leave an earlier source partially updated.
  const prepared = results.map(result => {
    const data = collection(result);
    if (data.features.length !== result.rows.length) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    return { result, data };
  });
  const installed = prepared.map(({ result, data }, index) => {
    const resultOpacity = typeof opacity === "number" ? opacity : opacity.byResult[result.resultId] ?? opacity.defaultOpacity;
    cancelReveal(map, index);
    const source = map.getSource(sourceId(index)) as GeoJSONSource | undefined;
    if (source) source.setData(data); else map.addSource(sourceId(index), { type: "geojson", data });
    const polygon = result.geometry.type === "Polygon" || result.geometry.type === "MultiPolygon";
    const line = result.geometry.type === "LineString" || result.geometry.type === "MultiLineString";
    const scopeArea = isAnalysisScopeArea(result);
    const scopeCenter = isAnalysisScopeCenter(result);
    const scopeRingRows = hasScopeRows(result);
    const numericLegend = numericResultLegend(result);
    const style = result.resultStyle;
    const heatmap = style?.kind === "heatmap" && result.geometry.type === "Point" ? style : null;
    const compare = style?.kind === "compare" && result.geometry.type === "Point" ? style : null;
    const proportional = style?.kind === "proportional" && result.geometry.type === "Point" ? style : null;
    const bivariate = style?.kind === "bivariate" ? style : null;
    const styleColor = style && style.kind !== "heatmap" && style.kind !== "compare" && style.kind !== "proportional" ? warehouseStyleColor(style, theme) : null;
    const proportionalColor = proportional ? warehouseProportionalColor(proportional, theme) : null;
    // Choropleth/bivariate null cells render fully transparent in `styleColor` above (see
    // warehouseStyleColor); this sibling layer paints exactly those cells with the theme's hatch
    // tile instead. Both kinds share the same nullStyle/valueProperty contract.
    const fillHatch = polygon && (style?.kind === "choropleth" || style?.kind === "bivariate") && style.nullStyle === "hatch" ? style : null;
    const fillColor: string | ExpressionSpecification = styleColor ?? (numericLegend ? numericFillColor(numericLegend) : COLORS[index]!);
    const outlineColor = styleColor ? "#475569" : numericLegend ? "#075985" : COLORS[index]!;
    const lineColor: string | ExpressionSpecification = styleColor ?? COLORS[index]!;
    const heatmapPalette = heatmap ? (heatmap.palette ? heatmap.palette[theme] : heatmap.colors) : null;
    const circleColor: string | ExpressionSpecification = styleColor ? styleColor : proportionalColor ? proportionalColor : heatmapPalette ? heatmapPalette[heatmapPalette.length - 1]! : scopeCenter ? "#fef3c7" : result.presentation ? ["step", ["get", result.presentation.countField], COUNT_COLORS[0], COUNT_STOPS[0], COUNT_COLORS[1], COUNT_STOPS[1], COUNT_COLORS[2]] as unknown as ExpressionSpecification : COLORS[index]!;
    const circleRadius: ExpressionSpecification = (proportional ? ["get", proportional.sizeRadiusProperty] : scopeCenter ? ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 9, 16, 12] : ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6, 16, 9]) as unknown as ExpressionSpecification;
    const circleStrokeColor = proportional ? VIZ_SPEC.ring[theme] : scopeCenter ? "#0f172a" : "#ffffff";
    const circleStrokeWidth = proportional ? proportional.ringPx : scopeCenter ? 3 : 2;
    const proportionalSizeFilter = proportional ? warehouseProportionalSizeFilter(proportional) : null;
    const proportionalSortKey = proportional ? warehouseProportionalSortKey(proportional) : null;
    // The user's opacity slider composes with the style's own base ratio for polygon fill
    // (scope-area vs. authoritative) and proportional circles (spec M3 fillOpacity), matching the
    // convention already used for polygon fill below.
    const primaryOpacity = polygon ? resultOpacity * (scopeArea ? 0.18 : 0.45) : proportional ? resultOpacity * proportional.fillOpacity : resultOpacity;
    const existing = map.getLayer(layerId(index));
    const reveal = !existing && !prefersReducedMotion();
    const duration = prefersReducedMotion() ? 0 : 380;
    if (existing && existing.type !== (polygon ? "fill" : line ? "line" : heatmap ? "heatmap" : "circle")) map.removeLayer(layerId(index));
    if (!heatmap && map.getLayer(heatPointsLayerId(index))) map.removeLayer(heatPointsLayerId(index));
    if (!compare && map.getLayer(compareLabelLayerId(index))) map.removeLayer(compareLabelLayerId(index));
    if (!fillHatch && map.getLayer(nullHatchLayerId(index))) map.removeLayer(nullHatchLayerId(index));
    if (!proportional && map.getLayer(proportionalLabelLayerId(index))) map.removeLayer(proportionalLabelLayerId(index));
    if (!bivariate) {
      if (map.getLayer(bivariateSizeLayerId(index))) map.removeLayer(bivariateSizeLayerId(index));
      if (map.getSource(bivariateSizeSourceId(index))) map.removeSource(bivariateSizeSourceId(index));
    }
    if (polygon) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "fill", source: sourceId(index), ...(scopeRingRows ? { filter: SCOPE_ROLE_EXCLUDE_FILTER } : {}), paint: {
        "fill-color": fillColor, "fill-opacity": reveal ? 0 : primaryOpacity, "fill-opacity-transition": { duration }, "fill-outline-color": outlineColor,
      } });
    } else if (line) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "line", source: sourceId(index), paint: { "line-color": lineColor, "line-width": 3, "line-opacity": reveal ? 0 : resultOpacity, "line-opacity-transition": { duration } } });
    } else if (heatmap) {
      const filter = warehouseHeatmapFilter(heatmap);
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "heatmap", source: sourceId(index), ...(filter ? { filter } : {}), paint: warehouseHeatmapPaint(heatmap, reveal ? 0 : resultOpacity, theme) as never });
      if (!map.getLayer(heatPointsLayerId(index))) map.addLayer({ id: heatPointsLayerId(index), type: "circle", source: sourceId(index), minzoom: HEAT_POINTS_MINZOOM, paint: {
        "circle-color": circleColor, "circle-radius": 4, "circle-opacity": resultOpacity, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": resultOpacity,
      } });
    } else if (!map.getLayer(layerId(index))) map.addLayer({
      id: layerId(index), type: "circle", source: sourceId(index),
      ...(proportionalSizeFilter ? { filter: proportionalSizeFilter } : {}),
      ...(proportionalSortKey ? { layout: { "circle-sort-key": proportionalSortKey } } : {}),
      paint: {
        "circle-color": circleColor, "circle-radius": circleRadius,
        "circle-opacity": reveal ? 0 : primaryOpacity, "circle-opacity-transition": { duration }, "circle-stroke-opacity": reveal ? 0 : resultOpacity, "circle-stroke-opacity-transition": { duration }, "circle-stroke-color": circleStrokeColor, "circle-stroke-width": circleStrokeWidth,
      },
    });
    if (polygon) {
      map.setPaintProperty(layerId(index), "fill-color", fillColor);
      map.setPaintProperty(layerId(index), "fill-outline-color", outlineColor);
      map.setFilter(layerId(index), scopeRingRows ? SCOPE_ROLE_EXCLUDE_FILTER : null);
    } else if (line) {
      map.setPaintProperty(layerId(index), "line-color", lineColor);
      map.setPaintProperty(layerId(index), "line-width", 3);
    } else if (heatmap) {
      const paint = warehouseHeatmapPaint(heatmap, resultOpacity, theme);
      for (const key of ["heatmap-weight", "heatmap-intensity", "heatmap-radius", "heatmap-color"] as const) map.setPaintProperty(layerId(index), key, paint[key] as never);
      map.setFilter(layerId(index), warehouseHeatmapFilter(heatmap));
    } else {
      map.setPaintProperty(layerId(index), "circle-color", circleColor);
      map.setPaintProperty(layerId(index), "circle-radius", circleRadius);
      map.setPaintProperty(layerId(index), "circle-stroke-color", circleStrokeColor);
      map.setPaintProperty(layerId(index), "circle-stroke-width", circleStrokeWidth);
      map.setFilter(layerId(index), proportionalSizeFilter);
      // Only touches `setLayoutProperty` for a proportional result — most stub/real callers of a
      // plain circle result never need it, and a slot switching *out* of proportional into another
      // circle-drawn kind (compare/plain point) is repainted on colour/radius anyway.
      if (proportionalSortKey && map.getLayer(layerId(index))) map.setLayoutProperty(layerId(index), "circle-sort-key", proportionalSortKey);
    }
    if (fillHatch) {
      // A style/basemap switch (map.setStyle) clears every addImage'd image; re-add it (guarded) on
      // every install rather than once, since this runs again right after that switch settles.
      // Decorative/secondary layer, like heatPointsLayerId above: opacity follows resultOpacity
      // directly rather than the primary layer's reveal fade-in.
      const patternId = ensureNullHatchImage(map, theme);
      const hatchFilter = warehouseFillNullFilter(fillHatch);
      if (!map.getLayer(nullHatchLayerId(index))) map.addLayer({ id: nullHatchLayerId(index), type: "fill", source: sourceId(index), filter: hatchFilter, paint: { "fill-pattern": patternId, "fill-opacity": resultOpacity } });
      else {
        map.setPaintProperty(nullHatchLayerId(index), "fill-pattern", patternId);
        map.setPaintProperty(nullHatchLayerId(index), "fill-opacity", resultOpacity);
        map.setFilter(nullHatchLayerId(index), hatchFilter);
      }
    }
    if (proportional) {
      const labelFilter = warehouseProportionalLabelFilter(proportional);
      const textField = ["coalesce", ...(proportional.labelField ? [["get", proportional.labelField]] : []), ...TITLE_KEYS.map(key => ["get", key])] as unknown as ExpressionSpecification;
      const textColor = theme === "dark" ? "#ffffff" : "#1a1a1a";
      if (!map.getLayer(proportionalLabelLayerId(index))) map.addLayer({
        id: proportionalLabelLayerId(index), type: "symbol", source: sourceId(index), filter: labelFilter,
        layout: { "text-field": textField, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-size": 11, "text-allow-overlap": false, "symbol-sort-key": ["get", proportional.labelRankProperty], "text-offset": [0, 1.2], "text-anchor": "top" },
        paint: { "text-color": textColor, "text-halo-color": VIZ_SPEC.ring[theme], "text-halo-width": 1.8, "text-opacity": resultOpacity },
      });
      else {
        map.setFilter(proportionalLabelLayerId(index), labelFilter);
        map.setPaintProperty(proportionalLabelLayerId(index), "text-color", textColor);
        map.setPaintProperty(proportionalLabelLayerId(index), "text-halo-color", VIZ_SPEC.ring[theme]);
        map.setPaintProperty(proportionalLabelLayerId(index), "text-opacity", resultOpacity);
      }
    }
    if (bivariate) {
      const sizeData = bivariateSizeCollection(result, bivariate);
      const sizeSource = map.getSource(bivariateSizeSourceId(index)) as GeoJSONSource | undefined;
      if (sizeSource) sizeSource.setData(sizeData); else map.addSource(bivariateSizeSourceId(index), { type: "geojson", data: sizeData });
      const ringColor = BIVARIATE_SIZE_RING[theme];
      if (!map.getLayer(bivariateSizeLayerId(index))) map.addLayer({ id: bivariateSizeLayerId(index), type: "circle", source: bivariateSizeSourceId(index), paint: {
        "circle-color": "rgba(0,0,0,0)", "circle-radius": ["get", bivariate.sizeRadiusProperty], "circle-stroke-color": ringColor, "circle-stroke-width": 1.4, "circle-stroke-opacity": resultOpacity,
      } as never });
      else {
        map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-color", ringColor);
        map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-opacity", resultOpacity);
      }
    }
    if (compare) {
      if (!map.getLayer(compareLabelLayerId(index))) map.addLayer({ id: compareLabelLayerId(index), type: "symbol", source: sourceId(index), layout: {
        "text-field": ["get", compare.pointProperty], "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true,
      }, paint: { "text-color": "#ffffff", "text-halo-color": "#0f172a", "text-halo-width": 1.4, "text-opacity": resultOpacity } });
      else map.setPaintProperty(compareLabelLayerId(index), "text-opacity", resultOpacity);
    }
    if (scopeRingRows) {
      if (!map.getLayer(scopeRingLayerId(index))) map.addLayer({ id: scopeRingLayerId(index), type: "line", source: sourceId(index), filter: SCOPE_ROLE_FILTER, paint: {
        "line-color": SCOPE_RING_COLOR, "line-width": 2, "line-dasharray": [2, 2], "line-opacity": reveal ? 0 : resultOpacity, "line-opacity-transition": { duration },
      } });
      else { map.setPaintProperty(scopeRingLayerId(index), "line-color", SCOPE_RING_COLOR); map.setFilter(scopeRingLayerId(index), SCOPE_ROLE_FILTER); }
    } else if (map.getLayer(scopeRingLayerId(index))) map.removeLayer(scopeRingLayerId(index));
    const applyOpacity = () => {
      cancelReveal(map, index);
      if (!map.getLayer(layerId(index))) return;
      map.setPaintProperty(layerId(index), polygon ? "fill-opacity" : line ? "line-opacity" : heatmap ? "heatmap-opacity" : "circle-opacity", polygon || proportional ? primaryOpacity : resultOpacity);
      if (!polygon && !line && !heatmap) map.setPaintProperty(layerId(index), "circle-stroke-opacity", resultOpacity);
      if (compare && map.getLayer(compareLabelLayerId(index))) map.setPaintProperty(compareLabelLayerId(index), "text-opacity", resultOpacity);
      if (proportional && map.getLayer(proportionalLabelLayerId(index))) map.setPaintProperty(proportionalLabelLayerId(index), "text-opacity", resultOpacity);
      if (bivariate && map.getLayer(bivariateSizeLayerId(index))) map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-opacity", resultOpacity);
      if (scopeRingRows && map.getLayer(scopeRingLayerId(index))) map.setPaintProperty(scopeRingLayerId(index), "line-opacity", resultOpacity);
    };
    if (reveal) {
      if (!reveals.has(map)) reveals.set(map, new globalThis.Map());
      reveals.get(map)!.set(index, applyOpacity);
      map.on("render", applyOpacity);
    } else applyOpacity();
    return presentation(result, nonScopeRowCount(result), theme, index);
  });
  // Keep every scope ring under the first Point-type result's layer, regardless of each
  // result's index in this batch (moveLayer works on already-existing layers, so it is not
  // sensitive to which order addLayer ran in above).
  const firstPointIndex = prepared.findIndex(({ result }) => result.geometry.type === "Point");
  if (firstPointIndex >= 0 && map.getLayer(layerId(firstPointIndex))) {
    prepared.forEach(({ result }, index) => {
      if (hasScopeRows(result) && map.getLayer(scopeRingLayerId(index))) map.moveLayer(scopeRingLayerId(index), layerId(firstPointIndex));
    });
  }
  for (let index = results.length; index < MAX_RESULTS; index += 1) removeIndex(map, index);
  return installed;
}

export function removeAnalysisResults(map: Map): void { for (let index = 0; index < MAX_RESULTS; index += 1) removeIndex(map, index); }

function removeIndex(map: Map, index: number): void {
  cancelReveal(map, index);
  if (map.getLayer(heatPointsLayerId(index))) map.removeLayer(heatPointsLayerId(index));
  if (map.getLayer(compareLabelLayerId(index))) map.removeLayer(compareLabelLayerId(index));
  if (map.getLayer(scopeRingLayerId(index))) map.removeLayer(scopeRingLayerId(index));
  if (map.getLayer(nullHatchLayerId(index))) map.removeLayer(nullHatchLayerId(index));
  if (map.getLayer(proportionalLabelLayerId(index))) map.removeLayer(proportionalLabelLayerId(index));
  if (map.getLayer(bivariateSizeLayerId(index))) map.removeLayer(bivariateSizeLayerId(index));
  if (map.getSource(bivariateSizeSourceId(index))) map.removeSource(bivariateSizeSourceId(index));
  if (map.getLayer(layerId(index))) map.removeLayer(layerId(index));
  if (map.getSource(sourceId(index))) map.removeSource(sourceId(index));
}

export function analysisResultSourceIds(count: number): string[] { return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => sourceId(index)); }

export function analysisResultLayerIds(count: number): string[] { return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => layerId(index)); }
/** Layers that can be clicked for popup/select: result layers plus close-zoom points under a heatmap. */
export function analysisResultInteractiveLayerIds(map: Map, count: number): string[] {
  return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => [layerId(index), heatPointsLayerId(index)]).flat().filter(id => map.getLayer(id) && map.getLayer(id)!.type !== "heatmap");
}
export function readAnalysisResultPresentation(map: Map, results: readonly AnalysisResultPresentation[], collection: ResultCollection | null = null): AnalysisResultReadback {
  const sourceIds = analysisResultSourceIds(results.length);
  const layerIds = analysisResultLayerIds(results.length);
  const sourcesReady = sourceIds.every(id => Boolean(map.getSource(id)) && map.isSourceLoaded(id));
  const layersReady = layerIds.every(id => Boolean(map.getLayer(id)));
  const cleared = results.length > 0 || (
    analysisResultSourceIds(MAX_RESULTS).every(id => !map.getSource(id)) &&
    analysisResultLayerIds(MAX_RESULTS).every(id => !map.getLayer(id))
  );
  return {
    mode: results.length ? "analysis_result" : "none",
    collection,
    renderedResultIds: results.map(result => result.resultId),
    resultIds: results.map(result => result.resultId),
    datasets: results.map(result => result.datasetId),
    featureCount: results.reduce((sum, result) => sum + result.featureCount, 0),
    sourceIds,
    layerIds,
    sourcesReady,
    layersReady,
    ready: sourcesReady && layersReady && cleared,
  };
}
export function setAnalysisOpacity(map: Map, results: readonly AnalysisResultPresentation[], resultId: string, opacity: number): void {
  for (const [index, result] of results.entries()) {
    if (result.resultId !== resultId) continue;
    const id = layerId(index);
    const layer = map.getLayer(id);
    if (layer) {
      cancelReveal(map, index);
      const composedOpacity = layer.type === "fill" ? opacity * (result.scopeArea ? 0.18 : 0.45) : layer.type === "circle" && result.circleOpacityRatio !== undefined ? opacity * result.circleOpacityRatio : opacity;
      map.setPaintProperty(id, layer.type === "fill" ? "fill-opacity" : layer.type === "line" ? "line-opacity" : layer.type === "heatmap" ? "heatmap-opacity" : "circle-opacity", composedOpacity);
      if (layer.type === "circle") map.setPaintProperty(id, "circle-stroke-opacity", opacity);
    }
    if (map.getLayer(heatPointsLayerId(index))) {
      map.setPaintProperty(heatPointsLayerId(index), "circle-opacity", opacity);
      map.setPaintProperty(heatPointsLayerId(index), "circle-stroke-opacity", opacity);
    }
    if (map.getLayer(compareLabelLayerId(index))) map.setPaintProperty(compareLabelLayerId(index), "text-opacity", opacity);
    if (map.getLayer(nullHatchLayerId(index))) map.setPaintProperty(nullHatchLayerId(index), "fill-opacity", opacity);
    if (map.getLayer(proportionalLabelLayerId(index))) map.setPaintProperty(proportionalLabelLayerId(index), "text-opacity", opacity);
    if (map.getLayer(bivariateSizeLayerId(index))) map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-opacity", opacity);
    if (map.getLayer(scopeRingLayerId(index))) map.setPaintProperty(scopeRingLayerId(index), "line-opacity", opacity);
  }
}
