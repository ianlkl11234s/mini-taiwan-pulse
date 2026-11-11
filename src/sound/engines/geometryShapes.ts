/**
 * 接收者到 GeoJSON 幾何（點／線／面，含 Multi*）的最短水平距離（公尺）。
 * 以接收者緯度做局部等距投影（候選半徑 ≤ 數 km，誤差遠小於來源本身的定位精度）；多邊形內＝0。
 */
const M_PER_DEG = 111_195;

type XY = [number, number];

function project(receiverLon: number, receiverLat: number) {
  const kx = M_PER_DEG * Math.cos((receiverLat * Math.PI) / 180);
  return (c: readonly number[]): XY => [(c[0]! - receiverLon) * kx, (c[1]! - receiverLat) * M_PER_DEG];
}

function distToSegment(a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, (-a[0] * dx - a[1] * dy) / L));
  return Math.hypot(a[0] + t * dx, a[1] + t * dy);
}

function distToLine(pts: XY[]): number {
  if (pts.length === 1) return Math.hypot(pts[0]![0], pts[0]![1]);
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, distToSegment(pts[i]!, pts[i + 1]!));
  return d;
}

/** 原點是否在環內（射線法） */
function originInRing(ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolygon(rings: XY[][]): number {
  if (!rings.length) return Infinity;
  const [outer, ...holes] = rings;
  if (outer && originInRing(outer) && !holes.some(originInRing)) return 0;
  return Math.min(...rings.map(distToLine));
}

/** null／未支援的幾何 → null（呼叫端當 unknown，不當遠或 0） */
export function distanceToGeometryM(geometry: GeoJSON.Geometry | null | undefined, lon: number, lat: number): number | null {
  if (!geometry) return null;
  const pr = project(lon, lat);
  switch (geometry.type) {
    case "Point":
      return distToLine([pr(geometry.coordinates)]);
    case "MultiPoint":
      return geometry.coordinates.length ? Math.min(...geometry.coordinates.map((c) => distToLine([pr(c)]))) : null;
    case "LineString":
      return geometry.coordinates.length ? distToLine(geometry.coordinates.map(pr)) : null;
    case "MultiLineString":
      return geometry.coordinates.length ? Math.min(...geometry.coordinates.map((l) => distToLine(l.map(pr)))) : null;
    case "Polygon":
      return distToPolygon(geometry.coordinates.map((r) => r.map(pr)));
    case "MultiPolygon":
      return geometry.coordinates.length ? Math.min(...geometry.coordinates.map((p) => distToPolygon(p.map((r) => r.map(pr))))) : null;
    case "GeometryCollection": {
      const ds = geometry.geometries.map((g) => distanceToGeometryM(g, lon, lat)).filter((d): d is number => d != null);
      return ds.length ? Math.min(...ds) : null;
    }
    default:
      return null;
  }
}
