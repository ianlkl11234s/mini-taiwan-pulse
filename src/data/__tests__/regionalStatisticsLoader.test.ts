import { createHash, webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertStatisticsSourceSemantics,
  clearRegionalStatisticsCdnCache,
  loadRegionalStatistics,
  loadRegionalStatisticsValues,
  normalizeAgriPreviewHealth,
} from '../regionalStatisticsLoader';
import { agriReleaseOptions, getAgriRecipe, resolveAgriRelease } from '../agriStatisticsRecipes';
import { statisticsGeometryCache } from '../statisticsGeometryCache';

const CDN_BASE = 'https://cdn.test/statistics/v1';
const geometryBytes = new TextEncoder().encode(JSON.stringify({ type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [[[120, 23], [121, 23], [121, 24], [120, 23]]] } },
  { type: 'Feature', properties: { area_code: 'B' }, geometry: { type: 'Polygon', coordinates: [[[121, 23], [122, 23], [122, 24], [121, 23]]] } },
] }));
const recipe = { datasetId: 'waste', indicatorId: 'vehicles', level: 'county' as const };
const release = { dataset_id: 'waste', indicator_id: 'vehicles', release_id: 'r1', boundary_version: 'county-v1', period_start: '2025-01-01', period_end: '2025-12-31', levels: ['county'] as const };
const catalog = { status: 'OK', indicators: [{ dataset_id: 'waste', indicator_id: 'vehicles', name: '車輛', unit: '輛', levels: ['county' as const] }] };
const source = { status: 'OK', source: { publisher: '環境部' } };
const health = { status: 'OK', availability: 'CURRENT', coverage_status: 'PARTIAL', coverage_numerator: 4, coverage_denominator: 22, mapped_total: 58186094, unallocated_total: 0, currency: 'TWD' };

function sha(body: Uint8Array): string { return createHash('sha256').update(body).digest('hex'); }
function encoded(data: unknown): Uint8Array { return new TextEncoder().encode(JSON.stringify(data)); }
function jsonBytes(body: Uint8Array): Response { return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }); }
function values(rows: unknown[], responseRelease = release, overrides: Record<string, unknown> = {}) {
  return { status: rows.length ? 'OK' : 'NO_DATA', release: responseRelease, area_level: 'county', total: rows.length, returned: rows.length, offset: 0, truncated: false, next_offset: null, observations: rows, ...overrides };
}

interface FixtureOptions {
  valuePayload?: ReturnType<typeof values>;
  geometry?: Uint8Array;
  geometryHashBytes?: Uint8Array;
  releases?: Array<Record<string, unknown>>;
  responseRelease?: typeof release;
  dimensions?: Record<string, unknown>;
  health?: Record<string, unknown> | null;
  catalog?: typeof catalog;
  corruptArtifact?: boolean;
}

function install(options: FixtureOptions = {}) {
  clearRegionalStatisticsCdnCache();
  const responseRelease = options.responseRelease ?? release;
  const body = options.geometry ?? geometryBytes;
  const geometry = {
    resource: `geometries/${sha(body)}.geojson`,
    sha256: sha(options.geometryHashBytes ?? body),
    code_scheme: 'area_code', boundary_version: responseRelease.boundary_version, level: 'county',
  };
  const artifact = {
    schema_version: 'regional-statistics-cdn-v1',
    values: options.valuePayload ?? values([
      { area_code: 'A', value: 0, status: 'observed' },
      { area_code: 'B', value: null, status: 'suppressed' },
    ], responseRelease),
    sources: source,
    health: options.health === undefined ? health : options.health,
    geometry: { status: 'OK', geometry },
  };
  const artifactBytes = encoded(artifact);
  const artifactRef = { path: `artifacts/${sha(artifactBytes)}.json`, sha256: sha(artifactBytes), bytes: artifactBytes.byteLength };
  const manifest = {
    schema_version: 'regional-statistics-cdn-v1', generated_at: '2026-09-09T00:00:00Z',
    catalog: options.catalog ?? catalog,
    indicators: [{ dataset_id: responseRelease.dataset_id, indicator_id: responseRelease.indicator_id, releases: options.releases ?? [responseRelease] }],
    selectors: [{ dataset_id: responseRelease.dataset_id, indicator_id: responseRelease.indicator_id, release_id: responseRelease.release_id, area_level: 'county', dimensions: options.dimensions ?? {}, artifact: artifactRef }],
    geometries: [geometry],
  };
  const manifestBytes = encoded(manifest);
  const manifestRef = { path: `manifests/${sha(manifestBytes)}.json`, sha256: sha(manifestBytes), bytes: manifestBytes.byteLength };
  const currentBytes = encoded({ schema_version: 'regional-statistics-cdn-v1', manifest: manifestRef });
  const mockedFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${CDN_BASE}/current.json`) return jsonBytes(currentBytes);
    if (url === `${CDN_BASE}/${manifestRef.path}`) return jsonBytes(manifestBytes);
    if (url === `${CDN_BASE}/${artifactRef.path}`) return jsonBytes(options.corruptArtifact ? encoded({ ...artifact, health: null }) : artifactBytes);
    if (url === `${CDN_BASE}/${geometry.resource}`) return new Response(body);
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', mockedFetch);
  return mockedFetch;
}

beforeEach(() => {
  statisticsGeometryCache.clear();
  clearRegionalStatisticsCdnCache();
  vi.stubEnv('VITE_STATISTICS_CDN_BASE', CDN_BASE);
  vi.stubEnv('VITE_AGRI_STATISTICS_PREVIEW', 'false');
  vi.stubGlobal('crypto', webcrypto);
});

describe('regional statistics R2 CDN contract', () => {
  it('reads a release-scoped values receipt without downloading boundary geometry', async () => {
    const mockedFetch = install();
    const result = await loadRegionalStatisticsValues({ ...recipe, releaseId: release.release_id, dimensions: {}, includeHealth: true, allowReleaseFallback: false });

    expect(result).toMatchObject({
      values: { release: { release_id: release.release_id, boundary_version: release.boundary_version }, total: 2 },
      sources: { publisher: '環境部' },
      health: { availability: 'CURRENT' },
      geometryManifest: { boundary_version: release.boundary_version, level: 'county' },
    });
    expect(mockedFetch.mock.calls.some(([input]) => String(input).includes('/geometries/'))).toBe(false);
  });

  it('deduplicates current/manifest/artifact reads and never calls Supabase', async () => {
    const mockedFetch = install();
    const result = await loadRegionalStatistics(recipe);
    expect(result.values.total).toBe(2);
    expect(mockedFetch.mock.calls.filter(([input]) => String(input).endsWith('/current.json'))).toHaveLength(1);
    expect(mockedFetch.mock.calls.filter(([input]) => String(input).includes('/manifests/'))).toHaveLength(1);
    expect(mockedFetch.mock.calls.filter(([input]) => String(input).includes('/artifacts/'))).toHaveLength(1);
    expect(mockedFetch.mock.calls.some(([input]) => /supabase|\/rpc\//i.test(String(input)))).toBe(false);
  });

  it('downloads geometry alongside the release artifact but exposes only the atomic result', async () => {
    install();
    const originalFetch = fetch;
    let finishArtifact!: () => void;
    const gate = new Promise<void>(resolve => { finishArtifact = resolve; });
    const started: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); started.push(url);
      if (url.includes('/artifacts/')) await gate;
      return originalFetch(input);
    }));
    let completed = false;
    const loading = loadRegionalStatistics({ ...recipe, includeHealth: true }).then(result => { completed = true; return result; });
    try {
      await vi.waitFor(() => expect(started.some(url => url.includes('/geometries/'))).toBe(true));
      expect(completed).toBe(false);
    } finally { finishArtifact(); }
    await expect(loading).resolves.toMatchObject({ health: { availability: 'CURRENT' }, values: { total: 2 } });
  });

  it('rejects a corrupted content-addressed artifact', async () => {
    install({ corruptArtifact: true });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('artifact 大小不符');
  });

  it('requires livestock sidecar tokens only for nonnumeric observations', () => {
    expect(() => assertStatisticsSourceSemantics({ area_code: 'A', value: 12, status: 'observed' }, true)).not.toThrow();
    expect(() => assertStatisticsSourceSemantics({ area_code: 'A', value: null, status: 'missing' }, true)).toThrow('來源狀態');
    expect(() => assertStatisticsSourceSemantics({ area_code: 'A', value: null, status: 'missing', source_status: 'not_reported', source_token: '-' }, true)).not.toThrow();
    expect(() => assertStatisticsSourceSemantics({ area_code: 'A', value: null, status: 'suppressed', source_status: 'suppressed', source_token: '*' }, true)).not.toThrow();
    expect(() => assertStatisticsSourceSemantics({ area_code: 'A', value: null, status: 'missing' }, false)).not.toThrow();
  });

  it('normalizes both delivery coverage shapes without conflating tuple and source coverage', () => {
    expect(normalizeAgriPreviewHealth({ status: 'PARTIAL', coverage: { observed: 118, expected: 368, status: 'PARTIAL' } }, 'township')).toMatchObject({ availability: 'PARTIAL', coverage_status: 'PARTIAL', coverage_numerator: 118, coverage_denominator: 368 });
    expect(normalizeAgriPreviewHealth({ status: 'STALE', coverage: { observed: { township_count: 3, status: 'PARTIAL' }, expected: { township_count: 368 } } }, 'township')).toMatchObject({ availability: 'STALE', coverage_status: 'PARTIAL', coverage_numerator: 3, coverage_denominator: 368 });
  });

  it('keeps preview whitelist tuples exact and defaults to the latest verified option', () => {
    const agri = getAgriRecipe('statsCropPlantedAreaTownship')!;
    const releases = [...new Map(agri.release_options.map(option => [option.release_id, { release_id: option.release_id, dataset_id: agri.dataset_id, indicator_id: agri.indicator_id, boundary_version: agri.boundary_version, period_start: option.period_start, period_end: option.period_end, levels: [agri.level] }])).values()];
    const selected = agriReleaseOptions(agri.layer_key, releases)[0]!;
    const selectedRelease = releases.find(item => item.release_id === selected.releaseId)!;
    expect(resolveAgriRelease(agri.layer_key, selectedRelease, selected.dimensions)).toEqual(selected);
    expect(resolveAgriRelease(agri.layer_key, selectedRelease, { crop: String(selected.dimensions.crop) })).toBeNull();
  });

  it('preserves zero, null, missing and suppressed source semantics', async () => {
    install({ valuePayload: values([
      { area_code: 'A', value: 0, status: 'observed', source_status: null, source_token: null },
      { area_code: 'B', value: null, status: 'suppressed', source_status: 'suppressed', source_token: '*' },
    ]) });
    const result = await loadRegionalStatistics(recipe);
    expect(result.features.map(feature => [feature.properties?.value, feature.properties?.status, feature.properties?.source_token])).toEqual([[0, 'observed', null], [null, 'suppressed', '*']]);
  });

  it('rejects a geometry SHA mismatch before rendering', async () => {
    install({ geometry: encoded({}), geometryHashBytes: geometryBytes });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('邊界檔案版本校驗失敗');
  });

  it('shares one verified boundary between different indicators', async () => {
    const firstFetch = install();
    await loadRegionalStatistics(recipe);
    const weightRelease = { ...release, indicator_id: 'weight', release_id: 'r-weight' };
    const secondFetch = install({ responseRelease: weightRelease, releases: [weightRelease], catalog: { status: 'OK', indicators: [...catalog.indicators, { dataset_id: 'waste', indicator_id: 'weight', name: '重量', unit: '噸', levels: ['county'] }] } });
    await loadRegionalStatistics({ ...recipe, indicatorId: 'weight' });
    expect(firstFetch.mock.calls.filter(([input]) => String(input).includes('/geometries/'))).toHaveLength(1);
    expect(secondFetch.mock.calls.filter(([input]) => String(input).includes('/geometries/'))).toHaveLength(0);
  });

  it('refetches when the immutable boundary identity changes', async () => {
    const firstFetch = install();
    await loadRegionalStatistics(recipe);
    const nextBytes = encoded({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [[[120, 23], [121, 23], [121, 24], [120, 23]]] } },
      { type: 'Feature', properties: { area_code: 'B' }, geometry: { type: 'Polygon', coordinates: [[[121, 23], [122.1, 23], [122.1, 24], [121, 23]]] } },
    ] });
    const secondFetch = install({ geometry: nextBytes });
    await loadRegionalStatistics(recipe);
    expect(firstFetch.mock.calls.filter(([input]) => String(input).includes('/geometries/'))).toHaveLength(1);
    expect(secondFetch.mock.calls.filter(([input]) => String(input).includes('/geometries/'))).toHaveLength(1);
  });

  it('does not fall back when an explicit release was withdrawn', async () => {
    install({ releases: [release] });
    await expect(loadRegionalStatistics({ ...recipe, releaseId: 'withdrawn-r0' })).rejects.toThrow('尚未公開或已撤回');
  });

  it('rejects a partial artifact instead of paging or hitting Supabase', async () => {
    install({ valuePayload: values([{ area_code: 'A', value: 1, status: 'observed' }], release, { total: 2, truncated: true, next_offset: 1 }) });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('release artifact 不完整');
  });

  it('rejects duplicate or missing geometry identities', async () => {
    install({ geometry: encoded({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [] } },
      { type: 'Feature', properties: { area_code: 'A' }, geometry: { type: 'Polygon', coordinates: [] } },
    ] }) });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('參考邊界代碼或幾何錯誤');
  });

  it('keeps NO_DATA distinct from zero and rejects observations with no geometry', async () => {
    install({ valuePayload: values([]) });
    await expect(loadRegionalStatistics(recipe)).resolves.toMatchObject({ values: { status: 'NO_DATA', total: 0 } });
    install({ valuePayload: values([{ area_code: 'C', value: 1, status: 'observed' }]) });
    await expect(loadRegionalStatistics(recipe)).rejects.toThrow('找不到對應邊界');
  });

  it('loads health only when requested and fails closed when unavailable', async () => {
    install();
    await expect(loadRegionalStatistics({ ...recipe, includeHealth: true })).resolves.toMatchObject({ health: { availability: 'CURRENT', coverage_status: 'PARTIAL' } });
    install({ health: { status: 'NOT_FOUND' } });
    await expect(loadRegionalStatistics({ ...recipe, includeHealth: true })).rejects.toThrow('健康狀態不可用');
  });

  it('falls back to the latest compatible public release and exact dimensions', async () => {
    const older = { ...release, release_id: 'r-old', period_start: '2024-01-01', period_end: '2024-01-31' };
    const latest = { ...release, release_id: 'r-latest', period_start: '2025-02-01', period_end: '2025-02-28' };
    install({ releases: [older, latest], responseRelease: latest, dimensions: { fund: 'verified-latest' } });
    const result = await loadRegionalStatistics({ ...recipe, releaseId: 'withdrawn-default', allowReleaseFallback: true, releaseFallback: candidate => candidate.release_id === 'r-latest' ? { fund: 'verified-latest' } : null });
    expect(result.effectiveRecipe).toMatchObject({ releaseId: 'r-latest', dimensions: { fund: 'verified-latest' }, allowReleaseFallback: false });
  });

  it('resolves an initial dimension selection through a compatible release', async () => {
    const older = { ...release, release_id: 'r-112', period_start: '2023-01-01', period_end: '2023-12-31' };
    const latest = { ...release, release_id: 'r-113', period_start: '2024-01-01', period_end: '2024-12-31' };
    install({ releases: [older, latest], responseRelease: latest, dimensions: { roc_year: '113' } });
    const result = await loadRegionalStatistics({ ...recipe, dimensions: { roc_year: '113' }, releaseFallback: candidate => candidate.period_start === '2024-01-01' ? { roc_year: '113' } : candidate.period_start === '2023-01-01' ? { roc_year: '112' } : null });
    expect(result.effectiveRecipe).toMatchObject({ releaseId: 'r-113', dimensions: { roc_year: '113' }, allowReleaseFallback: false });
  });

  it('does not replace explicit user choices and errors without a compatible fallback', async () => {
    install({ releases: [release] });
    await expect(loadRegionalStatistics({ ...recipe, releaseId: 'withdrawn-user-choice', allowReleaseFallback: false })).rejects.toThrow('指定統計期別尚未公開或已撤回');
    install({ releases: [release] });
    await expect(loadRegionalStatistics({ ...recipe, releaseId: 'withdrawn-default', allowReleaseFallback: true, releaseFallback: () => null })).rejects.toThrow('沒有相容的公開期別');
  });
});
