import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon, Point, Polygon } from "geojson";
import type { ExpressionSpecification, GeoJSONSource, Map } from "mapbox-gl";
import { RESULT_COLLECTION_LIMITS, type PresentableResult } from "./researchAnalysisSession";
import { prefersReducedMotion } from "./researchMotion";
import type { ResultCollection } from "./bridgeClient";
import { warehouseHeatmapFilter, warehouseHeatmapPaint, warehouseStyleColor, warehouseStyleFact, warehouseStyleLegend, type WarehouseResultStyle, type WarehouseStyleLegend } from "./warehouseResultStyle";

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
const HEAT_POINTS_MINZOOM = 13;
const reveals = new WeakMap<Map, globalThis.Map<number, () => void>>();

function isAnalysisScopeArea(result: PresentableResult): boolean { return result.datasetId === "derived:analysis-scope-area"; }
function isAnalysisScopeCenter(result: PresentableResult): boolean { return result.datasetId === "derived:analysis-scope-center"; }

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

function presentation(result: PresentableResult, featureCount: number, index?: number): AnalysisResultPresentation {
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
  const styleSwatch = style && style.kind !== "compare" ? style.colors[style.colors.length - 1]! : undefined;
  return {
    resultId: result.resultId, datasetId: result.datasetId, displayLabel: result.displayLabel ?? result.datasetId,
    geometryType: result.geometry.type, featureCount, ...(index === undefined || countLegend ? {} : { color: styleSwatch ?? (numericLegend ? numericLegend.entries[0]!.color : isAnalysisScopeCenter(result) ? "#fef3c7" : COLORS[index]!) }),
    ...(style && style.kind !== "compare" ? { styleLegend: warehouseStyleLegend(style) } : {}),
    ...(style?.kind === "compare" ? { compareTable: style } : {}),
    ...(isAnalysisScopeArea(result) ? { scopeArea: true as const } : {}),
    ...(countLegend ? { countLegend } : {}),
    ...(numericLegend ? { numericLegend } : {}),
  };
}

/** Metadata for the whole authorized collection, including effectively hidden items. */
export function describeAnalysisResults(results: readonly PresentableResult[]): AnalysisResultPresentation[] {
  return results.map(result => {
    const data = collection(result);
    if (data.features.length !== result.rows.length) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    return presentation(result, data.features.length);
  });
}

/** Transient result layers are independent of the permanent layer catalogue. */
export function installAnalysisResults(map: Map, results: readonly PresentableResult[], opacity: number | AnalysisResultOpacity = 0.55): AnalysisResultPresentation[] {
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
    const numericLegend = numericResultLegend(result);
    const style = result.resultStyle;
    const heatmap = style?.kind === "heatmap" && result.geometry.type === "Point" ? style : null;
    const compare = style?.kind === "compare" && result.geometry.type === "Point" ? style : null;
    const styleColor = style && style.kind !== "heatmap" && style.kind !== "compare" ? warehouseStyleColor(style) : null;
    const fillColor: string | ExpressionSpecification = styleColor ?? (numericLegend ? numericFillColor(numericLegend) : COLORS[index]!);
    const outlineColor = styleColor ? "#475569" : numericLegend ? "#075985" : COLORS[index]!;
    const lineColor: string | ExpressionSpecification = styleColor ?? COLORS[index]!;
    const circleColor: string | ExpressionSpecification = styleColor ? styleColor : heatmap ? heatmap.colors[heatmap.colors.length - 1]! : scopeCenter ? "#fef3c7" : result.presentation ? ["step", ["get", result.presentation.countField], COUNT_COLORS[0], COUNT_STOPS[0], COUNT_COLORS[1], COUNT_STOPS[1], COUNT_COLORS[2]] as unknown as ExpressionSpecification : COLORS[index]!;
    const circleRadius: ExpressionSpecification = (scopeCenter ? ["interpolate", ["linear"], ["zoom"], 5, 6, 12, 9, 16, 12] : ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6, 16, 9]) as unknown as ExpressionSpecification;
    const circleStrokeColor = scopeCenter ? "#0f172a" : "#ffffff";
    const circleStrokeWidth = scopeCenter ? 3 : 2;
    const existing = map.getLayer(layerId(index));
    const reveal = !existing && !prefersReducedMotion();
    const duration = prefersReducedMotion() ? 0 : 380;
    if (existing && existing.type !== (polygon ? "fill" : line ? "line" : heatmap ? "heatmap" : "circle")) map.removeLayer(layerId(index));
    if (!heatmap && map.getLayer(heatPointsLayerId(index))) map.removeLayer(heatPointsLayerId(index));
    if (!compare && map.getLayer(compareLabelLayerId(index))) map.removeLayer(compareLabelLayerId(index));
    if (polygon) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "fill", source: sourceId(index), paint: {
        "fill-color": fillColor, "fill-opacity": reveal ? 0 : resultOpacity * (scopeArea ? 0.18 : 0.45), "fill-opacity-transition": { duration }, "fill-outline-color": outlineColor,
      } });
    } else if (line) {
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "line", source: sourceId(index), paint: { "line-color": lineColor, "line-width": 3, "line-opacity": reveal ? 0 : resultOpacity, "line-opacity-transition": { duration } } });
    } else if (heatmap) {
      const filter = warehouseHeatmapFilter(heatmap);
      if (!map.getLayer(layerId(index))) map.addLayer({ id: layerId(index), type: "heatmap", source: sourceId(index), ...(filter ? { filter } : {}), paint: warehouseHeatmapPaint(heatmap, reveal ? 0 : resultOpacity) as never });
      if (!map.getLayer(heatPointsLayerId(index))) map.addLayer({ id: heatPointsLayerId(index), type: "circle", source: sourceId(index), minzoom: HEAT_POINTS_MINZOOM, paint: {
        "circle-color": circleColor, "circle-radius": 4, "circle-opacity": resultOpacity, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-stroke-opacity": resultOpacity,
      } });
    } else if (!map.getLayer(layerId(index))) map.addLayer({
      id: layerId(index), type: "circle", source: sourceId(index),
      paint: {
        "circle-color": circleColor, "circle-radius": circleRadius,
        "circle-opacity": reveal ? 0 : resultOpacity, "circle-opacity-transition": { duration }, "circle-stroke-opacity": reveal ? 0 : resultOpacity, "circle-stroke-opacity-transition": { duration }, "circle-stroke-color": circleStrokeColor, "circle-stroke-width": circleStrokeWidth,
      },
    });
    if (polygon) {
      map.setPaintProperty(layerId(index), "fill-color", fillColor);
      map.setPaintProperty(layerId(index), "fill-outline-color", outlineColor);
    } else if (line) {
      map.setPaintProperty(layerId(index), "line-color", lineColor);
      map.setPaintProperty(layerId(index), "line-width", 3);
    } else if (heatmap) {
      const paint = warehouseHeatmapPaint(heatmap, resultOpacity);
      for (const key of ["heatmap-weight", "heatmap-intensity", "heatmap-radius", "heatmap-color"] as const) map.setPaintProperty(layerId(index), key, paint[key] as never);
      map.setFilter(layerId(index), warehouseHeatmapFilter(heatmap));
    } else {
      map.setPaintProperty(layerId(index), "circle-color", circleColor);
      map.setPaintProperty(layerId(index), "circle-radius", circleRadius);
      map.setPaintProperty(layerId(index), "circle-stroke-color", circleStrokeColor);
      map.setPaintProperty(layerId(index), "circle-stroke-width", circleStrokeWidth);
    }
    if (compare) {
      if (!map.getLayer(compareLabelLayerId(index))) map.addLayer({ id: compareLabelLayerId(index), type: "symbol", source: sourceId(index), layout: {
        "text-field": ["get", compare.pointProperty], "text-size": 12, "text-allow-overlap": true, "text-ignore-placement": true,
      }, paint: { "text-color": "#ffffff", "text-halo-color": "#0f172a", "text-halo-width": 1.4, "text-opacity": resultOpacity } });
      else map.setPaintProperty(compareLabelLayerId(index), "text-opacity", resultOpacity);
    }
    const applyOpacity = () => {
      cancelReveal(map, index);
      if (!map.getLayer(layerId(index))) return;
      map.setPaintProperty(layerId(index), polygon ? "fill-opacity" : line ? "line-opacity" : heatmap ? "heatmap-opacity" : "circle-opacity", polygon ? resultOpacity * (scopeArea ? 0.18 : 0.45) : resultOpacity);
      if (!polygon && !line && !heatmap) map.setPaintProperty(layerId(index), "circle-stroke-opacity", resultOpacity);
      if (compare && map.getLayer(compareLabelLayerId(index))) map.setPaintProperty(compareLabelLayerId(index), "text-opacity", resultOpacity);
    };
    if (reveal) {
      if (!reveals.has(map)) reveals.set(map, new globalThis.Map());
      reveals.get(map)!.set(index, applyOpacity);
      map.on("render", applyOpacity);
    } else applyOpacity();
    return presentation(result, data.features.length, index);
  });
  for (let index = results.length; index < MAX_RESULTS; index += 1) removeIndex(map, index);
  return installed;
}

export function removeAnalysisResults(map: Map): void { for (let index = 0; index < MAX_RESULTS; index += 1) removeIndex(map, index); }

function removeIndex(map: Map, index: number): void {
  cancelReveal(map, index);
  if (map.getLayer(heatPointsLayerId(index))) map.removeLayer(heatPointsLayerId(index));
  if (map.getLayer(compareLabelLayerId(index))) map.removeLayer(compareLabelLayerId(index));
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
      map.setPaintProperty(id, layer.type === "fill" ? "fill-opacity" : layer.type === "line" ? "line-opacity" : layer.type === "heatmap" ? "heatmap-opacity" : "circle-opacity", layer.type === "fill" ? opacity * (result.scopeArea ? 0.18 : 0.45) : opacity);
      if (layer.type === "circle") map.setPaintProperty(id, "circle-stroke-opacity", opacity);
    }
    if (map.getLayer(heatPointsLayerId(index))) {
      map.setPaintProperty(heatPointsLayerId(index), "circle-opacity", opacity);
      map.setPaintProperty(heatPointsLayerId(index), "circle-stroke-opacity", opacity);
    }
    if (map.getLayer(compareLabelLayerId(index))) map.setPaintProperty(compareLabelLayerId(index), "text-opacity", opacity);
  }
}
