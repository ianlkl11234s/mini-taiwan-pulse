import { describe, expect, it } from 'vitest';
import { BASE_WIDTH, prepareSmallMultiplesBoundary } from '../smallMultiplesGeometry';

const square = (lon: number, lat: number, size: number): number[][] => [[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]];
const feature = (code: string, polygons: number[][][][]): GeoJSON.Feature => ({ type: 'Feature', properties: { area_code: code }, geometry: { type: 'MultiPolygon', coordinates: polygons } });

describe('prepareSmallMultiplesBoundary', () => {
  it('台灣層：本島固定視野，金門、馬祖移進插圖框；範圍外的部件不畫，整區沒畫到的列出來', () => {
    const prepared = prepareSmallMultiplesBoundary([
      feature('63000', [[square(121.4, 25.0, 0.2)]]),
      feature('09020', [[square(118.3, 24.4, 0.1)]]),
      feature('09007', [[square(119.9, 26.1, 0.1)]]),
      // 旗津區：本島部件＋太平島（範圍外，略過）
      feature('64000100', [[square(120.27, 22.6, 0.05)], [square(114.36, 10.37, 0.05)]]),
      feature('X', [[square(116.7, 20.7, 0.05)]]),
    ], 'township');
    expect(prepared.width).toBe(BASE_WIDTH);
    expect(prepared.shapes.map(s => s.areaCode)).toEqual(['63000', '09020', '09007', '64000100']);
    expect(prepared.shapes.find(s => s.areaCode === '64000100')!.rings).toHaveLength(1);
    expect(prepared.undrawnCodes).toEqual(['X']);
    expect(prepared.insetFrames).toHaveLength(2);
    // 插圖框內的點都落在小圖範圍內
    for (const shape of prepared.shapes) for (const ring of shape.rings) for (let i = 0; i < ring.length; i += 2) {
      expect(ring[i]).toBeGreaterThanOrEqual(0);
      expect(ring[i]).toBeLessThanOrEqual(BASE_WIDTH);
      expect(ring[i + 1]).toBeGreaterThanOrEqual(0);
      expect(ring[i + 1]).toBeLessThanOrEqual(prepared.height);
    }
  });

  it('抽稀：相鄰太近的點略過、太小的島略過', () => {
    const dense: number[][] = [];
    for (let i = 0; i <= 400; i += 1) dense.push([121 + (i / 400) * 0.5, 23.5]);
    dense.push([121.5, 24], [121, 24], [121, 23.5]);
    const prepared = prepareSmallMultiplesBoundary([feature('A', [[dense], [square(121.8, 22.5, 0.0005)]])], 'county');
    expect(prepared.shapes[0]!.rings).toHaveLength(1);
    expect(prepared.shapes[0]!.rings[0]!.length / 2).toBeLessThan(120);
  });

  it('外國層：依全部部件外框置中', () => {
    const prepared = prepareSmallMultiplesBoundary([feature('A', [[square(-3, 51, 1)]]), feature('B', [[square(-1, 53, 1)]])], 'gb_lad');
    expect(prepared.insetFrames).toEqual([]);
    expect(prepared.shapes).toHaveLength(2);
    expect(prepared.height).toBeGreaterThan(BASE_WIDTH);
  });
});
