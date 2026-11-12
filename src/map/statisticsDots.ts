/**
 * 統計點密度（呈現方式＝點密度；map-layers.md §3.10 K-6、statistics-layer-guidelines §7）。
 *
 * - **一點代表 N 個單位**：N＝本期全圖總量 ÷ 點數上限，往上取到 1／2／5 × 10ⁿ（`dotUnit`），所以全圖點數 ≤ 上限；
 *   只由目前資料決定（重新整理、分享網址看到的點數一樣），比較模式左右取較大的 N（`compareDotUnit`）。
 *   人口這類總量逐年變化小，換期別通常不會跨級距，N 不變；跨級距時 N 才換（圖例寫明本期的 N）。
 * - **各區點數**：值 ÷ N 的整數部分，加上「餘數 > 該區固定門檻 u」再多一點（`dotCount`）。u 由區代碼雜湊決定、
 *   不隨期別變 → 點數對值單調（值變大只會多點），小區也有機會分到一點，不會永遠 0 點。
 * - **點位**：第 i 點只由「區代碼＋i」的種子決定（`sampleDot`）：依面積選一塊面（含離島），在那塊面的外框內均勻
 *   取點、落在面內（扣掉洞）才收。平移、縮放、換期別、重新整理都不會跳；換期別只增減尾端的點。
 *   經緯度均勻取點，臺灣範圍內一區之內的面積誤差可忽略（cos 緯度差 < 1%）。
 * - 只撒「有觀測值、而且 > 0」的區；缺值與遮蔽不撒點，保留原本的斜線面層（不當 0）。
 * - 計算分批（每片約 `SLICE_MS`），不長時間卡住主執行緒；同一份資料＋N 只算一次（快取跟著資料物件）。
 */
import { geometryInteriorPoint } from './interiorPoint';

/** 全圖點數上限（每張地圖）；2026-11-12 量測：鄉鎮人口 4.6 萬點，計算約 180 ms（分批），平移幀率與不開點時相同 */
export const DOT_BUDGET = 60_000;
const DOT_STEPS = [1, 2, 5, 10] as const;
/** 每片計算的時間上限（ms），超過就讓出主執行緒 */
const SLICE_MS = 12;
/** 一點取樣最多試幾次（落在洞裡或面外就重試）；用完退回面內代表點 */
const MAX_TRIES = 64;

/** 點密度樣式：點的大小隨縮放微調；底下淡淡的行政區邊界線（顏色用 `BOUNDARY_GRAY`）。 */
export const DOT_STYLE = {
  radius: [[5, 0.6], [8, 1], [11, 1.6], [14, 2.4]] as const,
  boundaryOpacity: { dark: 0.28, light: 0.22 },
  boundaryWidth: 0.6,
} as const;

/** 一點代表幾個單位：總量 ÷ 上限往上取到 1／2／5 × 10ⁿ（至少 1）。 */
export function dotUnit(total: number, budget = DOT_BUDGET): number {
  if (!Number.isFinite(total) || total <= 0 || !(budget > 0)) return 1;
  const raw = total / budget;
  if (raw <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = DOT_STEPS.find((s) => s * magnitude >= raw * (1 - 1e-9)) ?? 10;
  return step * magnitude;
}

/** FNV-1a 字串雜湊＋整數混合（32 bit）；同輸入永遠同輸出 */
export function hashSeed(code: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i += 1) { h ^= code.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= n + 0x9e3779b9 + (h << 6) + (h >>> 2);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32：由種子產生 [0,1) 亂數序列 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 餘數進位門檻用的種子序號（與點位的 0..n 分開） */
const REMAINDER_SALT = -1;

/** 各區點數：整數部分＋（餘數 > 區代碼固定門檻 ? 1 : 0）。非正值、非有限數回 0。 */
export function dotCount(value: number, unit: number, code: string): number {
  if (!Number.isFinite(value) || value <= 0 || !(unit > 0)) return 0;
  const ratio = value / unit;
  const whole = Math.floor(ratio);
  const remainder = ratio - whole;
  return whole + (remainder > rng(hashSeed(code, REMAINDER_SALT))() ? 1 : 0);
}

const isPositiveObserved = (properties: GeoJSON.GeoJsonProperties) =>
  properties?.status === 'observed' && typeof properties.value === 'number' && Number.isFinite(properties.value) && properties.value > 0;

/** 本期全圖總量（只算有觀測值、> 0 的區） */
export function dotTotal(data: GeoJSON.FeatureCollection): number {
  let total = 0;
  for (const feature of data.features) if (isPositiveObserved(feature.properties)) total += feature.properties!.value as number;
  return total;
}

const unitCache = new WeakMap<GeoJSON.FeatureCollection, number>();
/** 這份資料自己的 N（依資料物件快取） */
export function dataDotUnit(data: GeoJSON.FeatureCollection): number {
  let unit = unitCache.get(data);
  if (unit === undefined) { unit = dotUnit(dotTotal(data)); unitCache.set(data, unit); }
  return unit;
}

// ── 面內取樣 ────────────────────────────────────────────────────────────────

interface SamplerPart {
  minX: number; minY: number; maxX: number; maxY: number;
  /** 所有環的邊（x1,y1,x2,y2 連續存放） */
  edges: Float64Array;
  /** 水平帶索引（CSR）：帶 b 的邊＝bandEdges[bandStart[b] .. bandStart[b+1]) */
  bands: number; bandStart: Int32Array; bandEdges: Int32Array;
}
interface Sampler { parts: SamplerPart[]; cumulative: number[]; fallback: [number, number] | null }

function ringSignedArea(ring: GeoJSON.Position[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i]!; const q = ring[(i + 1) % ring.length]!;
    a += p[0]! * q[1]! - q[0]! * p[1]!;
  }
  return a / 2;
}

function buildPart(rings: GeoJSON.Position[][]): { part: SamplerPart; area: number } | null {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  let edgeCount = 0;
  for (const ring of rings) {
    edgeCount += ring.length;
    for (const p of ring) {
      if (p[0]! < minX) minX = p[0]!; if (p[0]! > maxX) maxX = p[0]!;
      if (p[1]! < minY) minY = p[1]!; if (p[1]! > maxY) maxY = p[1]!;
    }
  }
  if (!(maxX > minX) || !(maxY > minY) || !rings[0] || rings[0].length < 3) return null;
  const outer = Math.abs(ringSignedArea(rings[0]));
  const holes = rings.slice(1).reduce((sum, ring) => sum + Math.abs(ringSignedArea(ring)), 0);
  const area = Math.max(0, outer - holes) * Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  if (!(area > 0)) return null;
  const edges = new Float64Array(edgeCount * 4);
  let e = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      const p = ring[i]!; const q = ring[(i + 1) % ring.length]!;
      edges[e++] = p[0]!; edges[e++] = p[1]!; edges[e++] = q[0]!; edges[e++] = q[1]!;
    }
  }
  const bands = Math.max(1, Math.min(512, Math.ceil(Math.sqrt(edgeCount))));
  const height = maxY - minY;
  const bandOf = (y: number) => Math.min(bands - 1, Math.max(0, Math.floor(((y - minY) / height) * bands)));
  const counts = new Int32Array(bands + 1);
  for (let i = 0; i < edgeCount; i += 1) {
    const y1 = edges[i * 4 + 1]!; const y2 = edges[i * 4 + 3]!;
    if (y1 === y2) continue;
    for (let b = bandOf(Math.min(y1, y2)); b <= bandOf(Math.max(y1, y2)); b += 1) counts[b + 1]! += 1;
  }
  for (let b = 0; b < bands; b += 1) counts[b + 1]! += counts[b]!;
  const bandStart = counts.slice();
  const fill = counts.slice(0, bands);
  const bandEdges = new Int32Array(bandStart[bands]!);
  for (let i = 0; i < edgeCount; i += 1) {
    const y1 = edges[i * 4 + 1]!; const y2 = edges[i * 4 + 3]!;
    if (y1 === y2) continue;
    for (let b = bandOf(Math.min(y1, y2)); b <= bandOf(Math.max(y1, y2)); b += 1) bandEdges[fill[b]!++] = i;
  }
  return { part: { minX, minY, maxX, maxY, edges, bands, bandStart, bandEdges }, area };
}

/** 奇偶規則（外環＋洞一起算）：只檢查 y 所在水平帶的邊 */
function insidePart(part: SamplerPart, x: number, y: number): boolean {
  const b = Math.min(part.bands - 1, Math.max(0, Math.floor(((y - part.minY) / (part.maxY - part.minY)) * part.bands)));
  let inside = false;
  const { edges, bandEdges } = part;
  for (let k = part.bandStart[b]!; k < part.bandStart[b + 1]!; k += 1) {
    const i = bandEdges[k]! * 4;
    const y1 = edges[i + 1]!; const y2 = edges[i + 3]!;
    if ((y1 > y) === (y2 > y)) continue;
    const x1 = edges[i]!; const x2 = edges[i + 2]!;
    if (x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function buildSampler(geometry: GeoJSON.Geometry): Sampler | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  const parts: SamplerPart[] = [];
  const cumulative: number[] = [];
  let total = 0;
  for (const rings of polygons) {
    const built = buildPart(rings);
    if (!built) continue;
    total += built.area;
    parts.push(built.part);
    cumulative.push(total);
  }
  if (!parts.length) return null;
  return { parts, cumulative: cumulative.map((value) => value / total), fallback: geometryInteriorPoint(geometry) };
}

/** 第 index 點（只由區代碼＋序號決定）；取不到回面內代表點 */
function sampleWith(sampler: Sampler, code: string, index: number): [number, number] | null {
  const random = rng(hashSeed(code, index));
  const pick = random();
  let lo = 0; let hi = sampler.cumulative.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sampler.cumulative[mid]! > pick) hi = mid; else lo = mid + 1; }
  const part = sampler.parts[lo]!;
  for (let t = 0; t < MAX_TRIES; t += 1) {
    const x = part.minX + random() * (part.maxX - part.minX);
    const y = part.minY + random() * (part.maxY - part.minY);
    if (insidePart(part, x, y)) return [x, y];
  }
  return sampler.fallback;
}

const samplerCache = new WeakMap<object, Sampler | null>();
function cachedSampler(geometry: GeoJSON.Geometry): Sampler | null {
  if (samplerCache.has(geometry)) return samplerCache.get(geometry)!;
  const sampler = buildSampler(geometry);
  samplerCache.set(geometry, sampler);
  return sampler;
}

/** 單點取樣（測試與工具用；地圖走 `statisticsDotData`，有快取） */
export function sampleDot(geometry: GeoJSON.Geometry, code: string, index: number): [number, number] | null {
  const sampler = cachedSampler(geometry);
  return sampler ? sampleWith(sampler, code, index) : null;
}

/** 已算好的點位（依幾何物件＋區代碼快取；只會往後補，換期別多出來的點才算） */
const pointCache = new WeakMap<object, { code: string; points: number[][] }>();
function cachedPoints(geometry: GeoJSON.Geometry, code: string, count: number): number[][] {
  let entry = pointCache.get(geometry);
  if (!entry || entry.code !== code) { entry = { code, points: [] }; pointCache.set(geometry, entry); }
  if (entry.points.length < count) {
    const sampler = cachedSampler(geometry);
    if (!sampler) return [];
    for (let i = entry.points.length; i < count; i += 1) {
      const point = sampleWith(sampler, code, i);
      if (!point) break;
      entry.points.push(point);
    }
  }
  // 一律複製：快取陣列之後會被別的期別往後補，已發出去的結果不能跟著變
  return entry.points.slice(0, count);
}

export interface StatisticsDotData {
  /** 每區一個 MultiPoint（properties 只留區代碼，點本身不可點） */
  dots: GeoJSON.FeatureCollection<GeoJSON.MultiPoint>;
  unit: number;
  count: number;
  /** 計算耗時（ms，含讓出主執行緒的等待） */
  elapsedMs: number;
}

/** 逐區產生；每區結束時 yield（讓 async 版分批） */
function* dotGenerator(data: GeoJSON.FeatureCollection, unit: number): Generator<void, Omit<StatisticsDotData, 'elapsedMs'>> {
  const features: GeoJSON.Feature<GeoJSON.MultiPoint>[] = [];
  let count = 0;
  for (const feature of data.features) {
    const properties = feature.properties;
    if (!feature.geometry || !isPositiveObserved(properties) || typeof properties!.area_code !== 'string') continue;
    const code = properties!.area_code as string;
    const n = dotCount(properties!.value as number, unit, code);
    if (n > 0) {
      const coordinates = cachedPoints(feature.geometry, code, n);
      if (coordinates.length) {
        count += coordinates.length;
        features.push({ type: 'Feature', geometry: { type: 'MultiPoint', coordinates }, properties: { area_code: code } });
      }
    }
    yield;
  }
  return { dots: { type: 'FeatureCollection', features }, unit, count };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** 同步版（測試用） */
export function statisticsDotDataSync(data: GeoJSON.FeatureCollection, unit = dataDotUnit(data)): StatisticsDotData {
  const start = now();
  const generator = dotGenerator(data, unit);
  let step = generator.next();
  while (!step.done) step = generator.next();
  return { ...step.value, elapsedMs: now() - start };
}

const dotCache = new WeakMap<GeoJSON.FeatureCollection, Map<number, Promise<StatisticsDotData>>>();
const doneCache = new WeakMap<GeoJSON.FeatureCollection, Map<number, StatisticsDotData>>();

/** 已算好的結果（沒有＝還沒算或算到一半） */
export function statisticsDotDataReady(data: GeoJSON.FeatureCollection, unit: number): StatisticsDotData | undefined {
  return doneCache.get(data)?.get(unit);
}

/** 分批計算（每片 ≤ SLICE_MS 就讓出主執行緒）；同一份資料＋N 共用同一個 Promise。 */
export function statisticsDotData(data: GeoJSON.FeatureCollection, unit: number): Promise<StatisticsDotData> {
  let byUnit = dotCache.get(data);
  if (!byUnit) { byUnit = new Map(); dotCache.set(data, byUnit); }
  const cached = byUnit.get(unit);
  if (cached) return cached;
  const promise = (async () => {
    const start = now();
    const generator = dotGenerator(data, unit);
    let slice = now();
    let step = generator.next();
    while (!step.done) {
      if (now() - slice > SLICE_MS) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        slice = now();
      }
      step = generator.next();
    }
    const result = { ...step.value, elapsedMs: now() - start };
    let done = doneCache.get(data);
    if (!done) { done = new Map(); doneCache.set(data, done); }
    done.set(unit, result);
    return result;
  })();
  byUnit.set(unit, promise);
  return promise;
}

/**
 * Mapbox circle-radius：隨縮放微調（R2「點半徑固定」的明文例外，map-layers.md §3.10）：點密度的點是「量」不是地點，
 * 全國視角好幾萬點要小到不糊成一片、拉近時要大到看得見；一般點圖層仍照 R2 固定分階。
 */
export function statisticsDotRadius(): unknown[] {
  return ['interpolate', ['linear'], ['zoom'], ...DOT_STYLE.radius.flat()];
}
