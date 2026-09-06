import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
import { loadRegionalStatistics } from '../regionalStatisticsLoader';

const bytes = new TextEncoder().encode(JSON.stringify({ type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [[[120, 23], [121, 23], [121, 24], [120, 23]]] } },
  { type: 'Feature', properties: { area_code: 'B' }, geometry: { type: 'Polygon', coordinates: [[[121, 23], [122, 23], [122, 24], [121, 23]]] } },
] }));
const recipe = { datasetId: 'waste', indicatorId: 'vehicles', level: 'county' as const };
const release = { dataset_id: 'waste', indicator_id: 'vehicles', release_id: 'r1', boundary_version: 'county-v1', period_start: '2025-01-01', period_end: '2025-12-31', levels: ['county'] };
const catalog = { status: 'OK', indicators: [{ dataset_id: 'waste', indicator_id: 'vehicles', name: '車輛', unit: '輛', levels: ['county'] }] };
const source = { status: 'OK', source: { publisher: '環境部' } };
const manifest = async (body = bytes) => ({ status: 'OK', geometry: { resource: 'https://geometry.test/county.json', sha256: [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', body))].map(x => x.toString(16).padStart(2, '0')).join(''), code_scheme: 'area_code', boundary_version: 'county-v1', level: 'county' } });
const page = (rows: unknown[], offset = 0, total = rows.length, truncated = false) => ({ status: rows.length ? 'OK' : 'NO_DATA', release, area_level: 'county', total, returned: rows.length, truncated, next_offset: truncated ? offset + rows.length : null, observations: rows });

function json(data: unknown) { return new Response(JSON.stringify(data), { status: 200 }); }
function install(responses: { values?: unknown[]; geometry?: Uint8Array; manifestBytes?: Uint8Array; releases?: unknown[] } = {}) {
  const values = responses.values ?? [page([{ area_code: 'A', value: 0, status: 'observed' }, { area_code: 'B', value: null, status: 'suppressed' }])];
  let i = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.includes('/catalog')) return json(catalog);
    if (input.includes('/releases')) return json({ status: 'OK', releases: responses.releases ?? [release] });
    if (input.includes('/values')) return json(values[i++]);
    if (input.includes('/sources')) return json(source);
    if (input.includes('/geometry-manifest')) return json(await manifest(responses.manifestBytes ?? responses.geometry));
    if (input === 'https://geometry.test/county.json') return new Response(responses.geometry ?? bytes);
    throw new Error(`unexpected ${input}`);
  }));
}

beforeEach(() => { vi.stubEnv('VITE_STATISTICS_API_URL', 'http://127.0.0.1:3733'); vi.stubGlobal('crypto', webcrypto); });

describe('regional statistics loader public contract', () => {
  it('consumes nested catalog/releases/values/source/geometry payloads and preserves zero/null', async () => {
    install(); const result = await loadRegionalStatistics(recipe);
    expect(result.features.map(f => f.properties?.value)).toEqual([0, null]);
    expect(result.features.map(f => f.properties?.status)).toEqual(['observed', 'suppressed']);
  });
  it('rejects a SHA mismatch before rendering geometry', async () => {
    install({ geometry: new TextEncoder().encode('{}'), manifestBytes: bytes });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('邊界檔案版本校驗失敗');
  });
  it('does not fall back when an explicit release was withdrawn', async () => {
    install({ releases: [release] });
    await expect(loadRegionalStatistics({ ...recipe, releaseId: 'withdrawn-r0' })).rejects.toThrow('尚未公開或已撤回');
  });
  it('reads every page and rejects an incomplete total', async () => {
    install({ values: [page([{ area_code: 'A', value: 1, status: 'observed' }], 0, 2, true), page([{ area_code: 'B', value: 2, status: 'observed' }], 1, 2)] });
    await expect(loadRegionalStatistics(recipe)).resolves.toMatchObject({ values: { total: 2, returned: 2, truncated: false } });
    install({ values: [page([{ area_code: 'A', value: 1, status: 'observed' }], 0, 2)] });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('未完整載入');
  });
  it('rejects duplicate or missing geometry identities', async () => {
    const duplicate = new TextEncoder().encode(JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [] } },
      { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [] } },
    ] }));
    install({ geometry: duplicate });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('參考邊界代碼或幾何錯誤');
  });
  it('keeps NO_DATA distinct from zero and rejects an observation with no geometry', async () => {
    install({ values: [page([], 0, 0)] });
    await expect(loadRegionalStatistics(recipe)).resolves.toMatchObject({ values: { status: 'NO_DATA', total: 0 } });
    install({ values: [page([{ area_code: 'C', value: 1, status: 'observed' }])] });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('找不到對應邊界');
  });
});
