export type LinePosition = readonly [number, number];
export type LineStringGeometry = { readonly type: "LineString"; readonly coordinates: readonly LinePosition[] };
export type MultiLineStringGeometry = { readonly type: "MultiLineString"; readonly coordinates: readonly (readonly LinePosition[])[] };
export type LineGeometry = LineStringGeometry | MultiLineStringGeometry;
type Bbox = readonly [number, number, number, number];

function position(value: unknown): value is LinePosition {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(value[0] as number) <= 180 && Math.abs(value[1] as number) <= 90;
}

export function parseLineGeometry(value: unknown, maxVertices = 200_000): LineGeometry {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Number.isSafeInteger(maxVertices) || maxVertices < 2 || maxVertices > 1_000_000) throw new Error("INVALID_LINE_GEOMETRY");
  const geometry = value as { type?: unknown; coordinates?: unknown };
  const validLine = (line: unknown): line is readonly LinePosition[] => Array.isArray(line) && line.length >= 2 && line.every(position);
  let lines: readonly (readonly LinePosition[])[];
  if (geometry.type === "LineString" && validLine(geometry.coordinates)) lines = [geometry.coordinates];
  else if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(validLine)) lines = geometry.coordinates;
  else throw new Error("INVALID_LINE_GEOMETRY");
  if (lines.reduce((sum, line) => sum + line.length, 0) > maxVertices) throw new Error("LINE_VERTEX_BUDGET_EXCEEDED");
  return geometry as LineGeometry;
}

function orientation(a: LinePosition, b: LinePosition, c: LinePosition): number { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function on(point: LinePosition, a: LinePosition, b: LinePosition): boolean { return Math.abs(orientation(a, b, point)) <= 1e-12 && point[0] >= Math.min(a[0], b[0]) - 1e-12 && point[0] <= Math.max(a[0], b[0]) + 1e-12 && point[1] >= Math.min(a[1], b[1]) - 1e-12 && point[1] <= Math.max(a[1], b[1]) + 1e-12; }
function segmentsIntersect(a: LinePosition, b: LinePosition, c: LinePosition, d: LinePosition): boolean {
  if (on(a, c, d) || on(b, c, d) || on(c, a, b) || on(d, a, b)) return true;
  return (orientation(a, b, c) > 0) !== (orientation(a, b, d) > 0) && (orientation(c, d, a) > 0) !== (orientation(c, d, b) > 0);
}

export function lineIntersectsBbox(geometry: LineGeometry, [west, south, east, north]: Bbox): boolean {
  const inside = ([lng, lat]: LinePosition) => lng >= west && lng <= east && lat >= south && lat <= north;
  const corners: readonly LinePosition[] = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  for (const line of lines) for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1]!, b = line[i]!;
    if (inside(a) || inside(b)) return true;
    if (Math.max(a[0], b[0]) < west || Math.min(a[0], b[0]) > east || Math.max(a[1], b[1]) < south || Math.min(a[1], b[1]) > north) continue;
    for (let j = 1; j < corners.length; j += 1) if (segmentsIntersect(a, b, corners[j - 1]!, corners[j]!)) return true;
  }
  return false;
}
