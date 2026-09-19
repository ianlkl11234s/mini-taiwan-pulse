import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HistoricalFlightCollection } from '../historicalFlightTrailsTypes';
import { clearHistoricalFlightCache, fetchHistoricalFlightAsset, fetchHistoricalFlightManifest,
  fetchHistoricalFlightAllAirports, historicalFlightAssetPath, parseHistoricalFlightManifest, parseHistoricalFlightCollection } from '../historicalFlightTrailsLoader';

const collection = () => ({ type: 'FeatureCollection', meta: { country: 'TW', airport: 'RCTP', date: '2026-03-10' },
  features: [{ type: 'Feature', properties: { flight_id: 'abc', roles: ['arrival'], route_scope: 'cross_border' },
    geometry: { type: 'MultiLineString', coordinates: [[[121, 25, 123.456], [121.00001, 25.00001, 125]]] } }] });
const manifest = () => ({ schema: 'historical-flight-trails-v1', release_id: 'local-1',
  airports: [{ country: 'TW', icao: 'RCTP', name: '桃園', center: [121, 25], timezone: 'Asia/Taipei' }],
  samples: [{ country: 'TW', airport: 'RCTP', date: '2026-03-10', sample_kind: 'weekday', label: '工作日',
    asset: null, flight_count: 0, point_count: 0, coverage: 'unavailable', note: '尚無軌跡' }] });
async function assetFor(value: unknown) {
  const text = JSON.stringify(value), bytes = new TextEncoder().encode(text);
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  return { text, asset: { path: 'releases/local-1/tw_RCTP_2026-03-10.geojson', bytes: bytes.length, sha256 } };
}
afterEach(() => { clearHistoricalFlightCache(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('historical static flight delivery', () => {
  it('keeps unavailable distinct from a successful zero-flight day', () => {
    expect(parseHistoricalFlightManifest(manifest()).samples[0]?.coverage).toBe('unavailable');
    const bad = manifest(); bad.samples[0]!.coverage = 'partial';
    expect(() => parseHistoricalFlightManifest(bad)).toThrow('缺值');
  });
  it('rejects duplicate selectors and invalid timezones', () => {
    const m = manifest(); m.samples.push(m.samples[0]!);
    expect(() => parseHistoricalFlightManifest(m)).toThrow();
    const n = manifest(); n.airports[0]!.timezone = 'UTC';
    expect(() => parseHistoricalFlightManifest(n)).toThrow();
  });
  it.each(['../secret.geojson', 'https://other.test/x.geojson', 'releases/x/../../a.geojson', 'releases/x/a.geojson?token=x'])('rejects escaping path %s', path => {
    expect(() => historicalFlightAssetPath(path)).toThrow();
  });
  it('preserves sub-metre vertices and altitude without simplification', () => {
    const c = collection(); expect(parseHistoricalFlightCollection(c)).toBe(c);
    expect(c.features[0]!.geometry.coordinates[0]![1]).toEqual([121.00001, 25.00001, 125]);
  });
  it('rejects malformed geometry and duplicated flights', () => {
    const c = collection(); c.features.push(c.features[0]!);
    expect(() => parseHistoricalFlightCollection(c)).toThrow();
    const d = collection(); d.features[0]!.geometry.coordinates[0]![0]![0] = 500;
    expect(() => parseHistoricalFlightCollection(d)).toThrow('座標');
  });
  it('deduplicates concurrent requests and repeated toggles', async () => {
    const { text, asset } = await assetFor(collection());
    const fetcher = vi.fn(async () => new Response(text)); vi.stubGlobal('fetch', fetcher);
    const [a, b] = await Promise.all([fetchHistoricalFlightAsset(asset), fetchHistoricalFlightAsset(asset)]);
    expect(a).toBe(b); expect(await fetchHistoricalFlightAsset(asset)).toBe(a);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('verifies exact bytes/hash before parsing and does not cache failure', async () => {
    const { text, asset } = await assetFor(collection());
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(text + ' ')).mockResolvedValueOnce(new Response(text));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchHistoricalFlightAsset(asset)).rejects.toThrow('完整性');
    await expect(fetchHistoricalFlightAsset(asset)).resolves.toMatchObject({ type: 'FeatureCollection' });
  });
  it('does not silently fall back to database on CDN errors', async () => {
    vi.stubEnv('VITE_FLIGHT_TRAILS_CDN_BASE', 'https://cdn.example.test/flight-trails/v1');
    const fetcher = vi.fn(async () => new Response('', { status: 404 })); vi.stubGlobal('fetch', fetcher);
    await expect(fetchHistoricalFlightManifest()).rejects.toThrow('404');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual(['https://cdn.example.test/flight-trails/v1/manifest.json']);
  });
  it('merges available airport assets by flight id without losing roles or higher-resolution geometry', async () => {
    const rctp = collection() as unknown as HistoricalFlightCollection;
    rctp.features[0]!.properties = { ...rctp.features[0]!.properties, roles: ['arrival'], retained_point_count: 2, callsign: 'OLD' };
    const rckh = collection() as unknown as HistoricalFlightCollection;
    rckh.meta.airport = 'RCKH';
    rckh.features[0]!.properties = { ...rckh.features[0]!.properties, roles: ['departure'], retained_point_count: 3, callsign: 'NEW' };
    rckh.features[0]!.geometry.coordinates[0]!.push([121.00002, 25.00002, 130]);
    const rctpAsset = await assetFor(rctp);
    const rckhAsset = { ...(await assetFor(rckh)).asset, path: 'releases/local-1/tw_RCKH_2026-03-10.geojson' };
    const allManifest = {
      ...manifest(),
      airports: [...manifest().airports, { country: 'TW', icao: 'RCKH', name: '高雄', center: [120, 22], timezone: 'Asia/Taipei' }],
      samples: [
        { ...manifest().samples[0]!, airport: 'RCTP', asset: rctpAsset.asset, flight_count: 1, point_count: 2, coverage: 'partial' },
        { ...manifest().samples[0]!, airport: 'RCKH', asset: rckhAsset, flight_count: 1, point_count: 3, coverage: 'partial' },
      ],
    };
    const files = new Map([[rctpAsset.asset.path, rctpAsset.text], [rckhAsset.path, JSON.stringify(rckh)]]);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(files.get(String(url).split('/').slice(-3).join('/')))));
    const result = await fetchHistoricalFlightAllAirports(parseHistoricalFlightManifest(allManifest), 'TW', '2026-03-10');
    expect(result).toMatchObject({ availableAirportCount: 2, totalAirportCount: 2, data: { meta: { airport: 'ALL', timezone: 'Asia/Taipei', coverage: 'partial' } } });
    expect(result?.data.features).toHaveLength(1);
    expect(result?.data.features[0]?.properties).toMatchObject({ callsign: 'NEW', roles: ['departure', 'arrival'], retained_point_count: 3 });
    expect(result?.data.features[0]?.geometry.coordinates[0]).toHaveLength(3);
  });
  it('returns unavailable when no airport has a static asset for the requested date', async () => {
    expect(await fetchHistoricalFlightAllAirports(parseHistoricalFlightManifest(manifest()), 'TW', '2026-03-10')).toBeNull();
  });
});
