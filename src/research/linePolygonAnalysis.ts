import type { Position, SurfaceGeometry } from "./spatialKernel";

export type LineStringGeometry = { readonly type: "LineString"; readonly coordinates: readonly Position[] };
export type MultiLineStringGeometry = { readonly type: "MultiLineString"; readonly coordinates: readonly (readonly Position[])[] };
export type LineGeometry = LineStringGeometry | MultiLineStringGeometry;

export interface LinePolygonAnalysisBudget {
  /** Caps all line-segment × ring-segment checks for one predicate call. */
  maxSegmentComparisons: number;
  /** Caps topology checks while rejecting malformed polygon rings. */
  maxTopologyComparisons: number;
}

export const DEFAULT_LINE_POLYGON_ANALYSIS_BUDGET: LinePolygonAnalysisBudget = {
  maxSegmentComparisons: 2_000_000,
  maxTopologyComparisons: 2_000_000,
};

type Ring = readonly Position[];
type PolygonCoordinates = readonly Ring[];
type Bounds = readonly [number, number, number, number];

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2
    && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;
}

function samePosition(left: Position, right: Position): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

/** This planar EPSG:4326 predicate deliberately has no antimeridian handling. */
function crossesAntimeridian(a: Position, b: Position): boolean { return Math.abs(a[0] - b[0]) > 180; }

function hasAntimeridianSegment(positions: readonly Position[]): boolean {
  return positions.some((position, index) => index > 0 && crossesAntimeridian(positions[index - 1]!, position));
}

function orientation(a: Position, b: Position, c: Position): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(point: Position, a: Position, b: Position): boolean {
  const epsilon = 1e-12;
  return Math.abs(orientation(a, b, point)) <= epsilon
    && point[0] >= Math.min(a[0], b[0]) - epsilon && point[0] <= Math.max(a[0], b[0]) + epsilon
    && point[1] >= Math.min(a[1], b[1]) - epsilon && point[1] <= Math.max(a[1], b[1]) + epsilon;
}

function segmentsIntersect(a1: Position, a2: Position, b1: Position, b2: Position): boolean {
  if (onSegment(a1, b1, b2) || onSegment(a2, b1, b2) || onSegment(b1, a1, a2) || onSegment(b2, a1, a2)) return true;
  const d1 = orientation(a1, a2, b1); const d2 = orientation(a1, a2, b2);
  const d3 = orientation(b1, b2, a1); const d4 = orientation(b1, b2, a2);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

function ringLocation(point: Position, ring: Ring): "inside" | "boundary" | "outside" {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[previous]!; const b = ring[index]!;
    if (onSegment(point, a, b)) return "boundary";
    const crosses = (a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

function polygonLocation(point: Position, polygon: PolygonCoordinates): "inside" | "boundary" | "outside" {
  const outer = ringLocation(point, polygon[0]!);
  if (outer !== "inside") return outer;
  for (const hole of polygon.slice(1)) {
    const location = ringLocation(point, hole);
    if (location === "boundary") return "boundary";
    if (location === "inside") return "outside";
  }
  return "inside";
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let index = 1; index < ring.length; index += 1) area += ring[index - 1]![0] * ring[index]![1] - ring[index]![0] * ring[index - 1]![1];
  return area / 2;
}

type RingSegment = readonly [Position, Position];

/**
 * Zero-length edges do not change a ring boundary. Keep their source positions
 * intact, but exclude them from topology predicates so a valid Turf result is
 * not misclassified as self-intersecting through its own repeated vertex.
 */
function nonDegenerateRingSegments(ring: Ring): readonly RingSegment[] {
  const segments: RingSegment[] = [];
  for (let index = 1; index < ring.length; index += 1) {
    const start = ring[index - 1]!; const end = ring[index]!;
    if (!samePosition(start, end)) segments.push([start, end]);
  }
  return segments;
}

function ringsIntersect(left: Ring, right: Ring): boolean {
  const leftSegments = nonDegenerateRingSegments(left);
  const rightSegments = nonDegenerateRingSegments(right);
  for (const [leftStart, leftEnd] of leftSegments) {
    for (const [rightStart, rightEnd] of rightSegments) {
      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)) return true;
    }
  }
  return false;
}

function validateRing(value: unknown, budget: LinePolygonAnalysisBudget): value is Ring {
  if (!Array.isArray(value) || value.length < 4 || !value.every(isPosition) || !samePosition(value[0]!, value[value.length - 1]!)) return false;
  if (Math.abs(ringArea(value)) <= 1e-12) return false;
  if (hasAntimeridianSegment(value)) throw new Error("UNSUPPORTED_ANTIMERIDIAN_GEOMETRY");
  const segments = value.length - 1;
  if ((segments * (segments - 3)) / 2 > budget.maxTopologyComparisons) throw new Error("SPATIAL_TOPOLOGY_BUDGET_EXCEEDED");
  const nonDegenerateSegments = nonDegenerateRingSegments(value);
  for (let left = 0; left < nonDegenerateSegments.length; left += 1) {
    for (let right = left + 1; right < nonDegenerateSegments.length; right += 1) {
      const adjacent = right === left + 1 || left === 0 && right === nonDegenerateSegments.length - 1;
      if (!adjacent && segmentsIntersect(...nonDegenerateSegments[left]!, ...nonDegenerateSegments[right]!)) return false;
    }
  }
  return true;
}

function validatePolygon(value: unknown, budget: LinePolygonAnalysisBudget): value is PolygonCoordinates {
  if (!Array.isArray(value) || value.length < 1 || !value.every(ring => validateRing(ring, budget))) return false;
  const outer = value[0]!;
  for (const hole of value.slice(1)) if (ringLocation(hole[0]!, outer) !== "inside" || ringsIntersect(outer, hole)) return false;
  for (let left = 1; left < value.length; left += 1) {
    for (let right = left + 1; right < value.length; right += 1) {
      if (ringsIntersect(value[left]!, value[right]!) || ringLocation(value[left]![0]!, value[right]!) !== "outside" || ringLocation(value[right]![0]!, value[left]!) !== "outside") return false;
    }
  }
  return true;
}

function validateSurface(value: unknown, budget: LinePolygonAnalysisBudget): value is SurfaceGeometry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (candidate.type === "Polygon") return validatePolygon(candidate.coordinates, budget);
  if (candidate.type !== "MultiPolygon" || !Array.isArray(candidate.coordinates) || !candidate.coordinates.length || !candidate.coordinates.every(polygon => validatePolygon(polygon, budget))) return false;
  for (let left = 0; left < candidate.coordinates.length; left += 1) {
    for (let right = left + 1; right < candidate.coordinates.length; right += 1) {
      const leftPolygon = candidate.coordinates[left]!; const rightPolygon = candidate.coordinates[right]!;
      if (leftPolygon.some(leftRing => rightPolygon.some(rightRing => ringsIntersect(leftRing, rightRing))) || polygonLocation(leftPolygon[0]![0]!, rightPolygon) !== "outside" || polygonLocation(rightPolygon[0]![0]!, leftPolygon) !== "outside") return false;
    }
  }
  return true;
}

export function parseLineGeometry(value: unknown): LineGeometry {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_LINE_GEOMETRY");
  const candidate = value as { type?: unknown; coordinates?: unknown };
  // TDX route paths can repeat a vertex. It is still a valid LineString as
  // long as the path contains at least one non-zero segment.
  const validLine = (line: unknown): line is readonly Position[] => Array.isArray(line) && line.length >= 2 && line.every(isPosition)
    && line.some((position, index) => index > 0 && !samePosition(position, line[index - 1]!));
  const checkedLine = (line: unknown): line is readonly Position[] => {
    if (!validLine(line)) return false;
    if (hasAntimeridianSegment(line)) throw new Error("UNSUPPORTED_ANTIMERIDIAN_GEOMETRY");
    return true;
  };
  if (candidate.type === "LineString" && checkedLine(candidate.coordinates)) return { type: "LineString", coordinates: candidate.coordinates };
  if (candidate.type === "MultiLineString" && Array.isArray(candidate.coordinates) && candidate.coordinates.length >= 1 && candidate.coordinates.every(checkedLine)) return { type: "MultiLineString", coordinates: candidate.coordinates };
  throw new Error("INVALID_LINE_GEOMETRY");
}

export function parseLinePolygonSurface(value: unknown, budget: LinePolygonAnalysisBudget = DEFAULT_LINE_POLYGON_ANALYSIS_BUDGET): SurfaceGeometry {
  assertBudget(budget);
  if (!validateSurface(value, budget)) throw new Error("INVALID_SURFACE_GEOMETRY");
  return value;
}

function bounds(positions: readonly Position[]): Bounds {
  const lngs = positions.map(position => position[0]); const lats = positions.map(position => position[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function boxesIntersect(left: Bounds, right: Bounds): boolean {
  return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1];
}

function assertBudget(budget: LinePolygonAnalysisBudget): void {
  if (!Number.isInteger(budget.maxSegmentComparisons) || budget.maxSegmentComparisons < 1
    || !Number.isInteger(budget.maxTopologyComparisons) || budget.maxTopologyComparisons < 1) throw new Error("INVALID_LINE_POLYGON_BUDGET");
}

function lineSegmentCount(line: readonly Position[]): number {
  return line.length - 1;
}

function polygonSegmentCount(polygon: PolygonCoordinates): number {
  return polygon.reduce((total, ring) => total + ring.length - 1, 0);
}

/** Cheap upper bound used to reserve topology work before parsing many areas. */
export function estimateSurfaceTopologyComparisons(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Number.POSITIVE_INFINITY;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  const polygons = candidate.type === "Polygon" ? [candidate.coordinates] : candidate.type === "MultiPolygon" && Array.isArray(candidate.coordinates) ? candidate.coordinates : null;
  if (!polygons?.length) return Number.POSITIVE_INFINITY;
  const ringSegments = (polygon: unknown): number[] | null => Array.isArray(polygon) && polygon.length
    ? polygon.map(ring => Array.isArray(ring) ? Math.max(0, ring.length - 1) : -1) : null;
  const parts = polygons.map(ringSegments); if (parts.some(part => !part)) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (const rings of parts as number[][]) {
    for (const segments of rings) total += segments * Math.max(0, segments - 3) / 2;
    for (let left = 0; left < rings.length; left += 1) for (let right = left + 1; right < rings.length; right += 1) total += rings[left]! * rings[right]!;
  }
  for (let left = 0; left < parts.length; left += 1) for (let right = left + 1; right < parts.length; right += 1) {
    total += (parts[left] as number[]).reduce((sum, segments) => sum + segments, 0) * (parts[right] as number[]).reduce((sum, segments) => sum + segments, 0);
  }
  return total;
}

export function linePolygonSegmentComparisons(line: LineGeometry, surface: SurfaceGeometry): number {
  const lines = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  const polygons = surface.type === "Polygon" ? [surface.coordinates] : surface.coordinates;
  return lines.reduce((total, currentLine) => total + polygons.reduce((sum, polygon) => sum + lineSegmentCount(currentLine) * polygonSegmentCount(polygon), 0), 0);
}

function lineIntersectsPolygon(line: readonly Position[], polygon: PolygonCoordinates): boolean {
  const polygonVertices = polygon.flat();
  if (!boxesIntersect(bounds(line), bounds(polygonVertices))) return false;
  for (let lineIndex = 1; lineIndex < line.length; lineIndex += 1) {
    for (const ring of polygon) for (let ringIndex = 1; ringIndex < ring.length; ringIndex += 1) {
      if (segmentsIntersect(line[lineIndex - 1]!, line[lineIndex]!, ring[ringIndex - 1]!, ring[ringIndex]!)) return true;
    }
  }
  return polygonLocation(line[0]!, polygon) === "inside";
}

/** Inputs must already have passed parseLineGeometry and parseLinePolygonSurface. */
export function lineIntersectsParsedSurface(line: LineGeometry, surface: SurfaceGeometry): boolean {
  const lines = line.type === "LineString" ? [line.coordinates] : line.coordinates;
  const polygons = surface.type === "Polygon" ? [surface.coordinates] : surface.coordinates;
  return lines.some(currentLine => polygons.some(polygon => lineIntersectsPolygon(currentLine, polygon)));
}

/**
 * Tests the complete LineString or every MultiLineString part against all surface
 * boundaries. Boundary contact is an intersection; a line wholly inside a hole is not.
 */
export function lineIntersectsSurface(lineValue: unknown, surfaceValue: unknown, budget: LinePolygonAnalysisBudget = DEFAULT_LINE_POLYGON_ANALYSIS_BUDGET): boolean {
  assertBudget(budget);
  const line = parseLineGeometry(lineValue); const surface = parseLinePolygonSurface(surfaceValue, budget);
  const comparisons = linePolygonSegmentComparisons(line, surface);
  if (comparisons > budget.maxSegmentComparisons) throw new Error("SPATIAL_SEGMENT_COMPARISON_BUDGET_EXCEEDED");
  return lineIntersectsParsedSurface(line, surface);
}
