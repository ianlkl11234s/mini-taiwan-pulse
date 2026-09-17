import { describe, expect, it } from 'vitest';
import { statisticsColorStops } from '../statisticsColorScale';

describe('statisticsColorStops', () => {
  it('keeps the last colour at duplicate thresholds so Mapbox receives strictly increasing stops', () => {
    expect(statisticsColorStops([0, 0, 2, 12], ['c0', 'c1', 'c2', 'c3', 'c4'])).toEqual([
      { value: 0, color: 'c2' }, { value: 2, color: 'c3' }, { value: 12, color: 'c4' },
    ]);
    expect(statisticsColorStops([378, 378, 378, 378], ['c0', 'c1', 'c2', 'c3', 'c4'])).toEqual([
      { value: 378, color: 'c4' },
    ]);
  });

  it('rejects descending thresholds instead of emitting an invalid Mapbox step expression', () => {
    expect(() => statisticsColorStops([2, 1], ['c0', 'c1', 'c2'])).toThrow('non-decreasing');
  });
});
