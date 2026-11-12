import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadRegionalStatistics: vi.fn() }));
vi.mock('../../data/regionalStatisticsLoader', () => ({ loadRegionalStatistics: mocks.loadRegionalStatistics }));
import { regionalStatisticsStore } from '../regionalStatisticsStore';
import { compareStore } from '../compareStore';
import { compareDotUnit, compareSplitActive, legendScaleDiffers, rightReadKey, setCompareSide, startRightSelectionSync, statisticsRightStoreKey } from '../compareStatistics';

const KEY = 'statsBirthsTownship';
const RIGHT = statisticsRightStoreKey(KEY);
const base = { datasetId: 'village_births_township_monthly', indicatorId: 'birth_count', level: 'township' as const };

describe('比較模式統計：左右選擇', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); }, removeItem: (k: string) => { storage.delete(k); } });
    compareStore.reset();
    regionalStatisticsStore.setSelection(KEY, { ...base, releaseId: 'L' });
    regionalStatisticsStore.setSelection(RIGHT, null);
  });
  afterEach(() => { compareStore.reset(); vi.unstubAllGlobals(); });

  it('右側沒另選＝讀左側；選了才讀 key::R、才算分左右', () => {
    compareStore.setEnabled(true);
    expect(rightReadKey(KEY)).toBe(KEY);
    expect(compareSplitActive(KEY)).toBe(false);
    regionalStatisticsStore.setSelection(RIGHT, { ...base, releaseId: 'R' });
    expect(rightReadKey(KEY)).toBe(RIGHT);
    expect(compareSplitActive(KEY)).toBe(true);
    compareStore.setSide(KEY, 'left');
    expect(rightReadKey(KEY)).toBe(KEY);
    expect(compareSplitActive(KEY)).toBe(false);
  });

  it('點密度「一點＝N」：左右期別不同時兩側共用較大的 N；沒分左右回 undefined', async () => {
    const result = (total: number) => ({ catalog: [], releases: [], values: { release: null }, sources: {}, health: null,
      features: [{ type: 'Feature', geometry: null, properties: { area_code: 'A', status: 'observed', value: total } }] });
    mocks.loadRegionalStatistics.mockImplementation(async (recipe: { releaseId?: string }) => result(recipe.releaseId === 'R' ? 600_000 : 23_000_000));
    compareStore.setEnabled(true);
    await regionalStatisticsStore.load(KEY);
    expect(compareDotUnit(KEY, 500)).toBeUndefined();
    regionalStatisticsStore.setSelection(RIGHT, { ...base, releaseId: 'R' });
    await regionalStatisticsStore.load(RIGHT);
    // 左 2,300 萬→500、右 60 萬→10：兩側都用 500
    expect(compareDotUnit(KEY, 10)).toBe(500);
    expect(compareDotUnit(KEY, 500)).toBe(500);
  });

  it('改成「只在右側」時右側的期別搬回左側，畫面不跳期別', () => {
    compareStore.setEnabled(true);
    regionalStatisticsStore.setSelection(RIGHT, { ...base, releaseId: 'R' });
    setCompareSide(KEY, 'right');
    expect(compareStore.getSnapshot().sides[KEY]).toBe('right');
    expect(regionalStatisticsStore.getSnapshot(KEY).selection?.releaseId).toBe('R');
    expect(regionalStatisticsStore.getSnapshot(RIGHT).selection).toBeNull();
  });

  it('左側換指標 → 丟掉右側選擇（右側不能是不同指標）', () => {
    regionalStatisticsStore.setSelection(RIGHT, { ...base, releaseId: 'R' });
    const stop = startRightSelectionSync();
    expect(regionalStatisticsStore.getSnapshot(RIGHT).selection?.releaseId).toBe('R');
    regionalStatisticsStore.setSelection(KEY, { ...base, indicatorId: 'other', releaseId: 'L' });
    expect(regionalStatisticsStore.getSnapshot(RIGHT).selection).toBeNull();
    stop();
  });

  it('圖例只在色階門檻或配色不同時拆兩份', () => {
    const a = { breaks: [1, 2], colors: ['#000', '#111', '#222'] };
    expect(legendScaleDiffers(a, { ...a })).toBe(false);
    expect(legendScaleDiffers(a, { ...a, breaks: [1, 3] })).toBe(true);
    expect(legendScaleDiffers(a, { ...a, colors: ['#000', '#111', '#333'] })).toBe(true);
  });
});
