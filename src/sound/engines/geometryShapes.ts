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

/**
 * 同上的折線距離（同一投影與線段公式），但吃扁平座標 [lon0, lat0, lon1, lat1, …] 且不配置記憶體；
 * 道路網格（W6-2）每格要算數十條路段，用這支避免大量暫存陣列。空陣列 → Infinity。
 */
export function distanceToFlatLineM(flat: ArrayLike<number>, lon: number, lat: number): number {
  const n = flat.length >> 1;
  if (n === 0) return Infinity;
  const kx = M_PER_DEG * Math.cos((lat * Math.PI) / 180);
  let ax = (flat[0]! - lon) * kx;
  let ay = (flat[1]! - lat) * M_PER_DEG;
  if (n === 1) return Math.hypot(ax, ay);
  let d = Infinity;
  for (let i = 1; i < n; i++) {
    const bx = (flat[2 * i]! - lon) * kx;
    const by = (flat[2 * i + 1]! - lat) * M_PER_DEG;
    const dx = bx - ax;
    const dy = by - ay;
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / L));
    const di = Math.hypot(ax + t * dx, ay + t * dy);
    if (di < d) d = di;
    ax = bx;
    ay = by;
  }
  return d;
}

// ── W6-3：大幾何（全北北近岸海域面、河道線）的近距離查詢 ─────────────
//
// distanceToGeometryM 對每次查詢掃整份幾何；全北北河道 1.1 萬條線 × 3.8 萬格會卡住主執行緒。
// 這裡把線與環切成短段（chunk，相鄰段共用端點），依外框放進 0.02° 桶；查詢只算點 ± maxM 外框碰到的段。
// **在 maxM 內時，回傳值與 distanceToGeometryM 逐位相同**（同一投影、同一線段公式 distanceToFlatLineM、
// 同一射線法判斷面內）；超過 maxM 一律回 Infinity（呼叫端只用來判斷「超出範圍」）。

const CHUNK_POINTS = 32;
const BUCKET_DEG = 0.02;

interface GeoChunk { flat: Float64Array; w: number; s: number; e: number; n: number }
interface GeoPolygon { rings: number[][][]; w: number; s: number; e: number; n: number }

export interface GeometryIndex {
  chunks: GeoChunk[];
  polygons: GeoPolygon[];
  buckets: Map<number, number[]>;
  polyBuckets: Map<number, number[]>;
  stamp: Uint32Array;
  stampGen: number;
  empty: boolean;
}

const bucketKey = (bx: number, by: number) => bx * 100_003 + by;

function addToBuckets(map: Map<number, number[]>, idx: number, w: number, s: number, e: number, n: number): void {
  for (let bx = Math.floor(w / BUCKET_DEG); bx <= Math.floor(e / BUCKET_DEG); bx++) {
    for (let by = Math.floor(s / BUCKET_DEG); by <= Math.floor(n / BUCKET_DEG); by++) {
      const k = bucketKey(bx, by);
      const list = map.get(k);
      if (list) list.push(idx);
      else map.set(k, [idx]);
    }
  }
}

function chunkLine(coords: readonly (readonly number[])[], out: GeoChunk[]): void {
  if (coords.length === 0) return;
  for (let i0 = 0; ; i0 += CHUNK_POINTS - 1) {
    const i1 = Math.min(coords.length, i0 + CHUNK_POINTS);
    const flat = new Float64Array((i1 - i0) * 2);
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (let i = i0; i < i1; i++) {
      const x = coords[i]![0]!, y = coords[i]![1]!;
      flat[(i - i0) * 2] = x;
      flat[(i - i0) * 2 + 1] = y;
      if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
    }
    out.push({ flat, w, s, e, n });
    if (i1 >= coords.length) break;
  }
}

const indexCache = new WeakMap<object, GeometryIndex>();

/** 建索引（同一個幾何物件只建一次） */
export function geometryIndex(geometry: GeoJSON.Geometry): GeometryIndex {
  const hit = indexCache.get(geometry);
  if (hit) return hit;
  const chunks: GeoChunk[] = [];
  const polygons: GeoPolygon[] = [];
  const addPolygon = (rings: number[][][]) => {
    if (!rings.length) return;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const c of rings[0]!) { if (c[0]! < w) w = c[0]!; if (c[0]! > e) e = c[0]!; if (c[1]! < s) s = c[1]!; if (c[1]! > n) n = c[1]!; }
    polygons.push({ rings, w, s, e, n });
    for (const r of rings) chunkLine(r, chunks);
  };
  const walk = (g: GeoJSON.Geometry) => {
    switch (g.type) {
      case "Point": chunkLine([g.coordinates], chunks); break;
      case "MultiPoint": for (const c of g.coordinates) chunkLine([c], chunks); break;
      case "LineString": chunkLine(g.coordinates, chunks); break;
      case "MultiLineString": for (const l of g.coordinates) chunkLine(l, chunks); break;
      case "Polygon": addPolygon(g.coordinates); break;
      case "MultiPolygon": for (const p of g.coordinates) addPolygon(p); break;
      case "GeometryCollection": for (const x of g.geometries) walk(x); break;
    }
  };
  walk(geometry);
  const buckets = new Map<number, number[]>();
  chunks.forEach((c, i) => addToBuckets(buckets, i, c.w, c.s, c.e, c.n));
  const polyBuckets = new Map<number, number[]>();
  polygons.forEach((p, i) => addToBuckets(polyBuckets, i, p.w, p.s, p.e, p.n));
  const idx: GeometryIndex = { chunks, polygons, buckets, polyBuckets, stamp: new Uint32Array(chunks.length), stampGen: 0, empty: chunks.length === 0 };
  indexCache.set(geometry, idx);
  return idx;
}

/**
 * 到幾何的距離，只保證 ≤ maxM 時精確（與 distanceToGeometryM 逐位相同）；超過 → Infinity。
 * 幾何空或型別不支援 → null（同 distanceToGeometryM）。
 */
export function distanceToGeometryWithinM(geometry: GeoJSON.Geometry | null | undefined, lon: number, lat: number, maxM: number): number | null {
  if (!geometry) return null;
  const ix = geometryIndex(geometry);
  if (ix.empty) return null;
  const pr = project(lon, lat);
  // 面內＝0：只看外框含點的面（同 distToPolygon：在外環內且不在任何洞內）
  const pk = bucketKey(Math.floor(lon / BUCKET_DEG), Math.floor(lat / BUCKET_DEG));
  for (const pi of ix.polyBuckets.get(pk) ?? []) {
    const p = ix.polygons[pi]!;
    if (lon < p.w || lon > p.e || lat < p.s || lat > p.n) continue;
    const [outer, ...holes] = p.rings.map((r) => r.map(pr));
    if (outer && originInRing(outer) && !holes.some(originInRing)) return 0;
  }
  const padLat = (maxM / M_PER_DEG) * 1.001 + 1e-9;
  const padLon = (maxM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180))) * 1.001 + 1e-9;
  const w = lon - padLon, e = lon + padLon, s = lat - padLat, n = lat + padLat;
  const gen = ++ix.stampGen;
  let best = Infinity;
  for (let bx = Math.floor(w / BUCKET_DEG); bx <= Math.floor(e / BUCKET_DEG); bx++) {
    for (let by = Math.floor(s / BUCKET_DEG); by <= Math.floor(n / BUCKET_DEG); by++) {
      for (const ci of ix.buckets.get(bucketKey(bx, by)) ?? []) {
        if (ix.stamp[ci] === gen) continue;
        ix.stamp[ci] = gen;
        const c = ix.chunks[ci]!;
        if (c.e < w || c.w > e || c.n < s || c.s > n) continue;
        const d = distanceToFlatLineM(c.flat, lon, lat);
        if (d < best) best = d;
      }
    }
  }
  return best <= maxM ? best : Infinity;
}
