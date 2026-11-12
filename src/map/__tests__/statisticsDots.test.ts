import { describe, expect, it } from 'vitest';
import { DOT_BUDGET, dataDotUnit, dotCount, dotUnit, sampleDot, statisticsDotData, statisticsDotDataReady, statisticsDotDataSync } from '../statisticsDots';

// 方框 0..10 中間挖一個 4..6 的洞＋遠方一個小離島
const holed: GeoJSON.MultiPolygon = { type: 'MultiPolygon', coordinates: [
  [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
  [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]],
] };
const inHole = ([x, y]: number[]) => x! > 4 && x! < 6 && y! > 4 && y! < 6;
const inMain = ([x, y]: number[]) => x! >= 0 && x! <= 10 && y! >= 0 && y! <= 10;
const inIsland = ([x, y]: number[]) => x! >= 20 && x! <= 21 && y! >= 20 && y! <= 21;

function fc(features: { code: string; value: number | null; status?: string; geometry?: GeoJSON.Geometry }[]): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: features.map(({ code, value, status = 'observed', geometry = holed }) => ({ type: 'Feature', geometry, properties: { area_code: code, value, status } })) };
}

describe('statistics dot density', () => {
  it('unit is a readable 1／2／5 × 10ⁿ that keeps the map under the dot budget', () => {
    expect(dotUnit(23_400_000)).toBe(500);
    expect(dotUnit(23_400_000) * DOT_BUDGET).toBeGreaterThanOrEqual(23_400_000);
    expect(dotUnit(9_000_000)).toBe(200);
    expect(dotUnit(61_000)).toBe(2);
    expect(dotUnit(5_000)).toBe(1);
    expect(dotUnit(0)).toBe(1);
    // 總量小幅變動（人口逐年）不跨級距 → N 不變
    expect(dotUnit(23_100_000)).toBe(dotUnit(23_600_000));
  });

  it('remainders round up by a fixed per-area threshold: monotonic in value, small areas can still get a dot', () => {
    for (const code of ['A', '6300100', '1000201-001']) {
      let previous = 0;
      for (let value = 0; value <= 5_000; value += 37) {
        const count = dotCount(value, 500, code);
        expect(count).toBeGreaterThanOrEqual(previous);
        expect(count === Math.floor(value / 500) || count === Math.floor(value / 500) + 1).toBe(true);
        previous = count;
      }
    }
    // 不到一點的小區：約「值／N」比例的區會有一點（不會全部 0 點）
    const small = Array.from({ length: 2_000 }, (_, i) => dotCount(100, 500, `V${i}`));
    const share = small.filter((count) => count === 1).length / small.length;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.25);
    expect(dotCount(0, 500, 'A')).toBe(0);
    expect(dotCount(Number.NaN, 500, 'A')).toBe(0);
  });

  it('dots are deterministic per (area code, index), land inside the polygon, avoid holes, and use islands by area', () => {
    const points = Array.from({ length: 2_000 }, (_, i) => sampleDot(holed, 'X', i)!);
    expect(points.every((point) => (inMain(point) && !inHole(point)) || inIsland(point))).toBe(true);
    const island = points.filter(inIsland).length;
    // 離島面積 1／(100−4+1)≈1%
    expect(island).toBeGreaterThan(0);
    expect(island).toBeLessThan(60);
    // 同一區同一序號永遠同一點；不同區代碼點位不同
    expect(sampleDot(holed, 'X', 7)).toEqual(points[7]);
    expect(sampleDot({ ...holed }, 'X', 7)).toEqual(points[7]);
    expect(sampleDot(holed, 'Y', 7)).not.toEqual(points[7]);
  });

  it('changing period only adds or removes dots at the tail; missing／suppressed／zero areas get no dots', () => {
    const before = statisticsDotDataSync(fc([{ code: 'A', value: 3_000 }, { code: 'M', value: null, status: 'missing' }, { code: 'S', value: null, status: 'suppressed' }, { code: 'Z', value: 0 }]), 100);
    const after = statisticsDotDataSync(fc([{ code: 'A', value: 4_500 }, { code: 'M', value: null, status: 'missing' }]), 100);
    expect(before.dots.features.map((f) => f.properties?.area_code)).toEqual(['A']);
    expect(before.count).toBe(30);
    expect(after.count).toBe(45);
    expect(after.dots.features[0]!.geometry.coordinates.slice(0, 30)).toEqual(before.dots.features[0]!.geometry.coordinates);
    // 點只帶區代碼（點本身不是實際地點、不可點）
    expect(Object.keys(after.dots.features[0]!.properties ?? {})).toEqual(['area_code']);
  });

  it('unit comes from the data total and async results are cached per data object and unit', async () => {
    const data = fc([{ code: 'A', value: 90_000 }, { code: 'B', value: 30_000 }]);
    expect(dataDotUnit(data)).toBe(2);
    expect(statisticsDotDataReady(data, 2)).toBeUndefined();
    const first = statisticsDotData(data, 2);
    expect(statisticsDotData(data, 2)).toBe(first);
    const result = await first;
    expect(result.count).toBe(60_000);
    expect(statisticsDotDataReady(data, 2)).toBe(result);
  });
});
