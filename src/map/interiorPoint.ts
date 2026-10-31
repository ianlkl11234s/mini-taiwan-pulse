/**
 * 面的代表點（§3.8 V-5，GeoJSON 面前端算）：保證落在面內（含洞外），不像面心可能掉進凹處或洞裡。
 * 做法：取面積最大的外環；在面心的緯度畫水平線，求與外環＋洞的交點，取最寬的「內部區間」中點。
 * 面心本身就在面內時直接用面心。
 */
type Ring = GeoJSON.Position[];

function ringArea2(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i]!; const q = ring[(i + 1) % ring.length]!;
    a += p[0]! * q[1]! - q[0]! * p[1]!;
  }
  return a;
}

function ringCentroid(ring: Ring): [number, number] | null {
  const a2 = ringArea2(ring);
  if (Math.abs(a2) < 1e-12) return null;
  let x = 0; let y = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i]!; const q = ring[(i + 1) % ring.length]!;
    const c = p[0]! * q[1]! - q[0]! * p[1]!;
    x += (p[0]! + q[0]!) * c; y += (p[1]! + q[1]!) * c;
  }
  return [x / (3 * a2), y / (3 * a2)];
}

function inRing(pt: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number]; const [xj, yj] = ring[j] as [number, number];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inPolygon = (pt: [number, number], rings: Ring[]): boolean =>
  rings.length > 0 && inRing(pt, rings[0]!) && !rings.slice(1).some((h) => inRing(pt, h));

function scanlinePoint(rings: Ring[], y: number): [number, number] | null {
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      const p = ring[i]!; const q = ring[(i + 1) % ring.length]!;
      if ((p[1]! > y) !== (q[1]! > y)) xs.push(p[0]! + ((y - p[1]!) * (q[0]! - p[0]!)) / (q[1]! - p[1]!));
    }
  }
  xs.sort((a, b) => a - b);
  let best: [number, number] | null = null; let bestW = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const w = xs[i + 1]! - xs[i]!;
    if (w > bestW) { bestW = w; best = [(xs[i]! + xs[i + 1]!) / 2, y]; }
  }
  return best;
}

function polygonInteriorPoint(rings: Ring[]): [number, number] | null {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const c = ringCentroid(outer);
  if (c && inPolygon(c, rings)) return c;
  const ys = outer.map((p) => p[1]!);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  // 面心緯度先試，再試外環包圍盒中緯度與上下四分位
  const lo = Math.min(...ys); const hi = Math.max(...ys);
  for (const y of [c?.[1] ?? mid, mid, lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75]) {
    const pt = scanlinePoint(rings, y);
    if (pt && inPolygon(pt, rings)) return pt;
  }
  return outer[0] ? [outer[0][0]!, outer[0][1]!] : null; // 最後退路：外環頂點（在邊界上，仍屬於面）
}

/** Polygon／MultiPolygon → 代表點（MultiPolygon 取面積最大的部件）；其他幾何回 null。 */
export function geometryInteriorPoint(geometry: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") return polygonInteriorPoint(geometry.coordinates);
  if (geometry.type !== "MultiPolygon") return null;
  const largest = geometry.coordinates
    .map((rings) => ({ rings, area: Math.abs(ringArea2(rings[0] ?? [])) }))
    .sort((a, b) => b.area - a.area)[0];
  return largest ? polygonInteriorPoint(largest.rings) : null;
}

/** 保留 feature id／properties，只轉面幾何；其他類型不猜、不補零。 */
export function polygonFeaturesToInteriorPoints(data: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const f of data.features) {
    const coordinates = geometryInteriorPoint(f.geometry);
    if (!coordinates) continue;
    features.push({
      type: "Feature", ...(f.id !== undefined ? { id: f.id } : {}),
      geometry: { type: "Point", coordinates }, properties: f.properties,
    });
  }
  return { type: "FeatureCollection", features };
}
