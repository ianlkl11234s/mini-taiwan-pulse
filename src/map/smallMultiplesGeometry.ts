/**
 * 「多年份並排」地圖的邊界簡化（canvas 用，不開 Mapbox 地圖）。
 *
 * 邊界不另產檔：直接用主地圖同一份、SHA 校驗過的參考邊界（`statisticsGeometryCache`，主地圖開過就在記憶體），
 * 在前端投影到基準像素空間（預設寬 `BASE_WIDTH`，大圖另傳 `baseWidth`）並抽稀（相鄰點距離 < `TOLERANCE_PX` 就略過、
 * 外框小於 `MIN_RING_PX` 的小島略過）。同一個邊界版本＋基準寬只算一次，所有年份共用。
 *
 * 台灣層：固定本島視野（東沙、南沙、釣魚台不在範圍內，否則本島會縮得太小，見 `components/boot/taiwanOutline.ts`），
 * 金門、馬祖畫在左上角海面的插圖框（同比例尺，不另佔寬度）；落在本島框與插圖框之外的部件不畫，整區都沒畫到的區列進
 * `undrawnCodes` 由視窗說明，不默默略過。外國層：依全部部件的外框置中。
 */

export const BASE_WIDTH = 320;
const TOLERANCE_PX = 0.6;
const MIN_RING_PX = 0.8;

export interface LonLatBox { west: number; south: number; east: number; north: number }
export interface InsetFrame { id: 'kinmen' | 'matsu'; source: LonLatBox; target: LonLatBox }

/** 本島視野（含澎湖、綠島、蘭嶼、小琉球、龜山島、烏坵）。 */
export const TAIWAN_MAIN_BOX: LonLatBox = { west: 119.25, south: 21.85, east: 122.1, north: 25.35 };
/** 金門、馬祖：source＝真實位置，target＝畫在本島框左側海面的位置（同比例尺，左上角對齊）。 */
export const TAIWAN_INSETS: readonly InsetFrame[] = [
  // 左上角海面（臺灣海峽北段）：馬祖在上、金門在下；避開烏坵（119.45, 24.98）與澎湖（北界約 23.8）
  { id: 'matsu', source: { west: 119.85, south: 25.9, east: 120.56, north: 26.42 }, target: { west: 119.55, south: 24.8, east: 120.26, north: 25.32 } },
  { id: 'kinmen', source: { west: 118.1, south: 24.14, east: 118.55, north: 24.56 }, target: { west: 119.28, south: 24.32, east: 119.73, north: 24.74 } },
];
const TW_LEVELS = new Set(['county', 'township', 'village', 'prosecutor_district']);

export interface PreparedShape {
  areaCode: string;
  /** 基準像素空間的環（x0,y0,x1,y1…）；同一區的多個環以 even-odd 填 */
  rings: Float32Array[];
}
export interface PreparedBoundary {
  width: number;
  height: number;
  shapes: PreparedShape[];
  /** 插圖框（基準像素空間矩形），畫細框 */
  insetFrames: { x: number; y: number; w: number; h: number }[];
  /** 有邊界但一個部件都沒畫到的區（例：只在範圍外的島） */
  undrawnCodes: string[];
}

type Ring = readonly (readonly number[])[];
function polygonsOf(geometry: GeoJSON.Geometry | null | undefined): Ring[][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringCenter(ring: Ring): [number, number] {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [lon, lat] of ring) { if (lon! < west) west = lon!; if (lon! > east) east = lon!; if (lat! < south) south = lat!; if (lat! > north) north = lat!; }
  return [(west + east) / 2, (south + north) / 2];
}
const inside = (box: LonLatBox, [lon, lat]: [number, number]) => lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north;

/** 經緯度 → 基準像素（等距圓柱，經度乘中緯度 cos）。 */
function projector(box: LonLatBox, baseWidth: number) {
  const k = Math.cos(((box.south + box.north) / 2) * Math.PI / 180);
  const scale = baseWidth / ((box.east - box.west) * k);
  return {
    height: (box.north - box.south) * scale,
    point: (lon: number, lat: number): [number, number] => [(lon - box.west) * k * scale, (box.north - lat) * scale],
  };
}

function simplifyRing(ring: Ring, project: (lon: number, lat: number) => [number, number]): Float32Array | null {
  const out: number[] = [];
  let lastX = NaN, lastY = NaN;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const position of ring) {
    const [x, y] = project(position[0]!, position[1]!);
    if (out.length && Math.hypot(x - lastX, y - lastY) < TOLERANCE_PX) continue;
    out.push(x, y); lastX = x; lastY = y;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (out.length < 6 || Math.max(maxX - minX, maxY - minY) < MIN_RING_PX) return null;
  return Float32Array.from(out);
}

/**
 * 依層級把邊界投影＋抽稀成 canvas 用的形狀。`features` 需帶 `properties.area_code`。
 * `baseWidth`＝基準像素寬：大圖用較寬的基準，抽稀容差（固定 0.6 基準像素）相對變細，鄉鎮邊界放大不鋸齒。
 */
export function prepareSmallMultiplesBoundary(features: readonly GeoJSON.Feature[], level: string, baseWidth = BASE_WIDTH): PreparedBoundary {
  const taiwan = TW_LEVELS.has(level);
  let box = TAIWAN_MAIN_BOX;
  if (!taiwan) {
    box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
    for (const feature of features) for (const polygon of polygonsOf(feature.geometry)) for (const [lon, lat] of polygon[0] ?? []) {
      if (lon! < box.west) box.west = lon!; if (lon! > box.east) box.east = lon!;
      if (lat! < box.south) box.south = lat!; if (lat! > box.north) box.north = lat!;
    }
  }
  const { height, point } = projector(box, baseWidth);
  const insetProject = TAIWAN_INSETS.map(inset => ({
    inset,
    // 同比例尺平移：source 左上角對齊 target 左上角
    project: (lon: number, lat: number) => point(lon - inset.source.west + inset.target.west, lat - inset.source.north + inset.target.north),
  }));
  const shapes: PreparedShape[] = [];
  const undrawnCodes: string[] = [];
  for (const feature of features) {
    const areaCode = String(feature.properties?.area_code ?? '');
    const rings: Float32Array[] = [];
    for (const polygon of polygonsOf(feature.geometry)) {
      const outer = polygon[0];
      if (!outer?.length) continue;
      let project: ((lon: number, lat: number) => [number, number]) | null = point;
      if (taiwan) {
        const center = ringCenter(outer);
        project = inside(TAIWAN_MAIN_BOX, center) ? point : insetProject.find(item => inside(item.inset.source, center))?.project ?? null;
      }
      if (!project) continue;
      const simplifiedOuter = simplifyRing(outer, project);
      if (!simplifiedOuter) continue;
      rings.push(simplifiedOuter);
      for (const hole of polygon.slice(1)) { const simplified = simplifyRing(hole, project); if (simplified) rings.push(simplified); }
    }
    if (rings.length) shapes.push({ areaCode, rings }); else undrawnCodes.push(areaCode);
  }
  const insetFrames = taiwan ? TAIWAN_INSETS.map(({ target }) => {
    const [x0, y0] = point(target.west - 0.03, target.north + 0.03);
    const [x1, y1] = point(target.east + 0.03, target.south - 0.03);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }) : [];
  return { width: baseWidth, height, shapes, insetFrames, undrawnCodes };
}
