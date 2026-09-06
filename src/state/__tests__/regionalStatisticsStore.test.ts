import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadRegionalStatistics: vi.fn() }));
vi.mock('../../data/regionalStatisticsLoader', () => ({ loadRegionalStatistics: mocks.loadRegionalStatistics }));
import { regionalStatisticsStore } from '../regionalStatisticsStore';

const result = (id: string) => ({
  catalog: [], releases: [], sources: { publisher: id }, geometryManifest: {} as never,
  values: { release: { release_id: id } }, features: [{ type: 'Feature', properties: { id }, geometry: null }],
}) as never;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe('regionalStatisticsStore selection snapshots', () => {
  it('keeps independent keyed selections and stable completed snapshots', async () => {
    const a = 'stats-test-a'; const b = 'stats-test-b';
    regionalStatisticsStore.setSelection(a, { datasetId: 'waste', indicatorId: 'total', level: 'county' });
    regionalStatisticsStore.setSelection(b, { datasetId: 'waste', indicatorId: 'recycling', level: 'county' });
    mocks.loadRegionalStatistics.mockResolvedValueOnce(result('a')).mockResolvedValueOnce(result('b'));
    await Promise.all([regionalStatisticsStore.load(a), regionalStatisticsStore.load(b)]);
    expect(regionalStatisticsStore.getSnapshot(a)).toMatchObject({ selection: { indicatorId: 'total' }, loading: false, release: { release_id: 'a' } });
    expect(regionalStatisticsStore.getSnapshot(b)).toMatchObject({ selection: { indicatorId: 'recycling' }, loading: false, release: { release_id: 'b' } });
  });

  it('never lets a late request write after disable', async () => {
    const key = 'stats-test-disable'; const pending = deferred<never>();
    regionalStatisticsStore.setSelection(key, { datasetId: 'waste', indicatorId: 'total', level: 'county' });
    mocks.loadRegionalStatistics.mockReturnValueOnce(pending.promise);
    const work = regionalStatisticsStore.load(key);
    regionalStatisticsStore.disable(key);
    pending.resolve(result('late'));
    await work;
    expect(regionalStatisticsStore.getSnapshot(key)).toMatchObject({ loading: false, data: null, source: null, release: null });
  });

  it('never lets an older selection overwrite a newer one', async () => {
    const key = 'stats-test-newer'; const old = deferred<never>(); const current = deferred<never>();
    regionalStatisticsStore.setSelection(key, { datasetId: 'waste', indicatorId: 'old', level: 'county' });
    mocks.loadRegionalStatistics.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldWork = regionalStatisticsStore.load(key);
    regionalStatisticsStore.setSelection(key, { datasetId: 'waste', indicatorId: 'new', level: 'county', releaseId: 'r-new' });
    const currentWork = regionalStatisticsStore.load(key);
    current.resolve(result('new'));
    await currentWork;
    old.resolve(result('old'));
    await oldWork;
    expect(regionalStatisticsStore.getSnapshot(key)).toMatchObject({ selection: { indicatorId: 'new', releaseId: 'r-new' }, release: { release_id: 'new' } });
  });
});
