export type Position = readonly [number, number];
export type PointGeometry = { readonly type: "Point"; readonly coordinates: Position };
export type PolygonGeometry = { readonly type: "Polygon"; readonly coordinates: readonly (readonly Position[])[] };
export type MultiPolygonGeometry = { readonly type: "MultiPolygon"; readonly coordinates: readonly (readonly (readonly Position[])[])[] };
export type SpatialGeometry = PointGeometry | PolygonGeometry | MultiPolygonGeometry;
export type SurfaceGeometry = PolygonGeometry | MultiPolygonGeometry;
export type PointSurfaceLocation = "inside" | "boundary" | "outside";

export interface SpatialKernelBudget {
  maxVertices: number;
}

export const DEFAULT_SPATIAL_KERNEL_BUDGET: SpatialKernelBudget = { maxVertices: 200_000 };

function position(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2
    && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function ring(value: unknown): value is readonly Position[] {
  return Array.isArray(value) && value.length >= 4 && value.every(position)
    && samePosition(value[0] as Position, value[value.length - 1] as Position);
}

function polygonCoordinates(value: unknown): value is PolygonGeometry["coordinates"] {
  return Array.isArray(value) && value.length >= 1 && value.every(ring);
}

export function parseSpatialGeometry(value: unknown, budget: SpatialKernelBudget = DEFAULT_SPATIAL_KERNEL_BUDGET): SpatialGeometry {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_SPATIAL_GEOMETRY");
  if (!Number.isInteger(budget.maxVertices) || budget.maxVertices < 1 || budget.maxVertices > 1_000_000) throw new Error("INVALID_SPATIAL_BUDGET");
  const candidate = value as { type?: unknown; coordinates?: unknown };
  let geometry: SpatialGeometry;
  if (candidate.type === "Point" && position(candidate.coordinates)) {
    geometry = { type: "Point", coordinates: candidate.coordinates };
  } else if (candidate.type === "Polygon" && polygonCoordinates(candidate.coordinates)) {
    geometry = { type: "Polygon", coordinates: candidate.coordinates };
  } else if (candidate.type === "MultiPolygon" && Array.isArray(candidate.coordinates)
    && candidate.coordinates.length >= 1 && candidate.coordinates.every(polygonCoordinates)) {
    geometry = { type: "MultiPolygon", coordinates: candidate.coordinates };
  } else {
    throw new Error("UNSUPPORTED_OR_INVALID_SPATIAL_GEOMETRY");
  }
  if (countGeometryVertices(geometry) > budget.maxVertices) throw new Error("SPATIAL_VERTEX_BUDGET_EXCEEDED");
  return geometry;
}

export function countGeometryVertices(geometry: SpatialGeometry): number {
  if (geometry.type === "Point") return 1;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((total, polygon) => total + polygon.reduce((sum, currentRing) => sum + currentRing.length, 0), 0);
}

export function geometryBounds(geometry: SpatialGeometry): readonly [number, number, number, number] {
  const vertices = geometry.type === "Point" ? [geometry.coordinates]
    : geometry.type === "Polygon" ? geometry.coordinates.flat()
      : geometry.coordinates.flat(2);
  const lngs = vertices.map(vertex => vertex[0]);
  const lats = vertices.map(vertex => vertex[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
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

function ringLocation(pointValue: Position, currentRing: readonly Position[]): PointSurfaceLocation {
  let inside = false;
  for (let index = 0, previous = currentRing.length - 1; index < currentRing.length; previous = index++) {
    const a = currentRing[previous]!;
    const b = currentRing[index]!;
    if (onSegment(pointValue, a, b)) return "boundary";
    const crosses = (a[1] > pointValue[1]) !== (b[1] > pointValue[1])
      && pointValue[0] < ((b[0] - a[0]) * (pointValue[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

function polygonLocation(pointValue: Position, coordinates: PolygonGeometry["coordinates"]): PointSurfaceLocation {
  const outer = ringLocation(pointValue, coordinates[0]!);
  if (outer !== "inside") return outer;
  for (const hole of coordinates.slice(1)) {
    const location = ringLocation(pointValue, hole);
    if (location === "boundary") return "boundary";
    if (location === "inside") return "outside";
  }
  return "inside";
}

export function locatePointInSurface(pointValue: PointGeometry, surface: SurfaceGeometry): PointSurfaceLocation {
  const polygons = surface.type === "Polygon" ? [surface.coordinates] : surface.coordinates;
  let boundary = false;
  for (const polygon of polygons) {
    const location = polygonLocation(pointValue.coordinates, polygon);
    if (location === "inside") return "inside";
    if (location === "boundary") boundary = true;
  }
  return boundary ? "boundary" : "outside";
}

function boxesIntersect(a: readonly [number, number, number, number], b: readonly [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function segmentsIntersect(a1: Position, a2: Position, b1: Position, b2: Position): boolean {
  if (onSegment(a1, b1, b2) || onSegment(a2, b1, b2) || onSegment(b1, a1, a2) || onSegment(b2, a1, a2)) return true;
  const d1 = orientation(a1, a2, b1); const d2 = orientation(a1, a2, b2);
  const d3 = orientation(b1, b2, a1); const d4 = orientation(b1, b2, a2);
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

function ringsIntersect(a: readonly Position[], b: readonly Position[]): boolean {
  for (let ai = 1; ai < a.length; ai += 1) {
    for (let bi = 1; bi < b.length; bi += 1) {
      if (segmentsIntersect(a[ai - 1]!, a[ai]!, b[bi - 1]!, b[bi]!)) return true;
    }
  }
  return false;
}

function polygonIntersectsPolygon(a: PolygonGeometry["coordinates"], b: PolygonGeometry["coordinates"]): boolean {
  for (const aRing of a) for (const bRing of b) if (ringsIntersect(aRing, bRing)) return true;
  const aPoint: PointGeometry = { type: "Point", coordinates: a[0]![0]! };
  const bPoint: PointGeometry = { type: "Point", coordinates: b[0]![0]! };
  return polygonLocation(aPoint.coordinates, b) !== "outside" || polygonLocation(bPoint.coordinates, a) !== "outside";
}

export function geometriesIntersect(left: SpatialGeometry, right: SpatialGeometry): boolean {
  if (!boxesIntersect(geometryBounds(left), geometryBounds(right))) return false;
  if (left.type === "Point" && right.type === "Point") return samePosition(left.coordinates, right.coordinates);
  if (left.type === "Point") {
    if (right.type === "Point") return samePosition(left.coordinates, right.coordinates);
    return locatePointInSurface(left, right) !== "outside";
  }
  if (right.type === "Point") return locatePointInSurface(right, left) !== "outside";
  const leftPolygons = left.type === "Polygon" ? [left.coordinates] : left.coordinates;
  const rightPolygons = right.type === "Polygon" ? [right.coordinates] : right.coordinates;
  return leftPolygons.some(leftPolygon => rightPolygons.some(rightPolygon => polygonIntersectsPolygon(leftPolygon, rightPolygon)));
}

export function geometryWithin(left: SpatialGeometry, right: SpatialGeometry): boolean {
  if (left.type !== "Point" || right.type === "Point") throw new Error("SPATIAL_PREDICATE_GEOMETRY_PAIR_UNSUPPORTED");
  return locatePointInSurface(left, right) === "inside";
}

export function geometryContains(left: SpatialGeometry, right: SpatialGeometry): boolean {
  if (left.type === "Point" || right.type !== "Point") throw new Error("SPATIAL_PREDICATE_GEOMETRY_PAIR_UNSUPPORTED");
  return locatePointInSurface(right, left) === "inside";
}
