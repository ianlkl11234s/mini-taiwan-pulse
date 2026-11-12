import { describe, expect, it } from 'vitest';
import { niceCeil, proportionalCircleRadius, proportionalLegendValues, statisticsCircleData } from '../statisticsCircles';

describe('statistics proportional circles', () => {
  it('reference rounds the max up to 1/2/2.5/5 × 10ⁿ', () => {
    expect(niceCeil(430)).toBe(500);
    expect(niceCeil(612_345)).toBe(1_000_000);
    expect(niceCeil(2_400)).toBe(2_500);
    expect(niceCeil(2_000)).toBe(2_000);
    expect(niceCeil(0)).toBeNull();
  });

  it('circle area is proportional to the value (radius ∝ √value)', () => {
    const big = proportionalCircleRadius(400, 400, 'township');
    const small = proportionalCircleRadius(100, 400, 'township');
    expect(big).toBe(20);
    expect((small / big) ** 2).toBeCloseTo(0.25);
    expect(proportionalCircleRadius(0, 400, 'township')).toBe(0);
  });

  it('legend uses three distinct rounded values, largest first', () => {
    expect(proportionalLegendValues(1_000_000)).toEqual([1_000_000, 200_000, 50_000]);
    expect(proportionalLegendValues(2_500)).toEqual([2_500, 500, 100]);
  });

  it('points sit inside each polygon (not a centroid outside a concave shape) and skip missing／zero', () => {
    // U 字形：幾何中心落在缺口（面外）
    const u: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]] };
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { area_code: 'U', value: 10, status: 'observed' }, geometry: u },
      { type: 'Feature', properties: { area_code: 'M', value: null, status: 'missing' }, geometry: u },
      { type: 'Feature', properties: { area_code: 'Z', value: 0, status: 'observed' }, geometry: u },
    ] };
    const { points, reference } = statisticsCircleData(data);
    expect(reference).toBe(10);
    expect(points.features.map((f) => f.properties?.area_code)).toEqual(['U']);
    const [x, y] = points.features[0]!.geometry.coordinates as [number, number];
    expect(x > 1 && x < 2 && y > 1 && y < 3).toBe(false);
    expect(statisticsCircleData(data)).toBe(statisticsCircleData(data));
  });
});
