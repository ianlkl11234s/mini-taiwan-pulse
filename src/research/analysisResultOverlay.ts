import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map } from "mapbox-gl";
import { RESULT_COLLECTION_LIMITS, type PresentableResult } from "./researchAnalysisSession";
import { prefersReducedMotion } from "./researchMotion";
import type { ResultCollection } from "./bridgeClient";
import type { AnalysisStackKind } from "./analysisResultStack";
import { VIZ_SPEC, bivariateSizeStrokeFor, type Theme } from "./vizSpec";
import { ensureNullHatchImage } from "./vizNullPattern";
import { SELECTION_RING } from "../styles/designTokens";
import { TITLE_KEYS, researchResultPopupTitle } from "./researchResultPopup";
import { classifyVizNumberKind, type VizNumberKind } from "./vizFormat";
import type { RankBarItem } from "./charts/RankBars";
import {
  classifyStepColor, isTimedChoropleth, warehouseChoroplethColorAtPeriod, warehouseExtrusionHeightFilter, warehouseFillNullFilter, warehouseFillNullFilterAtPeriod,
  warehouseFlowWidthFilter, warehouseHeatmapFilter, warehouseHeatmapPaint,
  warehouseIsochroneSortKey, warehouseProportionalColor, warehouseProportionalLabelFilter,
  warehouseProportionalSizeFilter, warehouseProportionalSortKey, warehouseRankBarStyle, warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend,
  type WarehouseRankBarStyle, type WarehouseResultStyle, type WarehouseStyleLegend,
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
/** Exported (T2 A2) so MainMapConnection's playback controls can `setPaintProperty`/`setFilter` an
 *  already-installed choropleth's fill/hatch layers by the same index installAnalysisResults used —
 *  its returned array order *is* this slot index (see installAnalysisResults). */
export const layerId = (index: number) => `research-analysis-result-points-${index}`;
/** Heatmaps are not pickable, so a styled heatmap keeps a close-zoom circle layer for popup/select. */
const heatPointsLayerId = (index: number) => `research-analysis-result-heat-points-${index}`;
/** Numbered marker labels (1..N) for a compare-styled point result; decorative only, not pickable. */
const compareLabelLayerId = (index: number) => `research-analysis-result-compare-label-${index}`;
/** Choropleth/bivariate `nullStyle: "hatch"` overlay: a transparent fill-pattern layer drawn only
 *  over the features the main fill layer leaves transparent (missing `_style_value`). Not
 *  independently pickable — the main fill layer already covers the same features for click/popup. */
export const nullHatchLayerId = (index: number) => `research-analysis-result-null-hatch-${index}`;
/** Proportional-symbol top-N name labels; decorative only, not pickable (like compareLabelLayerId). */
const proportionalLabelLayerId = (index: number) => `research-analysis-result-proportional-label-${index}`;
/** Bivariate V3's y-size bubbles need their own point source: the primary source's geometry is
 *  often the x-fill's polygon, not a good bubble position, so each row's precomputed `_size_anchor`
 *  is turned into a sibling point feature (bivariateSizeCollection). Empty hollow circles, not
 *  independently pickable — the primary fill layer already covers the same features for popup. */
const bivariateSizeSourceId = (index: number) => `research-analysis-result-bivariate-size-${index}`;
const bivariateSizeLayerId = (index: number) => `research-analysis-result-bivariate-size-circle-${index}`;
/** M6: the basemap-coloured gap between grid cells (spec "格間縫用 line 圖層"), traced over the
 *  same cell polygons — Mapbox draws a "line" layer's boundary directly from Polygon geometry. */
const gridGapLayerId = (index: number) => `research-analysis-result-grid-gap-${index}`;
/** M2 I1: the isochrone band's own 1.3px solid outline (spec "同色 1.3px 實線邊") — a `fill` layer
 *  has no configurable outline width, so this is a sibling `line` layer instead. */
const isochroneOutlineLayerId = (index: number) => `research-analysis-result-isochrone-outline-${index}`;
/** L2 W1: the flow line's own ring-coloured outline, drawn *beneath* the classified line
 *  (spec "底下一層 ring[theme] 顏色、寬度 = 線寬 + 3"). */
const flowOutlineLayerId = (index: number) => `research-analysis-result-flow-outline-${index}`;
/** L2 F3: the slow-moving "flowing dots" overlay (a cycled `line-dasharray`), only when the server
 *  allowed it (`style.animate`) and the viewer has not asked for reduced motion. */
const flowDotLayerId = (index: number) => `research-analysis-result-flow-dot-${index}`;
/** L2: one small ring-stroked dot per flow at its destination coordinate; own point source since the
 *  primary source's geometry is the (possibly arced) line, not a drawable point. */
const flowEndpointSourceId = (index: number) => `research-analysis-result-flow-endpoint-${index}`;
const flowEndpointLayerId = (index: number) => `research-analysis-result-flow-endpoint-circle-${index}`;
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
/** Numeric per-row id promoted to the Mapbox feature id (`promoteId`), so feature-state (hover /
 *  selected) can address a row: the GeoJSON `id` strings above are not feature-state keys. The
 *  bivariate size source reuses the same row index, so one `_fid` addresses both sources. */
export const FEATURE_ID_PROPERTY = "_fid";
/** Polygon hover/selection outline (spec I1/I2: 2px 主色描邊), sharing the result's own source. */
const edgeLayerId = (index: number) => `research-analysis-result-edge-${index}`;
/** I1 hover / I2 selection emphasis: 2px stroke in the selection-ring accent (UI R2 主色). */
export const ANALYSIS_EMPHASIS_WIDTH_PX = 2;
/** S1: an area result that lost the single fill slot keeps only this neutral edge. */
export const ANALYSIS_OUTLINE_ONLY_WIDTH_PX = 1.4;
const TRANSPARENT = "rgba(0,0,0,0)";
const HOVERED = ["boolean", ["feature-state", "hover"], false];
const SELECTED = ["boolean", ["feature-state", "selected"], false];
const EMPHASIZED = ["any", HOVERED, SELECTED] as unknown as ExpressionSpecification;
/** I2 選取淡化：other rows of a result holding the docked-panel selection keep 35% of their opacity. */
export const ANALYSIS_DIM_RATIO = 0.35;
const hovered = new WeakMap<Map, AnalysisFeatureTarget>();
/** Result slots currently dimmed around a selection, and the rows marked `selected` per map. */
const dimmed = new WeakMap<Map, Set<number>>();
const selectedTargets = new WeakMap<Map, AnalysisFeatureTarget[]>();
const SOURCE_INDEX_PATTERN = /^research-analysis-result-(\d+)$/;
/** M7: extrusion's own fixed opacity ratio (spec "不透明度 0.85"), composed with the user's opacity
 *  slider the same way a polygon's fill / a proportional circle's own ratio already compose. */
const EXTRUSION_FILL_OPACITY = 0.85;
/** L2: how far the arc's control point is pushed off the straight midpoint, as a fraction of the
 *  origin -> destination vector's own length. */
const FLOW_ARC_CURVATURE = 0.15;
/** L2 F3: the official Mapbox "animate a line" dasharray cycle — a fixed sequence of dash/gap
 *  lengths whose apparent motion comes purely from stepping through it, not from any offset math. */
const FLOW_DOT_DASH_FRAMES: readonly (readonly number[])[] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];
const FLOW_DOT_FRAME_MS = 100; // ~10fps (spec "低頻循環")
const flowTimers = new WeakMap<Map, globalThis.Map<number, ReturnType<typeof setInterval>>>();

/** L2: bends a straight 2-point line into a quadratic-bezier arc, always to the same side of travel
 *  (rotate the direction vector 90° — reversing origin/destination mirrors the arc, but the rule
 *  itself never flips). Pure and independent of Mapbox so it is directly unit-testable. */
export function flowArcCoordinates(origin: readonly [number, number], destination: readonly [number, number], segments = 24): [number, number][] {
  const [x0, y0] = origin;
  const [x1, y1] = destination;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const controlX = (x0 + x1) / 2 - dy * FLOW_ARC_CURVATURE;
  const controlY = (y0 + y1) / 2 + dx * FLOW_ARC_CURVATURE;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const oneMinusT = 1 - t;
    return [
      oneMinusT * oneMinusT * x0 + 2 * oneMinusT * t * controlX + t * t * x1,
      oneMinusT * oneMinusT * y0 + 2 * oneMinusT * t * controlY + t * t * y1,
    ] as [number, number];
  });
}

function stopFlowAnimation(map: Map, index: number): void {
  const timer = flowTimers.get(map)?.get(index);
  if (timer !== undefined) { clearInterval(timer); flowTimers.get(map)!.delete(index); }
}

/** Starts (idempotently — always stops any prior timer for this slot first) the F3 dash-cycle on
 *  `layerId`; self-cancels once that layer is gone (slot reused by a non-flow result, or removed). */
function startFlowAnimation(map: Map, index: number, dotLayerId: string): void {
  stopFlowAnimation(map, index);
  let frame = 0;
  const timer = setInterval(() => {
    if (!map.getLayer(dotLayerId)) { stopFlowAnimation(map, index); return; }
    frame = (frame + 1) % FLOW_DOT_DASH_FRAMES.length;
    map.setPaintProperty(dotLayerId, "line-dasharray", FLOW_DOT_DASH_FRAMES[frame] as number[]);
  }, FLOW_DOT_FRAME_MS);
  if (!flowTimers.has(map)) flowTimers.set(map, new globalThis.Map());
  flowTimers.get(map)!.set(index, timer);
}

/** One rendered row: its result source plus the promoted numeric feature id. */
export type AnalysisFeatureTarget = { source: string; id: number };

function emphasisAccent(theme: Theme): string { return SELECTION_RING[theme]; }

/** Plain opacity, or — while this slot holds a selection — full for selected rows, ×0.35 for the rest.
 *  Every opacity writer (reveal, slider, selection) goes through here so none can undo the dim. */
function dimmable(map: Map, index: number, base: number): number | ExpressionSpecification {
  return dimmed.get(map)?.has(index) ? ["case", SELECTED, base, base * ANALYSIS_DIM_RATIO] as unknown as ExpressionSpecification : base;
}

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
  /** M2: an isochrone's own base opacity ratio (spec `style.fillOpacity`), replacing the plain
   *  polygon's scopeArea/default ratio the same way `circleOpacityRatio` overrides a circle's. */
  fillOpacityRatio?: number;
  /** L2 F3: the flowing-dot layer's own base opacity ratio (spec `style.dotOpacity`), composed with
   *  the user's opacity slider the same way `circleOpacityRatio` composes with a circle's. */
  flowDotOpacityRatio?: number;
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
  /** The raw style this result was installed with (any map-eligible kind — never "series", which is
   *  never map-eligible). T2 A2's playback controls read `periods`/`seriesProperty`/`breaks` off this
   *  directly instead of re-fetching via `presentable()` on every tick. */
  resultStyle?: Exclude<WarehouseResultStyle, { kind: "series" }>;
  /** P1 rank-bar data (spec docs/features/viz-library/DECISIONS.md §6) for a choropleth/bivariate/
   *  grid/extrusion-styled result: each row's own classified value and its exact map fill colour.
   *  Absent when the style is not one of those four kinds, or no row has a usable numeric value. */
  rankBars?: { title: string; unit: string | null; valueKind: VizNumberKind; items: RankBarItem[] };
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
      return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: { ...propertiesFor(row, result), [FEATURE_ID_PROPERTY]: rowIndex }, geometry: geometry as Polygon | MultiPolygon }];
    }
    if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
      return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: { ...propertiesFor(row, result), [FEATURE_ID_PROPERTY]: rowIndex }, geometry: geometry as LineString | MultiLineString }];
    }
    if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return [];
    const [lng, lat] = geometry.coordinates;
    if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) return [];
    return [{ type: "Feature", id: `${result.resultId}:${rowIndex}`, properties: { ...propertiesFor(row, result), [FEATURE_ID_PROPERTY]: rowIndex }, geometry: { type: "Point", coordinates: [lng, lat] } }];
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
    return [{ type: "Feature", id: `${result.resultId}:size:${rowIndex}`, properties: { ...propertiesFor(row, result), [FEATURE_ID_PROPERTY]: rowIndex }, geometry: { type: "Point", coordinates: [lng, lat] } }];
  });
  return { type: "FeatureCollection", features };
}

/** L2: replaces every straight 2-point LineString in `data` with its bent arc (flowArcCoordinates);
 *  every other geometry (or a line with any other vertex count) passes through unchanged. */
function flowArcCollection<T extends FeatureCollection<Point | LineString | MultiLineString | Polygon | MultiPolygon>>(data: T): T {
  return {
    ...data,
    features: data.features.map(feature => {
      if (feature.geometry.type !== "LineString" || feature.geometry.coordinates.length !== 2) return feature;
      const [origin, destination] = feature.geometry.coordinates as [[number, number], [number, number]];
      return { ...feature, geometry: { type: "LineString", coordinates: flowArcCoordinates(origin, destination) } };
    }),
  };
}

/** One Point feature per drawable flow row (`_flow_width` numeric), at its destination coordinate
 *  (the raw line's last vertex, taken before arcing) — the small ring-stroked endpoint dot (spec L2). */
function flowEndpointCollection(result: PresentableResult, style: Extract<WarehouseResultStyle, { kind: "flow" }>): FeatureCollection<Point> {
  const features: Feature<Point>[] = result.rows.flatMap<Feature<Point>>((row, rowIndex) => {
    if (typeof row[style.widthProperty] !== "number") return [];
    const geometry = row.geometry as { type?: unknown; coordinates?: unknown } | undefined;
    if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return [];
    const destination = geometry.coordinates[1];
    if (!Array.isArray(destination) || destination.length !== 2) return [];
    const [lng, lat] = destination;
    if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) return [];
    return [{ type: "Feature", id: `${result.resultId}:endpoint:${rowIndex}`, properties: { ...propertiesFor(row, result), [FEATURE_ID_PROPERTY]: rowIndex }, geometry: { type: "Point", coordinates: [lng, lat] } }];
  });
  return { type: "FeatureCollection", features };
}

/** T2 A2: a timed choropleth's `_style_series` (mcp `pulse_wh_present`) is padded/truncated to
 *  exactly `style.periods.length`, coercing anything non-numeric to null. This guarantees every
 *  drawn feature's array is the length the period-indexed paint expression
 *  (`warehouseChoroplethColorAtPeriod`) expects, so an in-range `["at", i, ...]` never throws at
 *  Mapbox eval time — a short/missing/malformed array becomes "every period null" rather than a
 *  runtime error. */
function normalizedSeriesValue(row: Record<string, unknown>, result: PresentableResult): (number | null)[] | null {
  const style = result.resultStyle;
  if (!style || style.kind !== "choropleth" || !isTimedChoropleth(style)) return null;
  const raw = row[style.seriesProperty];
  const source = Array.isArray(raw) ? raw : [];
  return Array.from({ length: style.periods.length }, (_, index) => {
    const value = source[index];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
}

function propertiesFor(row: Record<string, unknown>, result: PresentableResult): Record<string, string | number | boolean | null | (number | null)[]> {
  const properties = Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== "geometry" && (value === null || ["string", "number", "boolean"].includes(typeof value))));
  const valueUnit = result.units?.value;
  const differenceUnit = result.units?.absoluteDifference;
  const normalizedUnit = result.units?.normalizedValue;
  const sourceAreaUnit = result.units?.area_ha;
  const magnitudeUnit = result.units?.magnitude;
  const depthUnit = result.units?.depth_km;
  const styleFact = result.resultStyle ? warehouseStyleFact(result.resultStyle, row) : null;
  const seriesValue = normalizedSeriesValue(row, result);
  return {
    ...properties,
    ...(seriesValue ? { _style_series: seriesValue } : {}),
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
function styleSwatchColor(style: Exclude<WarehouseResultStyle, { kind: "compare" | "series" }>, theme: Theme): string {
  const colors = "colors" in style ? (style.palette ? style.palette[theme] : style.colors) : style.palette[theme];
  return colors[colors.length - 1]!;
}

/** P1 rank-bar items for a choropleth/bivariate/grid/extrusion-styled result: each row's own
 *  classified value, coloured exactly like the map's own fill (spec: "長條色＝該區地圖級距色"). A row
 *  with no usable numeric value is skipped — RankBars only ranks values it actually has, never a
 *  fabricated 0. Returns undefined when nothing is rankable (e.g. every row is null). */
function warehouseRankBars(style: WarehouseRankBarStyle, rows: readonly Record<string, unknown>[], theme: Theme): AnalysisResultPresentation["rankBars"] {
  const spec = warehouseRankBarStyle(style, theme);
  const items: RankBarItem[] = [];
  rows.forEach((row, rowIndex) => {
    const raw = row[style.valueProperty];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return;
    items.push({ id: String(rowIndex), label: researchResultPopupTitle(row), value: raw, color: classifyStepColor(raw, spec.breaks, spec.colors) });
  });
  if (!items.length) return undefined;
  // Stage-A choropleth may omit its own valueKind; fall back to the conservative unit/shape guess
  // used everywhere else in this style layer (warehouseStyleFact's `show()`).
  // items[0]'s value is always a number by construction (only pushed after the typeof/Number.isFinite
  // check above); the `?? 0` is purely to satisfy RankBarItem's wider (nullable) value type.
  const valueKind = spec.valueKind ?? classifyVizNumberKind(items[0]!.value ?? 0, spec.unit);
  return { title: spec.title, unit: spec.unit, valueKind, items };
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
  const styleSwatch = style && style.kind !== "compare" && style.kind !== "series" ? styleSwatchColor(style, theme) : undefined;
  const rankBarKind = style && (style.kind === "choropleth" || style.kind === "bivariate" || style.kind === "grid" || style.kind === "extrusion");
  const rankBars = rankBarKind ? warehouseRankBars(style as WarehouseRankBarStyle, result.rows, theme) : undefined;
  return {
    resultId: result.resultId, datasetId: result.datasetId, displayLabel: result.displayLabel ?? result.datasetId,
    geometryType: result.geometry.type, featureCount, ...(index === undefined || countLegend ? {} : { color: styleSwatch ?? (numericLegend ? numericLegend.entries[0]!.color : isAnalysisScopeCenter(result) ? "#fef3c7" : COLORS[index]!) }),
    ...(style && style.kind !== "compare" && style.kind !== "series" ? { styleLegend: warehouseStyleLegend(style, theme, result.rows) } : {}),
    ...(style?.kind === "compare" ? { compareTable: style } : {}),
    // T2 A2: exposed so a caller (MainMapConnection's playback controls) can find a timed
    // choropleth's periods/breaks/seriesProperty without re-fetching via presentable(). "series"
    // never reaches here (never map-eligible — see researchAnalysisSession.ts mapEligible).
    ...(style && style.kind !== "series" ? { resultStyle: style } : {}),
    ...(rankBars ? { rankBars } : {}),
    ...(isAnalysisScopeArea(result) ? { scopeArea: true as const } : {}),
    ...(style?.kind === "proportional" ? { circleOpacityRatio: style.fillOpacity } : {}),
    ...(style?.kind === "isochrone" ? { fillOpacityRatio: style.fillOpacity } : {}),
    ...(style?.kind === "flow" ? { flowDotOpacityRatio: style.dotOpacity } : {}),
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
export function installAnalysisResults(map: Map, results: readonly PresentableResult[], opacity: number | AnalysisResultOpacity = 0.55, theme: Theme = "dark", options: AnalysisInstallOptions = {}): AnalysisResultPresentation[] {
  const outlineOnlyIds = new Set(options.outlineOnly ?? []);
  if (results.length > MAX_RESULTS) throw new Error("TOO_MANY_PRESENTED_RESULTS");
  // Validate every result before mutating Mapbox so a bad later result cannot
  // leave an earlier source partially updated.
  const prepared = results.map(result => {
    const data = collection(result);
    if (data.features.length !== result.rows.length) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    return { result, data };
  });
  // Rows are replaced (or the style was rebuilt): a previously hovered row id no longer means
  // the same feature, so drop it rather than carry a stale highlight into the new data.
  clearAnalysisHover(map);
  // Selection is likewise re-applied by the caller (setAnalysisSelection) after an install.
  // Mapbox keeps feature-state across GeoJSONSource#setData, so a reused slot must be un-selected
  // explicitly or the new result's row with the same _fid would inherit the accent outline.
  for (const target of selectedTargets.get(map) ?? []) setState(map, target, { selected: false });
  dimmed.delete(map); selectedTargets.delete(map);
  const accent = emphasisAccent(theme);
  const installed = prepared.map(({ result, data }, index) => {
    const resultOpacity = typeof opacity === "number" ? opacity : opacity.byResult[result.resultId] ?? opacity.defaultOpacity;
    cancelReveal(map, index);
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
    const grid = style?.kind === "grid" && polygon ? style : null;
    const extrusion = style?.kind === "extrusion" && polygon ? style : null;
    const isochrone = style?.kind === "isochrone" && polygon ? style : null;
    const flow = style?.kind === "flow" && line ? style : null;
    // L2: the source carries the bent arc, not the server's straight 2-point line — every reader
    // (hover, popup, selection) then addresses the same drawn geometry.
    const renderData = flow ? flowArcCollection(data) : data;
    const source = map.getSource(sourceId(index)) as GeoJSONSource | undefined;
    if (source) source.setData(renderData); else map.addSource(sourceId(index), { type: "geojson", data: renderData, promoteId: FEATURE_ID_PROPERTY });
    const styleColor = style && style.kind !== "heatmap" && style.kind !== "compare" && style.kind !== "proportional" && style.kind !== "series" ? warehouseStyleColor(style, theme) : null;
    const proportionalColor = proportional ? warehouseProportionalColor(proportional, theme) : null;
    // Choropleth/bivariate null cells render fully transparent in `styleColor` above (see
    // warehouseStyleColor); this sibling layer paints exactly those cells with the theme's hatch
    // tile instead. Both kinds share the same nullStyle/valueProperty contract.
    // S1: a second/third visible area result gives up its fill and draws only a 1.4px neutral
    // edge. The fill layer stays (transparent) as the click/hover pick surface.
    const outlineOnly = polygon && outlineOnlyIds.has(result.resultId);
    const fillHatch = polygon && !outlineOnly && (style?.kind === "choropleth" || style?.kind === "bivariate" || style?.kind === "grid" || style?.kind === "extrusion") && style.nullStyle === "hatch" ? style : null;
    const fillColor: string | ExpressionSpecification = outlineOnly ? TRANSPARENT : styleColor ?? (numericLegend ? numericFillColor(numericLegend) : COLORS[index]!);
    // M2 I1: isochrone's outline is a dedicated 1.3px line layer (isochroneOutlineLayerId), not the
    // fill layer's own (fixed-width) fill-outline-color — leave that one transparent to avoid a
    // doubled edge.
    const outlineColor = outlineOnly ? TRANSPARENT : isochrone ? TRANSPARENT : styleColor ? "#475569" : numericLegend ? "#075985" : COLORS[index]!;
    const lineColor: string | ExpressionSpecification = styleColor ?? COLORS[index]!;
    const heatmapPalette = heatmap ? (heatmap.palette ? heatmap.palette[theme] : heatmap.colors) : null;
    const circleColor: string | ExpressionSpecification = styleColor ? styleColor : proportionalColor ? proportionalColor : heatmapPalette ? heatmapPalette[heatmapPalette.length - 1]! : scopeCenter ? "#fef3c7" : result.presentation ? ["step", ["get", result.presentation.countField], COUNT_COLORS[0], COUNT_STOPS[0], COUNT_COLORS[1], COUNT_STOPS[1], COUNT_COLORS[2]] as unknown as ExpressionSpecification : COLORS[index]!;
    const circleRadius: ExpressionSpecification = (proportional ? ["get", proportional.sizeRadiusProperty] : scopeCenter ? ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 9, 16, 12] : ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6, 16, 9]) as unknown as ExpressionSpecification;
    const baseCircleStrokeColor = proportional ? VIZ_SPEC.ring[theme] : scopeCenter ? "#0f172a" : "#ffffff";
    const baseCircleStrokeWidth = proportional ? proportional.ringPx : scopeCenter ? 3 : 2;
    // I1/I2: a hovered (or selected) point / bubble swaps its own 1-2px ring for the 2px accent.
    const circleStrokeColor = ["case", EMPHASIZED, accent, baseCircleStrokeColor] as unknown as ExpressionSpecification;
    const circleStrokeWidth = ["case", EMPHASIZED, ANALYSIS_EMPHASIS_WIDTH_PX, baseCircleStrokeWidth] as unknown as ExpressionSpecification;
    const proportionalSizeFilter = proportional ? warehouseProportionalSizeFilter(proportional) : null;
    const proportionalSortKey = proportional ? warehouseProportionalSortKey(proportional) : null;
    // The user's opacity slider composes with the style's own base ratio for polygon fill
    // (scope-area vs. authoritative), extrusion (M7 0.85) / isochrone (its own fillOpacity), and
    // proportional circles (spec M3 fillOpacity), matching the convention already used below.
    const primaryOpacity = polygon
      ? resultOpacity * (scopeArea ? 0.18 : extrusion ? EXTRUSION_FILL_OPACITY : isochrone ? isochrone.fillOpacity : 0.45)
      : proportional ? resultOpacity * proportional.fillOpacity : resultOpacity;
    const existing = map.getLayer(layerId(index));
    const targetType = polygon ? (extrusion ? "fill-extrusion" : "fill") : line ? "line" : heatmap ? "heatmap" : "circle";
    const reveal = !existing && !prefersReducedMotion();
    const duration = prefersReducedMotion() ? 0 : 380;
    if (existing && existing.type !== targetType) map.removeLayer(layerId(index));
    if (!heatmap && map.getLayer(heatPointsLayerId(index))) map.removeLayer(heatPointsLayerId(index));
    if (!compare && map.getLayer(compareLabelLayerId(index))) map.removeLayer(compareLabelLayerId(index));
    if (!fillHatch && map.getLayer(nullHatchLayerId(index))) map.removeLayer(nullHatchLayerId(index));
    if (!proportional && map.getLayer(proportionalLabelLayerId(index))) map.removeLayer(proportionalLabelLayerId(index));
    if (!bivariate) {
      if (map.getLayer(bivariateSizeLayerId(index))) map.removeLayer(bivariateSizeLayerId(index));
      if (map.getSource(bivariateSizeSourceId(index))) map.removeSource(bivariateSizeSourceId(index));
    }
    if (!grid && map.getLayer(gridGapLayerId(index))) map.removeLayer(gridGapLayerId(index));
    if (!isochrone && map.getLayer(isochroneOutlineLayerId(index))) map.removeLayer(isochroneOutlineLayerId(index));
    if (!flow) {
      stopFlowAnimation(map, index);
      if (map.getLayer(flowDotLayerId(index))) map.removeLayer(flowDotLayerId(index));
      if (map.getLayer(flowOutlineLayerId(index))) map.removeLayer(flowOutlineLayerId(index));
      if (map.getLayer(flowEndpointLayerId(index))) map.removeLayer(flowEndpointLayerId(index));
      if (map.getSource(flowEndpointSourceId(index))) map.removeSource(flowEndpointSourceId(index));
    }
    if (polygon && extrusion) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "fill-extrusion", source: sourceId(index), filter: warehouseExtrusionHeightFilter(extrusion), paint: {
        "fill-extrusion-color": fillColor, "fill-extrusion-height": ["get", extrusion.heightProperty], "fill-extrusion-base": 0,
        "fill-extrusion-opacity": reveal ? 0 : primaryOpacity, "fill-extrusion-opacity-transition": { duration },
      } });
    } else if (polygon) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "fill", source: sourceId(index), ...(scopeRingRows ? { filter: SCOPE_ROLE_EXCLUDE_FILTER } : {}), paint: {
        "fill-color": fillColor, "fill-opacity": reveal ? 0 : primaryOpacity, "fill-opacity-transition": { duration }, "fill-outline-color": outlineColor,
      } });
    } else if (line && flow) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "line", source: sourceId(index), filter: warehouseFlowWidthFilter(flow), layout: { "line-cap": "round" }, paint: {
        "line-color": lineColor, "line-width": ["get", flow.widthProperty], "line-opacity": reveal ? 0 : resultOpacity, "line-opacity-transition": { duration },
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
    if (polygon && extrusion) {
      map.setPaintProperty(layerId(index), "fill-extrusion-color", fillColor);
      map.setPaintProperty(layerId(index), "fill-extrusion-height", ["get", extrusion.heightProperty]);
      map.setFilter(layerId(index), warehouseExtrusionHeightFilter(extrusion));
    } else if (polygon) {
      map.setPaintProperty(layerId(index), "fill-color", fillColor);
      map.setPaintProperty(layerId(index), "fill-outline-color", outlineColor);
      map.setFilter(layerId(index), scopeRingRows ? SCOPE_ROLE_EXCLUDE_FILTER : null);
    } else if (line && flow) {
      map.setPaintProperty(layerId(index), "line-color", lineColor);
      map.setPaintProperty(layerId(index), "line-width", ["get", flow.widthProperty]);
      map.setFilter(layerId(index), warehouseFlowWidthFilter(flow));
    } else if (line) {
      map.setPaintProperty(layerId(index), "line-color", lineColor);
      map.setPaintProperty(layerId(index), "line-width", 3);
      map.setFilter(layerId(index), null);
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
      // Always resets `circle-sort-key`, not just when this result is itself proportional: a slot
      // switching *out* of proportional into another circle-drawn kind (compare/plain point) must
      // clear the previous occupant's sort key (`undefined` reverts it to the unsorted default),
      // otherwise it lingers and reorders draw order for an unrelated result reusing this slot.
      if (map.getLayer(layerId(index))) map.setLayoutProperty(layerId(index), "circle-sort-key", proportionalSortKey ?? undefined);
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
    if (grid) {
      // M6: the basemap-coloured gap between cells (spec "格間縫用 line 圖層…顏色 = 底圖面色").
      const gapColor = VIZ_SPEC.surfaces[theme];
      if (!map.getLayer(gridGapLayerId(index))) map.addLayer({ id: gridGapLayerId(index), type: "line", source: sourceId(index), paint: {
        "line-color": gapColor, "line-width": grid.gapPx, "line-opacity": resultOpacity,
      } });
      else {
        map.setPaintProperty(gridGapLayerId(index), "line-color", gapColor);
        map.setPaintProperty(gridGapLayerId(index), "line-width", grid.gapPx);
        map.setPaintProperty(gridGapLayerId(index), "line-opacity", resultOpacity);
      }
    }
    if (isochrone) {
      // M2 I1: a dedicated 1.3px solid outline, same colour as the band's fill (a `fill` layer's own
      // fill-outline-color has no configurable width).
      const isoOutlineColor = warehouseStyleColor(isochrone, theme);
      if (!map.getLayer(isochroneOutlineLayerId(index))) map.addLayer({ id: isochroneOutlineLayerId(index), type: "line", source: sourceId(index), paint: {
        "line-color": isoOutlineColor, "line-width": 1.3, "line-opacity": resultOpacity,
      } });
      else {
        map.setPaintProperty(isochroneOutlineLayerId(index), "line-color", isoOutlineColor);
        map.setPaintProperty(isochroneOutlineLayerId(index), "line-opacity", resultOpacity);
      }
    }
    if (polygon && !extrusion) {
      // M2 "大的先畫": only isochrone carries a sort key. Every other polygon result would need to
      // clear a leftover one from a prior isochrone occupant of this slot (same convention as
      // circle-sort-key below) — but only actually calls setLayoutProperty when there is a key to
      // set or clear, so a plain choropleth/grid/bivariate slot that never held one stays untouched.
      const existingLayer = map.getLayer(layerId(index)) as { layout?: Record<string, unknown> } | undefined;
      if (isochrone || existingLayer?.layout?.["fill-sort-key"] !== undefined) {
        map.setLayoutProperty(layerId(index), "fill-sort-key", isochrone ? warehouseIsochroneSortKey(isochrone) : undefined);
      }
    }
    if (flow) {
      const ring = VIZ_SPEC.ring[theme];
      const widthFilter = warehouseFlowWidthFilter(flow);
      // L2 W1: the ring-coloured outline sits beneath the classified line (spec "底下一層…寬度 = 線寬 + 3").
      const outlineWidth = ["+", ["get", flow.widthProperty], 3] as unknown as ExpressionSpecification;
      if (!map.getLayer(flowOutlineLayerId(index))) map.addLayer({ id: flowOutlineLayerId(index), type: "line", source: sourceId(index), filter: widthFilter, layout: { "line-cap": "round" }, paint: {
        "line-color": ring, "line-width": outlineWidth, "line-opacity": resultOpacity,
      } });
      else {
        map.setPaintProperty(flowOutlineLayerId(index), "line-color", ring);
        map.setPaintProperty(flowOutlineLayerId(index), "line-width", outlineWidth);
        map.setPaintProperty(flowOutlineLayerId(index), "line-opacity", resultOpacity);
        map.setFilter(flowOutlineLayerId(index), widthFilter);
      }
      // Destination dot: own point source built from each row's raw (pre-arc) last vertex.
      const endpointData = flowEndpointCollection(result, flow);
      const endpointSource = map.getSource(flowEndpointSourceId(index)) as GeoJSONSource | undefined;
      if (endpointSource) endpointSource.setData(endpointData); else map.addSource(flowEndpointSourceId(index), { type: "geojson", data: endpointData, promoteId: FEATURE_ID_PROPERTY });
      if (!map.getLayer(flowEndpointLayerId(index))) map.addLayer({ id: flowEndpointLayerId(index), type: "circle", source: flowEndpointSourceId(index), paint: {
        "circle-radius": 2.5, "circle-color": lineColor, "circle-stroke-color": ring, "circle-stroke-width": 1, "circle-opacity": resultOpacity, "circle-stroke-opacity": resultOpacity,
      } as never });
      else {
        map.setPaintProperty(flowEndpointLayerId(index), "circle-color", lineColor);
        map.setPaintProperty(flowEndpointLayerId(index), "circle-stroke-color", ring);
        map.setPaintProperty(flowEndpointLayerId(index), "circle-opacity", resultOpacity);
        map.setPaintProperty(flowEndpointLayerId(index), "circle-stroke-opacity", resultOpacity);
      }
      // F3: only when the server allowed it (< animateBelow drawn flows) and the viewer has not
      // asked for reduced motion; otherwise this stays a plain arc (F1 fallback).
      if (flow.animate && !prefersReducedMotion()) {
        const dotColor = theme === "dark" ? "#ffffff" : "#111827";
        if (!map.getLayer(flowDotLayerId(index))) map.addLayer({ id: flowDotLayerId(index), type: "line", source: sourceId(index), filter: widthFilter, layout: { "line-cap": "round" }, paint: {
          "line-color": dotColor, "line-width": flow.dotPx, "line-opacity": flow.dotOpacity * resultOpacity, "line-dasharray": FLOW_DOT_DASH_FRAMES[0] as number[],
        } });
        else {
          map.setPaintProperty(flowDotLayerId(index), "line-color", dotColor);
          map.setPaintProperty(flowDotLayerId(index), "line-opacity", flow.dotOpacity * resultOpacity);
          map.setFilter(flowDotLayerId(index), widthFilter);
        }
        // Idempotent: always cancels any prior timer for this slot first, so a redraw (e.g. a
        // basemap switch reinstalling the same result) never leaves two timers ticking.
        startFlowAnimation(map, index, flowDotLayerId(index));
      } else {
        stopFlowAnimation(map, index);
        if (map.getLayer(flowDotLayerId(index))) map.removeLayer(flowDotLayerId(index));
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
      if (sizeSource) sizeSource.setData(sizeData); else map.addSource(bivariateSizeSourceId(index), { type: "geojson", data: sizeData, promoteId: FEATURE_ID_PROPERTY });
      const { widthPx: ringWidth, color: ringColor } = bivariateSizeStrokeFor(theme);
      if (!map.getLayer(bivariateSizeLayerId(index))) map.addLayer({ id: bivariateSizeLayerId(index), type: "circle", source: bivariateSizeSourceId(index), paint: {
        "circle-color": "rgba(0,0,0,0)", "circle-radius": ["get", bivariate.sizeRadiusProperty], "circle-stroke-color": ringColor, "circle-stroke-width": ringWidth, "circle-stroke-opacity": resultOpacity,
      } as never });
      else {
        map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-color", ringColor);
        map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-width", ringWidth);
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
    if (polygon) {
      // Width 0 unless the row is emphasized: the layer costs nothing visible until hover/select.
      const edgeFilter = scopeRingRows ? SCOPE_ROLE_EXCLUDE_FILTER : null;
      const edgeWidth = ["case", EMPHASIZED, ANALYSIS_EMPHASIS_WIDTH_PX, outlineOnly ? ANALYSIS_OUTLINE_ONLY_WIDTH_PX : 0] as unknown as ExpressionSpecification;
      const edgeColor = outlineOnly ? ["case", EMPHASIZED, accent, VIZ_SPEC.categorical.other[theme]] as unknown as ExpressionSpecification : accent;
      if (!map.getLayer(edgeLayerId(index))) map.addLayer({ id: edgeLayerId(index), type: "line", source: sourceId(index), ...(edgeFilter ? { filter: edgeFilter } : {}), paint: {
        "line-color": edgeColor, "line-width": edgeWidth, "line-opacity": resultOpacity,
      } });
      else {
        map.setPaintProperty(edgeLayerId(index), "line-color", edgeColor);
        map.setPaintProperty(edgeLayerId(index), "line-width", edgeWidth);
        map.setPaintProperty(edgeLayerId(index), "line-opacity", resultOpacity);
        map.setFilter(edgeLayerId(index), edgeFilter);
      }
    } else if (map.getLayer(edgeLayerId(index))) map.removeLayer(edgeLayerId(index));
    const applyOpacity = () => {
      cancelReveal(map, index);
      if (!map.getLayer(layerId(index))) return;
      const primary = polygon || proportional ? primaryOpacity : resultOpacity;
      const primaryOpacityProperty = extrusion ? "fill-extrusion-opacity" : polygon ? "fill-opacity" : line ? "line-opacity" : heatmap ? "heatmap-opacity" : "circle-opacity";
      // heatmap/fill-extrusion cannot read feature-state; neither is ever dimmed (a heatmap's
      // close-zoom points are dimmed instead; an extrusion has no equivalent secondary layer yet).
      map.setPaintProperty(layerId(index), primaryOpacityProperty, heatmap || extrusion ? primary : dimmable(map, index, primary));
      if (!polygon && !line && !heatmap) map.setPaintProperty(layerId(index), "circle-stroke-opacity", dimmable(map, index, resultOpacity));
      if (compare && map.getLayer(compareLabelLayerId(index))) map.setPaintProperty(compareLabelLayerId(index), "text-opacity", resultOpacity);
      if (proportional && map.getLayer(proportionalLabelLayerId(index))) map.setPaintProperty(proportionalLabelLayerId(index), "text-opacity", resultOpacity);
      if (bivariate && map.getLayer(bivariateSizeLayerId(index))) map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-opacity", dimmable(map, index, resultOpacity));
      if (scopeRingRows && map.getLayer(scopeRingLayerId(index))) map.setPaintProperty(scopeRingLayerId(index), "line-opacity", resultOpacity);
      if (polygon && map.getLayer(edgeLayerId(index))) map.setPaintProperty(edgeLayerId(index), "line-opacity", dimmable(map, index, resultOpacity));
      if (grid && map.getLayer(gridGapLayerId(index))) map.setPaintProperty(gridGapLayerId(index), "line-opacity", dimmable(map, index, resultOpacity));
      if (isochrone && map.getLayer(isochroneOutlineLayerId(index))) map.setPaintProperty(isochroneOutlineLayerId(index), "line-opacity", resultOpacity);
      if (flow) {
        if (map.getLayer(flowOutlineLayerId(index))) map.setPaintProperty(flowOutlineLayerId(index), "line-opacity", resultOpacity);
        if (map.getLayer(flowEndpointLayerId(index))) { map.setPaintProperty(flowEndpointLayerId(index), "circle-opacity", resultOpacity); map.setPaintProperty(flowEndpointLayerId(index), "circle-stroke-opacity", resultOpacity); }
        if (map.getLayer(flowDotLayerId(index))) map.setPaintProperty(flowDotLayerId(index), "line-opacity", flow.dotOpacity * resultOpacity);
      }
    };
    if (reveal) {
      if (!reveals.has(map)) reveals.set(map, new globalThis.Map());
      reveals.get(map)!.set(index, applyOpacity);
      map.on("render", applyOpacity);
    } else applyOpacity();
    return presentation(result, nonScopeRowCount(result), theme, index);
  });
  for (let index = results.length; index < MAX_RESULTS; index += 1) removeIndex(map, index);
  stackAnalysisLayers(map, prepared.map(({ result }) => result));
  return installed;
}

export type AnalysisInstallOptions = {
  /** S1: visible area results that draw a 1.4px `categorical.other` edge instead of their fill. */
  outlineOnly?: Iterable<string>;
};

/** S1 stacking kind: which exclusivity rule (area fill / heatmap) a result falls under. */
export function analysisResultStackKind(result: PresentableResult): AnalysisStackKind {
  const polygon = result.geometry.type === "Polygon" || result.geometry.type === "MultiPolygon";
  if (result.resultStyle?.kind === "heatmap" && result.geometry.type === "Point") return "heat";
  // M6/M7: grid and extrusion are area fills the same way choropleth/bivariate are — only one such
  // fill is ever visible at once (S1 O1). Isochrone is deliberately excluded: DECISIONS O1 only
  // names 區域深淺／格點 and 熱力 for single-fill exclusivity, not the nested time-band ranges.
  if (polygon && (result.resultStyle?.kind === "choropleth" || result.resultStyle?.kind === "bivariate" || result.resultStyle?.kind === "grid" || result.resultStyle?.kind === "extrusion" || (!result.resultStyle && numericResultLegend(result)))) return "area";
  return "other";
}

/**
 * S1 draw order, top → bottom: labels → points → lines → bubbles → ranges (scope ring /
 * isochrone-like scope areas) → areas / grids → heatmaps. The selection ring is a DOM marker and
 * always sits above the canvas. Within a band, a later collection slot draws above an earlier one;
 * within a result, fill < null hatch < edge. All result layers stay above the rest of the style.
 */
export const ANALYSIS_LAYER_BANDS = ["label", "point", "line", "bubble", "range", "area", "heat"] as const;
type AnalysisLayerBand = typeof ANALYSIS_LAYER_BANDS[number];

export function analysisLayerStack(results: readonly PresentableResult[]): { id: string; band: AnalysisLayerBand }[] {
  const entries: { id: string; band: AnalysisLayerBand; index: number; sub: number }[] = [];
  results.forEach((result, index) => {
    const polygon = result.geometry.type === "Polygon" || result.geometry.type === "MultiPolygon";
    const line = result.geometry.type === "LineString" || result.geometry.type === "MultiLineString";
    const style = result.resultStyle;
    // M2: an isochrone's nested bands are a "range" (drawn just above the scope ring / below
    // areas/grids), not an "area" fill — it never competes for the single-fill slot.
    const areaBand: AnalysisLayerBand = isAnalysisScopeArea(result) || style?.kind === "isochrone" ? "range" : "area";
    const primary: AnalysisLayerBand = polygon ? areaBand : line ? "line" : style?.kind === "heatmap" ? "heat" : style?.kind === "proportional" ? "bubble" : "point";
    entries.push({ id: layerId(index), band: primary, index, sub: 0 });
    entries.push({ id: nullHatchLayerId(index), band: areaBand, index, sub: 1 });
    entries.push({ id: gridGapLayerId(index), band: areaBand, index, sub: 1.5 });
    entries.push({ id: isochroneOutlineLayerId(index), band: areaBand, index, sub: 1.5 });
    entries.push({ id: edgeLayerId(index), band: areaBand, index, sub: 2 });
    entries.push({ id: heatPointsLayerId(index), band: "point", index, sub: 0 });
    entries.push({ id: bivariateSizeLayerId(index), band: "bubble", index, sub: 0 });
    // L2: outline sits beneath the classified line, the flowing dots above it (both share "line").
    entries.push({ id: flowOutlineLayerId(index), band: "line", index, sub: -1 });
    entries.push({ id: flowDotLayerId(index), band: "line", index, sub: 1 });
    entries.push({ id: flowEndpointLayerId(index), band: "bubble", index, sub: 0 });
    entries.push({ id: scopeRingLayerId(index), band: "range", index, sub: 0 });
    entries.push({ id: compareLabelLayerId(index), band: "label", index, sub: 0 });
    entries.push({ id: proportionalLabelLayerId(index), band: "label", index, sub: 1 });
  });
  const rank = (band: AnalysisLayerBand) => ANALYSIS_LAYER_BANDS.length - ANALYSIS_LAYER_BANDS.indexOf(band);
  // Bottom → top.
  return entries.sort((left, right) => rank(left.band) - rank(right.band) || left.index - right.index || left.sub - right.sub).map(({ id, band }) => ({ id, band }));
}

function stackAnalysisLayers(map: Map, results: readonly PresentableResult[]): void {
  const present = analysisLayerStack(results).map(({ id }) => id).filter(id => map.getLayer(id));
  // Top-most first to the top of the style, then each lower layer just beneath the one above it.
  for (let position = present.length - 1; position >= 0; position -= 1) {
    const above = present[position + 1];
    if (above) map.moveLayer(present[position]!, above); else map.moveLayer(present[position]!);
  }
}

export function removeAnalysisResults(map: Map): void { for (let index = 0; index < MAX_RESULTS; index += 1) removeIndex(map, index); }

function removeIndex(map: Map, index: number): void {
  cancelReveal(map, index);
  stopFlowAnimation(map, index);
  if (map.getLayer(heatPointsLayerId(index))) map.removeLayer(heatPointsLayerId(index));
  if (map.getLayer(compareLabelLayerId(index))) map.removeLayer(compareLabelLayerId(index));
  if (map.getLayer(scopeRingLayerId(index))) map.removeLayer(scopeRingLayerId(index));
  if (map.getLayer(nullHatchLayerId(index))) map.removeLayer(nullHatchLayerId(index));
  if (map.getLayer(gridGapLayerId(index))) map.removeLayer(gridGapLayerId(index));
  if (map.getLayer(isochroneOutlineLayerId(index))) map.removeLayer(isochroneOutlineLayerId(index));
  if (map.getLayer(flowDotLayerId(index))) map.removeLayer(flowDotLayerId(index));
  if (map.getLayer(flowOutlineLayerId(index))) map.removeLayer(flowOutlineLayerId(index));
  if (map.getLayer(flowEndpointLayerId(index))) map.removeLayer(flowEndpointLayerId(index));
  if (map.getSource(flowEndpointSourceId(index))) map.removeSource(flowEndpointSourceId(index));
  if (map.getLayer(proportionalLabelLayerId(index))) map.removeLayer(proportionalLabelLayerId(index));
  if (map.getLayer(bivariateSizeLayerId(index))) map.removeLayer(bivariateSizeLayerId(index));
  if (map.getSource(bivariateSizeSourceId(index))) map.removeSource(bivariateSizeSourceId(index));
  if (map.getLayer(edgeLayerId(index))) map.removeLayer(edgeLayerId(index));
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
  for (const [index, result] of results.entries()) if (result.resultId === resultId) applyResultOpacity(map, index, result, opacity);
}

/** T2 A2: re-paints one already-installed timed choropleth's fill (and its null-hatch overlay, when
 *  present) to a specific period index, without rebuilding its source/layers — called by the
 *  playback controls (analysisPlaybackStore.ts) on every tick/scrub/redraw. A no-op when the slot's
 *  fill is currently suppressed (S1 `outlineOnly` — repainting it would silently re-enable a fill the
 *  panel turned off) or when the result is not actually a timed choropleth. `results`' array order is
 *  the same slot index `installAnalysisResults` used (see `layerId`). */
export function setAnalysisResultPeriod(map: Map, results: readonly AnalysisResultPresentation[], resultId: string, periodIndex: number, theme: Theme, outlineOnly: boolean): void {
  if (outlineOnly) return;
  const index = results.findIndex(result => result.resultId === resultId);
  if (index < 0) return;
  const style = results[index]!.resultStyle;
  if (!style || style.kind !== "choropleth" || !isTimedChoropleth(style)) return;
  const id = layerId(index);
  if (!map.getLayer(id)) return;
  const clamped = Math.max(0, Math.min(style.periods.length - 1, Math.round(periodIndex)));
  map.setPaintProperty(id, "fill-color", warehouseChoroplethColorAtPeriod(style, theme, clamped));
  const hatchId = nullHatchLayerId(index);
  if (map.getLayer(hatchId)) map.setFilter(hatchId, warehouseFillNullFilterAtPeriod(style, clamped));
}

function applyResultOpacity(map: Map, index: number, result: AnalysisResultPresentation, opacity: number): void {
  const id = layerId(index);
  const layer = map.getLayer(id);
  if (layer) {
    cancelReveal(map, index);
    const composedOpacity = layer.type === "fill" ? opacity * (result.fillOpacityRatio ?? (result.scopeArea ? 0.18 : 0.45))
      : layer.type === "fill-extrusion" ? opacity * EXTRUSION_FILL_OPACITY
      : layer.type === "circle" && result.circleOpacityRatio !== undefined ? opacity * result.circleOpacityRatio
      : opacity;
    const opacityProperty = layer.type === "fill" ? "fill-opacity" : layer.type === "fill-extrusion" ? "fill-extrusion-opacity" : layer.type === "line" ? "line-opacity" : layer.type === "heatmap" ? "heatmap-opacity" : "circle-opacity";
    // Neither heatmap nor fill-extrusion can read feature-state, so neither is ever dimmed by a selection.
    map.setPaintProperty(id, opacityProperty, layer.type === "heatmap" || layer.type === "fill-extrusion" ? composedOpacity : dimmable(map, index, composedOpacity));
    if (layer.type === "circle") map.setPaintProperty(id, "circle-stroke-opacity", dimmable(map, index, opacity));
  }
  if (map.getLayer(heatPointsLayerId(index))) {
    map.setPaintProperty(heatPointsLayerId(index), "circle-opacity", dimmable(map, index, opacity));
    map.setPaintProperty(heatPointsLayerId(index), "circle-stroke-opacity", dimmable(map, index, opacity));
  }
  if (map.getLayer(compareLabelLayerId(index))) map.setPaintProperty(compareLabelLayerId(index), "text-opacity", opacity);
  if (map.getLayer(nullHatchLayerId(index))) map.setPaintProperty(nullHatchLayerId(index), "fill-opacity", dimmable(map, index, opacity));
  if (map.getLayer(gridGapLayerId(index))) map.setPaintProperty(gridGapLayerId(index), "line-opacity", dimmable(map, index, opacity));
  if (map.getLayer(isochroneOutlineLayerId(index))) map.setPaintProperty(isochroneOutlineLayerId(index), "line-opacity", opacity);
  if (map.getLayer(flowOutlineLayerId(index))) map.setPaintProperty(flowOutlineLayerId(index), "line-opacity", opacity);
  if (map.getLayer(flowEndpointLayerId(index))) { map.setPaintProperty(flowEndpointLayerId(index), "circle-opacity", opacity); map.setPaintProperty(flowEndpointLayerId(index), "circle-stroke-opacity", opacity); }
  if (map.getLayer(flowDotLayerId(index))) map.setPaintProperty(flowDotLayerId(index), "line-opacity", opacity * (result.flowDotOpacityRatio ?? 1));
  if (map.getLayer(proportionalLabelLayerId(index))) map.setPaintProperty(proportionalLabelLayerId(index), "text-opacity", opacity);
  if (map.getLayer(bivariateSizeLayerId(index))) map.setPaintProperty(bivariateSizeLayerId(index), "circle-stroke-opacity", dimmable(map, index, opacity));
  if (map.getLayer(scopeRingLayerId(index))) map.setPaintProperty(scopeRingLayerId(index), "line-opacity", opacity);
  if (map.getLayer(edgeLayerId(index))) map.setPaintProperty(edgeLayerId(index), "line-opacity", dimmable(map, index, opacity));
}

/** A clicked row as the docked panel knows it: stable across a redraw, unlike a source slot. */
export type AnalysisSelection = { resultId: string; fid: number };

export function analysisSelectionOf(feature: { source?: unknown; properties?: Record<string, unknown> | null }): AnalysisSelection | null {
  const target = analysisFeatureTarget(feature);
  const resultId = feature.properties?.resultId;
  return target && typeof resultId === "string" ? { resultId, fid: target.id } : null;
}

/**
 * I2 (X1): rows in `selection` keep their colour and get the accent outline (feature-state
 * `selected`); every other row of the same result drops to ×0.35 opacity. An empty selection
 * restores everything. Idempotent, so it is safe to call again after a redraw.
 */
export function setAnalysisSelection(map: Map, results: readonly AnalysisResultPresentation[], selection: readonly AnalysisSelection[], opacity: AnalysisResultOpacity): void {
  for (const target of selectedTargets.get(map) ?? []) setState(map, target, { selected: false });
  const targets: AnalysisFeatureTarget[] = [];
  const nextDimmed = new Set<number>();
  for (const { resultId, fid } of selection) {
    const index = results.findIndex(result => result.resultId === resultId);
    if (index < 0 || index >= MAX_RESULTS || !map.getSource(sourceId(index))) continue;
    nextDimmed.add(index);
    targets.push({ source: sourceId(index), id: fid });
    if (map.getSource(bivariateSizeSourceId(index))) targets.push({ source: bivariateSizeSourceId(index), id: fid });
  }
  for (const target of targets) setState(map, target, { selected: true });
  selectedTargets.set(map, targets);
  const previousDimmed = dimmed.get(map) ?? new Set<number>();
  dimmed.set(map, nextDimmed);
  results.forEach((result, index) => {
    if (previousDimmed.has(index) === nextDimmed.has(index)) return;
    applyResultOpacity(map, index, result, opacity.byResult[result.resultId] ?? opacity.defaultOpacity);
  });
}

/** Layers that answer I1 hover: every pickable result layer except heatmap-backed points (spec:
 *  heatmap 不做滑過). Scope-only and decorative layers are never included. */
export function analysisResultHoverLayerIds(map: Map, count: number): string[] {
  return Array.from({ length: Math.min(MAX_RESULTS, count) }, (_, index) => layerId(index)).filter(id => map.getLayer(id) && map.getLayer(id)!.type !== "heatmap");
}

/** Resolve a rendered feature to its result source + promoted row id; anything else is ignored. */
export function analysisFeatureTarget(feature: { source?: unknown; properties?: Record<string, unknown> | null }): AnalysisFeatureTarget | null {
  const id = feature.properties?.[FEATURE_ID_PROPERTY];
  if (typeof feature.source !== "string" || !SOURCE_INDEX_PATTERN.test(feature.source)) return null;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 0) return null;
  if (feature.properties?._role === "scope") return null;
  return { source: feature.source, id };
}

/** The result slot index encoded in a rendered feature's own source id (`research-analysis-result-N`
 *  — the same N `installAnalysisResults`'s returned array order uses). Callers (T2 A2 hover/popup
 *  period lookups) use this instead of duplicating the source-id pattern themselves. */
export function analysisResultSlotIndex(source: string): number | null {
  const match = SOURCE_INDEX_PATTERN.exec(source);
  return match ? Number(match[1]) : null;
}

function setState(map: Map, target: AnalysisFeatureTarget, state: Record<string, boolean>): void {
  // A source can vanish between the query and this call (style switch / result removal).
  if (!map.getSource(target.source)) return;
  map.setFeatureState(target, state);
}

/** Moves the I1 hover highlight; returns whether the hovered row actually changed. */
export function setAnalysisHover(map: Map, target: AnalysisFeatureTarget | null): boolean {
  const previous = hovered.get(map) ?? null;
  if (previous && target && previous.source === target.source && previous.id === target.id) return false;
  if (!previous && !target) return false;
  if (previous) setState(map, previous, { hover: false });
  if (target) { setState(map, target, { hover: true }); hovered.set(map, target); }
  else hovered.delete(map);
  return true;
}

export function clearAnalysisHover(map: Map): void { setAnalysisHover(map, null); }
