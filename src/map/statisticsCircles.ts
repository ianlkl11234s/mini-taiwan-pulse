/**
 * 統計比例圓（呈現方式＝比例圓；map-layers.md §3.10 K-6、spec §5.32 LG-5）。
 *
 * - **位置**：行政區的面內代表點（`interiorPoint.ts`，保證落在面內，不用可能掉到區外的幾何中心）；
 *   依幾何物件快取（邊界檔跨期別共用同一份幾何，換期別不重算）。
 * - **大小**：圓面積正比於數值（半徑 ∝ √值）。半徑是固定螢幕 px、不隨縮放（同 P-1／LG-5：圖例上的圓＝地圖上的圓）；
 *   拉近時行政區之間距離變大、圓就自然分開。最大半徑依行政層級（縣市 28／鄉鎮 20／村里 9 px）。
 * - **參考值**：本期觀測最大值往上取整到 1／2／2.5／5 × 10ⁿ（圓的最大半徑對應它）；換期別只有跨過取整級距才會縮放。
 * - 只畫「有觀測值、而且 > 0」的區：缺值與遮蔽保留原本的斜線面層（不畫成 0 大小），觀測值 0 不畫圓，圖例寫明。
 */
import { geometryInteriorPoint } from './interiorPoint';

/** 最大半徑（px）；其他層級（外國、統計區）目前不開放比例圓，給保守值 */
export const PROPORTIONAL_CIRCLE_MAX_RADIUS: Readonly<Record<string, number>> = { county: 28, township: 20, village: 9 };
const FALLBACK_MAX_RADIUS = 12;
export const proportionalCircleMaxRadius = (level: string) => PROPORTIONAL_CIRCLE_MAX_RADIUS[level] ?? FALLBACK_MAX_RADIUS;

/**
 * 比例圓樣式（暗／淡底）。單獨顯示＝實心（該指標色階最深一級、透明度＝滑桿）＋白色細邊，重疊時分得開；
 * 疊在其他統計面量圖上＝空心（只畫圈，不蓋掉底下的顏色）：主圈外再墊一圈反差色，落在任何色階上都看得到。
 */
export const PROPORTIONAL_CIRCLE = {
  fillStroke: { width: 1, color: { dark: 'rgba(255,255,255,0.85)', light: 'rgba(255,255,255,0.95)' } },
  ring: { width: 1.5, color: { dark: '#ffffff', light: '#1f2937' } },
  ringHalo: { width: 3.5, color: { dark: 'rgba(0,0,0,0.55)', light: 'rgba(255,255,255,0.8)' } },
} as const;

const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/** 往上取整到 1／2／2.5／5 × 10ⁿ（≤0 或非有限數回 null） */
export function niceCeil(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((s) => s * magnitude >= value * (1 - 1e-9)) ?? 10;
  return step * magnitude;
}

/** 往下取整到 1／2／5 × 10ⁿ（圖例參考圓用） */
function niceFloor(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [5, 2, 1].find((s) => s * magnitude <= value * (1 + 1e-9)) ?? 1;
  return step * magnitude;
}

/** 半徑（px）：面積正比於數值 */
export function proportionalCircleRadius(value: number, reference: number, level: string): number {
  if (!(value > 0) || !(reference > 0)) return 0;
  return proportionalCircleMaxRadius(level) * Math.sqrt(value / reference);
}

/** 圖例三個套疊圓的數值：參考值、約 1/4、約 1/20（取整；太小或重複的省略） */
export function proportionalLegendValues(reference: number): number[] {
  const values = [reference, niceFloor(reference / 4), niceFloor(reference / 20)];
  return values.filter((value, index) => value > 0 && values.indexOf(value) === index);
}

const interiorCache = new WeakMap<object, [number, number] | null>();
function cachedInteriorPoint(geometry: GeoJSON.Geometry | null): [number, number] | null {
  if (!geometry) return null;
  if (interiorCache.has(geometry)) return interiorCache.get(geometry)!;
  const point = geometryInteriorPoint(geometry);
  interiorCache.set(geometry, point);
  return point;
}

export interface StatisticsCircleData {
  /** 點（properties 與面相同 → popup、選取一致）；大的先畫、小的疊在上面 */
  points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  /** 最大半徑對應的數值；本期沒有任何 > 0 的觀測值時為 null（不畫圓） */
  reference: number | null;
}

const circleCache = new WeakMap<GeoJSON.FeatureCollection, StatisticsCircleData>();
const isPositiveObserved = (properties: GeoJSON.GeoJsonProperties) =>
  properties?.status === 'observed' && typeof properties.value === 'number' && Number.isFinite(properties.value) && properties.value > 0;

/** 面資料 → 比例圓點與參考值（依資料物件快取） */
export function statisticsCircleData(data: GeoJSON.FeatureCollection): StatisticsCircleData {
  const cached = circleCache.get(data);
  if (cached) return cached;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let max = 0;
  for (const feature of data.features) {
    if (!isPositiveObserved(feature.properties)) continue;
    const coordinates = cachedInteriorPoint(feature.geometry);
    if (!coordinates) continue;
    const value = feature.properties!.value as number;
    if (value > max) max = value;
    features.push({ type: 'Feature', ...(feature.id !== undefined ? { id: feature.id } : {}), geometry: { type: 'Point', coordinates }, properties: feature.properties });
  }
  features.sort((a, b) => (b.properties!.value as number) - (a.properties!.value as number));
  const result = { points: { type: 'FeatureCollection' as const, features }, reference: niceCeil(max) };
  circleCache.set(data, result);
  return result;
}

/** Mapbox circle-radius 表達式（與 `proportionalCircleRadius` 同一個公式） */
export function proportionalCircleRadiusExpression(reference: number, level: string): unknown[] {
  return ['*', proportionalCircleMaxRadius(level), ['sqrt', ['/', ['max', ['to-number', ['get', 'value'], 0], 0], reference]]];
}
