/**
 * 量測工具的純計算與格式（design-system spec §5.44）。大地線：turf length／area（WGS84 球面）。
 * 不依賴 mapbox-gl，方便單元測試。
 */
import area from "@turf/area";
import length from "@turf/length";

export type LngLat = [number, number];
type NumberFormatter = (value: number, options?: Intl.NumberFormatOptions) => string;

function lineLengthMeters(a: LngLat, b: LngLat): number {
  return length({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [a, b] } }, { units: "kilometers" }) * 1000;
}

/** 每段長度與總長（公尺） */
export function measureDistance(points: LngLat[]): { segments: number[]; total: number } {
  const segments: number[] = [];
  for (let i = 1; i < points.length; i++) segments.push(lineLengthMeters(points[i - 1]!, points[i]!));
  return { segments, total: segments.reduce((sum, d) => sum + d, 0) };
}

/** 多邊形面積（m²）與周長（公尺，含收合段）；少於 3 點面積為 0 */
export function measureArea(points: LngLat[]): { area: number; perimeter: number } {
  if (points.length < 3) return { area: 0, perimeter: measureDistance(points).total };
  const ring: LngLat[] = [...points, points[0]!];
  return {
    area: area({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }),
    perimeter: measureDistance(ring).total,
  };
}

/** <1000 m 用 m（整數），否則 km（2 位小數）；單位前半形空白（spec §6.2） */
export function formatMeasureDistance(meters: number, formatNumber: NumberFormatter): string {
  if (meters < 1000) return `${formatNumber(Math.round(meters), { maximumFractionDigits: 0 })} m`;
  return `${formatNumber(meters / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}

/** <10,000 m² 用 m²（整數）；<1 km² 用公頃（1 位）；否則 km²（2 位） */
export function formatMeasureArea(squareMeters: number, formatNumber: NumberFormatter, hectareUnit: string): string {
  if (squareMeters < 10_000) return `${formatNumber(Math.round(squareMeters), { maximumFractionDigits: 0 })} m²`;
  if (squareMeters < 1_000_000) {
    return `${formatNumber(squareMeters / 10_000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${hectareUnit}`;
  }
  return `${formatNumber(squareMeters / 1_000_000, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km²`;
}

/** 多邊形標籤位置：頂點平均（量測多邊形通常是凸的，平均點足夠） */
export function polygonLabelPoint(points: LngLat[]): LngLat {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}
