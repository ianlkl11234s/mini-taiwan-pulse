import area from "@turf/area";
import buffer from "@turf/buffer";
import intersect from "@turf/intersect";
import length from "@turf/length";
import type { Feature, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";

import {
  DEFAULT_LINE_POLYGON_ANALYSIS_BUDGET,
  estimateSurfaceTopologyComparisons,
  parseLineGeometry,
  parseLinePolygonSurface,
  type LineGeometry,
} from "./linePolygonAnalysis";
import type { Position, SurfaceGeometry } from "./spatialKernel";

type PolygonGeometry = Extract<SurfaceGeometry, { readonly type: "Polygon" }>;
type MultiPolygonGeometry = Extract<SurfaceGeometry, { readonly type: "MultiPolygon" }>;
export type BoundedSurfaceGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface BoundedGeometryResult {
  geometry: BoundedSurfaceGeometry | null;
  method: Record<string, unknown>;
  summary: Record<string, unknown>;
}

const TAIWAN_BOUNDS = { west: 119.5, south: 21.8, east: 122.1, north: 25.5 } as const;
const MAX_INPUT_VERTICES = 1_600;
const MAX_OUTPUT_VERTICES = 8_000;
const MAX_OUTPUT_BYTES = 1_048_576;
const MAX_SPAN_DEGREES = 0.5;
const BUFFER_STEPS = 16;
const TOPOLOGY_BUDGET = DEFAULT_LINE_POLYGON_ANALYSIS_BUDGET;

function method(operation: "buffer" | "intersection" | "measure", radiusM?: number): Record<string, unknown> {
  return {
    operation,
    engine: "Turf 7.2.0",
    coordinates: "EPSG:4326 longitude/latitude degrees",
    units: { distance: "meters", area: "square_meters", length: "meters" },
    limits: {
      geography: "Taiwan main-island envelope [119.5, 21.8, 122.1, 25.5]",
      maxInputVertices: MAX_INPUT_VERTICES,
      maxOutputVertices: MAX_OUTPUT_VERTICES,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      maxSpanDegrees: MAX_SPAN_DEGREES,
      maxTopologyComparisons: TOPOLOGY_BUDGET.maxTopologyComparisons,
    },
    ...(operation === "buffer" ? { bufferModel: "local_azimuthal_equidistant", radiusM, steps: BUFFER_STEPS, capStyle: "round" } : {}),
    ...(operation === "intersection" ? { clippingModel: "planar EPSG:4326 coordinate clipping", measurementModel: "spherical_geodesic", area_only: true } : {}),
    ...(operation === "measure" ? { measurementModel: "spherical_geodesic" } : {}),
  };
}

function fail(code: string): never { throw new Error(code); }

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part));
}

function samePosition(left: Position, right: Position): boolean { return left[0] === right[0] && left[1] === right[1]; }

type GeometryInspection = { vertices: number; duplicateAdjacentVertices: number; bounds: readonly [number, number, number, number] };

function inspectGeometry(value: unknown, maxVertices: number, requireTaiwanBounds: boolean): GeometryInspection {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_GEOMETRY");
  const candidate = value as { type?: unknown; coordinates?: unknown };
  const coordinates = candidate.coordinates;
  if (!Array.isArray(coordinates)) fail("INVALID_GEOMETRY");
  const positions: Position[] = [];
  let duplicateAdjacentVertices = 0;
  const visitLine = (line: unknown): void => {
    if (!Array.isArray(line)) fail("INVALID_GEOMETRY");
    let previous: Position | undefined;
    for (const position of line) {
      if (!isPosition(position)) fail("INVALID_GEOMETRY");
      positions.push(position);
      if (positions.length > maxVertices) fail("SPATIAL_INPUT_VERTEX_BUDGET_EXCEEDED");
      if (previous && samePosition(previous, position)) duplicateAdjacentVertices += 1;
      previous = position;
    }
  };
  if (candidate.type === "LineString") visitLine(coordinates);
  else if (candidate.type === "MultiLineString") {
    for (const line of coordinates) visitLine(line);
  } else if (candidate.type === "Polygon") {
    for (const ring of coordinates) visitLine(ring);
  } else if (candidate.type === "MultiPolygon") {
    for (const polygon of coordinates) {
      if (!Array.isArray(polygon)) fail("INVALID_GEOMETRY");
      for (const ring of polygon) visitLine(ring);
    }
  } else fail("UNSUPPORTED_GEOMETRY_TYPE");
  if (!positions.length) fail("INVALID_GEOMETRY");
  const lngs = positions.map(position => position[0]);
  const lats = positions.map(position => position[1]);
  const west = Math.min(...lngs); const east = Math.max(...lngs); const south = Math.min(...lats); const north = Math.max(...lats);
  if (requireTaiwanBounds && (west < TAIWAN_BOUNDS.west || east > TAIWAN_BOUNDS.east || south < TAIWAN_BOUNDS.south || north > TAIWAN_BOUNDS.north)) fail("SPATIAL_GEOGRAPHY_OUT_OF_BOUNDS");
  if (east - west > MAX_SPAN_DEGREES || north - south > MAX_SPAN_DEGREES) fail("SPATIAL_GEOMETRY_SPAN_EXCEEDED");
  return { vertices: positions.length, duplicateAdjacentVertices, bounds: [west, south, east, north] };
}

function checkedLine(value: unknown): { geometry: LineGeometry; inspection: GeometryInspection } {
  const inspection = inspectGeometry(value, MAX_INPUT_VERTICES, true);
  return { geometry: parseLineGeometry(value), inspection };
}

function parsedSurface(value: unknown, inspection: GeometryInspection): { geometry: BoundedSurfaceGeometry; inspection: GeometryInspection } {
  if (estimateSurfaceTopologyComparisons(value) > TOPOLOGY_BUDGET.maxTopologyComparisons) fail("SPATIAL_TOPOLOGY_BUDGET_EXCEEDED");
  return { geometry: parseLinePolygonSurface(value, TOPOLOGY_BUDGET) as BoundedSurfaceGeometry, inspection };
}

function checkedSurface(value: unknown): { geometry: BoundedSurfaceGeometry; inspection: GeometryInspection } {
  return parsedSurface(value, inspectGeometry(value, MAX_INPUT_VERTICES, true));
}

function checkedSurfacePair(left: unknown, right: unknown): [{ geometry: BoundedSurfaceGeometry; inspection: GeometryInspection }, { geometry: BoundedSurfaceGeometry; inspection: GeometryInspection }] {
  const leftInspection = inspectGeometry(left, MAX_INPUT_VERTICES, true); const rightInspection = inspectGeometry(right, MAX_INPUT_VERTICES, true);
  if (leftInspection.vertices + rightInspection.vertices > MAX_INPUT_VERTICES) fail("SPATIAL_INPUT_VERTEX_BUDGET_EXCEEDED");
  const west = Math.min(leftInspection.bounds[0], rightInspection.bounds[0]);
  const south = Math.min(leftInspection.bounds[1], rightInspection.bounds[1]);
  const east = Math.max(leftInspection.bounds[2], rightInspection.bounds[2]);
  const north = Math.max(leftInspection.bounds[3], rightInspection.bounds[3]);
  if (east - west > MAX_SPAN_DEGREES || north - south > MAX_SPAN_DEGREES) fail("SPATIAL_GEOMETRY_SPAN_EXCEEDED");
  return [parsedSurface(left, leftInspection), parsedSurface(right, rightInspection)];
}

function outputSurface(value: unknown): BoundedSurfaceGeometry {
  inspectGeometry(value, MAX_OUTPUT_VERTICES, false);
  if (estimateSurfaceTopologyComparisons(value) > TOPOLOGY_BUDGET.maxTopologyComparisons) fail("SPATIAL_TOPOLOGY_BUDGET_EXCEEDED");
  const geometry = parseLinePolygonSurface(value, TOPOLOGY_BUDGET) as BoundedSurfaceGeometry;
  const bytes = new TextEncoder().encode(JSON.stringify(geometry)).byteLength;
  if (bytes > MAX_OUTPUT_BYTES) fail("SPATIAL_OUTPUT_BYTE_BUDGET_EXCEEDED");
  return geometry;
}

function geoPosition(position: Position): [number, number] { return [position[0], position[1]]; }

function asFeature(geometry: BoundedSurfaceGeometry): Feature<Polygon | MultiPolygon> {
  if (geometry.type === "Polygon") return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: geometry.coordinates.map(ring => ring.map(geoPosition)) } };
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: geometry.coordinates.map(polygon => polygon.map(ring => ring.map(geoPosition))) } };
}

function asLineGeometry(geometry: LineGeometry): LineString | MultiLineString {
  if (geometry.type === "LineString") return { type: "LineString", coordinates: geometry.coordinates.map(geoPosition) };
  return { type: "MultiLineString", coordinates: geometry.coordinates.map(line => line.map(geoPosition)) };
}

function asLineFeature(geometry: LineGeometry): Feature<LineString | MultiLineString> {
  return { type: "Feature", properties: {}, geometry: asLineGeometry(geometry) };
}

/** Buffers one valid route geometry. Repeated adjacent vertices remain lossless and are counted. */
export function boundedLineBuffer(geometry: unknown, radiusM: number): BoundedGeometryResult {
  if (!Number.isFinite(radiusM) || radiusM < 1 || radiusM > 500) fail("INVALID_BUFFER_RADIUS_METERS");
  const parsed = checkedLine(geometry);
  const output = buffer(asLineGeometry(parsed.geometry), radiusM, { units: "meters", steps: BUFFER_STEPS });
  const surface = output?.geometry ? outputSurface(output.geometry) : fail("SPATIAL_BUFFER_EMPTY");
  return {
    geometry: surface,
    method: method("buffer", radiusM),
    summary: { inputVertices: parsed.inspection.vertices, duplicateAdjacentVertices: parsed.inspection.duplicateAdjacentVertices, outputVertices: inspectGeometry(surface, MAX_OUTPUT_VERTICES, false).vertices, outputBytes: new TextEncoder().encode(JSON.stringify(surface)).byteLength },
  };
}

/** Intersects exactly two valid surfaces and deliberately discards line/point-only contact. */
export function boundedSurfaceIntersection(left: unknown, right: unknown): BoundedGeometryResult {
  const [leftSurface, rightSurface] = checkedSurfacePair(left, right);
  const output = intersect({ type: "FeatureCollection", features: [asFeature(leftSurface.geometry), asFeature(rightSurface.geometry)] });
  if (!output?.geometry || (output.geometry.type !== "Polygon" && output.geometry.type !== "MultiPolygon")) {
    return { geometry: null, method: method("intersection"), summary: { area_only: true, empty: true, areaM2: 0, boundaryLengthM: 0, inputVertices: [leftSurface.inspection.vertices, rightSurface.inspection.vertices] } };
  }
  const surface = outputSurface(output.geometry);
  const feature = asFeature(surface);
  return {
    geometry: surface,
    method: method("intersection"),
    summary: { area_only: true, empty: false, areaM2: area(feature), boundaryLengthM: length(feature, { units: "meters" }), inputVertices: [leftSurface.inspection.vertices, rightSurface.inspection.vertices], outputVertices: inspectGeometry(surface, MAX_OUTPUT_VERTICES, false).vertices },
  };
}

/** Measures one bounded line or surface with Turf's spherical-geodesic model. */
export function boundedMeasure(geometry: unknown): BoundedGeometryResult {
  const candidate = geometry as { type?: unknown } | null;
  if (candidate?.type === "LineString" || candidate?.type === "MultiLineString") {
    const parsed = checkedLine(geometry);
    return { geometry: null, method: method("measure"), summary: { lengthM: length(asLineFeature(parsed.geometry), { units: "meters" }), inputVertices: parsed.inspection.vertices, duplicateAdjacentVertices: parsed.inspection.duplicateAdjacentVertices } };
  }
  const parsed = checkedSurface(geometry);
  return { geometry: null, method: method("measure"), summary: { areaM2: area(asFeature(parsed.geometry)), inputVertices: parsed.inspection.vertices } };
}
