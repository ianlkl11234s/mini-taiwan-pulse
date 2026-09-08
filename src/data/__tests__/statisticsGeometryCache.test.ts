import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { StatisticsGeometryCache, waitForGeometry } from '../statisticsGeometryCache';

const text = new TextEncoder();
const geometry = (code: string) => text.encode(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { area_code: code }, geometry: { type: 'Polygon', coordinates: [] } }] }));
async function manifest(resource: string, bytes: Uint8Array, suffix = '') {
  const sha256 = [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  return { resource, sha256, boundary_version: `v${suffix}`, level: 'county', code_scheme: 'area_code' };
}

describe('StatisticsGeometryCache', () => {
  it('does not retain a failed SHA validation', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const bytes = geometry('A');
    const item = { ...(await manifest('https://geometry.test/a', bytes)), sha256: 'bad' };
    const fetcher = vi.fn(async () => bytes.buffer.slice(0));
    const cache = new StatisticsGeometryCache();
    await expect(cache.load(item, fetcher)).rejects.toThrow('邊界檔案版本校驗失敗');
    await expect(cache.load(item, fetcher)).rejects.toThrow('邊界檔案版本校驗失敗');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('allows one caller to abort without cancelling an in-flight shared fetch', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const bytes = geometry('A');
    const item = await manifest('https://geometry.test/a', bytes);
    let resolve!: (value: ArrayBuffer) => void;
    const pending = new Promise<ArrayBuffer>(r => { resolve = r; });
    const cache = new StatisticsGeometryCache();
    const shared = cache.load(item, () => pending);
    const controller = new AbortController();
    const aborted = waitForGeometry(shared, controller.signal);
    controller.abort();
    await expect(aborted).rejects.toBeDefined();
    resolve(bytes.buffer.slice(0));
    await expect(shared).resolves.toMatchObject({ features: [{ properties: { area_code: 'A' } }] });
  });

  it('evicts the least-recent immutable boundary at its entry limit', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const cache = new StatisticsGeometryCache(2);
    const first = geometry('A'); const second = geometry('B'); const third = geometry('C');
    const one = await manifest('https://geometry.test/a', first, '1');
    const two = await manifest('https://geometry.test/b', second, '2');
    const three = await manifest('https://geometry.test/c', third, '3');
    const reload = vi.fn(async () => first.buffer.slice(0));
    await cache.load(one, reload); await cache.load(two, async () => second.buffer.slice(0)); await cache.load(three, async () => third.buffer.slice(0));
    await cache.load(one, reload);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);
  });

  it('shares immutable geometry across boundary-version aliases with identical mapping', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const bytes = geometry('A');
    const cache = new StatisticsGeometryCache();
    const first = await manifest('https://geometry.test/a', bytes, '1');
    const second = await manifest('https://geometry.test/a', bytes, '2');
    const fetcher = vi.fn(async () => bytes.buffer.slice(0));
    const firstLoad = cache.load(first, fetcher);
    const secondLoad = cache.load(second, fetcher);
    expect(secondLoad).toBe(firstLoad);
    await firstLoad;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('normalizes a declared delivery code property only after SHA verification', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const bytes = text.encode(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { TOWNCODE: '09007010' }, geometry: { type: 'Polygon', coordinates: [] } }] }));
    const item = { ...(await manifest('https://geometry.test/township', bytes)), code_property: 'TOWNCODE', code_scheme: 'TOWNCODE' };
    const cache = new StatisticsGeometryCache();
    await expect(cache.load(item, async () => bytes.buffer.slice(0))).resolves.toMatchObject({ features: [{ properties: { TOWNCODE: '09007010', area_code: '09007010' } }] });
  });
  it('bounds pending entries and does not retain a completed boundary beyond the total budget', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const bytes = geometry('A');
    const cache = new StatisticsGeometryCache(2, 1);
    const promises: Promise<unknown>[] = [];
    let resolve!: (value: ArrayBuffer) => void;
    const pending = new Promise<ArrayBuffer>(done => { resolve = done; });
    for (let i = 0; i < 4; i++) {
      promises.push(cache.load(await manifest(`https://geometry.test/${i}`, bytes), () => pending));
      expect(cache.size).toBeLessThanOrEqual(2);
    }
    resolve(bytes.buffer.slice(0));
    await Promise.all(promises);
    expect(cache.size).toBe(0);
    expect(cache.byteLength).toBe(0);
  });

  it('evicts least-recent completed boundaries against a total raw-byte budget', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const first = geometry('A'); const second = geometry('B');
    const cache = new StatisticsGeometryCache(8, first.byteLength + second.byteLength - 1);
    const one = await manifest('https://geometry.test/a', first, '1');
    const two = await manifest('https://geometry.test/b', second, '2');
    const reload = vi.fn(async () => first.buffer.slice(0));

    await cache.load(one, reload);
    await cache.load(two, async () => second.buffer.slice(0));
    expect(cache.size).toBe(1);
    expect(cache.byteLength).toBe(second.byteLength);

    await cache.load(one, reload);
    expect(reload).toHaveBeenCalledTimes(2);
  });

});
