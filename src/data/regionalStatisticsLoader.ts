import { getEducationPresentationView } from './statisticsPresentationViews';
import { getComparisonRecipe, comparisonReleaseOptions } from './comparisonStatisticsRecipes';
import { getSocialRecipe, socialReleaseOptions, resolveSocialRelease } from './socialStatisticsRecipes';
import { withLoading } from '../lib/loadingRegistry';
import { cachedByKey } from '../lib/loaderCache';
import { statisticsGeometryCache, waitForGeometry, type StatisticsBoundaryGeometry } from './statisticsGeometryCache';
import { agriReleaseOptions, getAgriRecipe, resolveAgriRelease, type AgriRecipe } from './agriStatisticsRecipes';

export type StatisticsLevel = 'county' | 'township' | 'village' | 'statistical_min' | 'statistical_l1' | 'statistical_l2';
export interface StatisticsRecipe { datasetId: string; indicatorId: string; level: StatisticsLevel; dimensions?: Record<string, unknown>; releaseId?: string; layerKey?: string; label?: string; includeHealth?: boolean; allowReleaseFallback?: boolean; releaseFallback?: (release: StatisticsRelease) => Record<string, unknown> | null }
export interface StatisticsCatalogItem { dataset_id: string; indicator_id: string; name: string; unit: string; levels: StatisticsLevel[] }
export interface StatisticsRelease { release_id: string; dataset_id: string; indicator_id: string; boundary_version: string; period_start: string; period_end: string; levels?: StatisticsLevel[] }
export interface StatisticsObservation { area_code: string; value: number | null; status: string; source_status?: string; source_token?: string; inputs?: Record<string, unknown> }
export interface StatisticsValues { status: string; release: StatisticsRelease; area_level: StatisticsLevel; total: number; returned: number; truncated: boolean; next_offset: number | null; observations: StatisticsObservation[] }
export type StatisticsSource = Record<string, unknown>;
/** Sidecars describe nonnumeric source tokens; observed numbers need no invented token. */
export function assertStatisticsSourceSemantics(value: StatisticsObservation, required: boolean) {
  if (required && value.status !== 'observed' && (typeof value.source_status !== 'string' || typeof value.source_token !== 'string')) throw new Error('統計來源狀態或原始符號未提供，不能以一般缺值取代');
}

export interface StatisticsHealth { status: string; reason?: string; availability?: string; coverage_status?: string; coverage_numerator?: number; coverage_denominator?: number; mapped_total?: number; unallocated_total?: number; currency?: string; coverage?: Record<string, unknown> }
export interface GeometryManifest { resource: string; sha256: string; code_scheme: string; code_property?: string; name_property?: string; boundary_version: string; level: StatisticsLevel }
export interface RegionalStatisticsResult { catalog: StatisticsCatalogItem[]; releases: StatisticsRelease[]; values: StatisticsValues; sources: StatisticsSource; health?: StatisticsHealth; effectiveRecipe: StatisticsRecipe; geometryManifest: GeometryManifest; features: GeoJSON.Feature[] }
/**
 * A release-scoped statistics read that deliberately does not download or join
 * administrative boundary features.  Consumers that need geometry must use
 * loadRegionalStatistics instead, so a values query cannot silently acquire a
 * display geometry or claim that its rows are spatial features.
 */
export interface RegionalStatisticsValuesResult {
  catalog: StatisticsCatalogItem[];
  releases: StatisticsRelease[];
  values: StatisticsValues;
  sources: StatisticsSource;
  health?: StatisticsHealth;
  effectiveRecipe: StatisticsRecipe;
  geometryManifest: GeometryManifest;
}

const STATISTICS_CDN_SCHEMA = 'regional-statistics-cdn-v1';
const DEFAULT_STATISTICS_CDN_BASE = 'https://data.itsmigu.com/statistics/v1';
const LOCAL_STATISTICS_CDN_ROUTE = '/__statistics-cdn';
interface StatisticsCdnAsset { path: string; sha256: string; bytes: number }
interface StatisticsCdnPointer { schema_version: string; manifest: StatisticsCdnAsset }
interface StatisticsCdnSelector {
  dataset_id: string; indicator_id: string; release_id: string; area_level: StatisticsLevel;
  dimensions: Record<string, unknown>; artifact: StatisticsCdnAsset;
}
interface StatisticsCdnIndicator { dataset_id: string; indicator_id: string; releases: StatisticsRelease[] }
interface StatisticsCdnManifest {
  schema_version: string;
  catalog: { status: string; indicators: StatisticsCatalogItem[] };
  indicators: StatisticsCdnIndicator[];
  selectors: StatisticsCdnSelector[];
  geometries: GeometryManifest[];
}
interface StatisticsCdnArtifact {
  schema_version: string;
  values: StatisticsValues;
  sources: { status: string; source: StatisticsSource };
  health?: StatisticsHealth | null;
  geometry: { status: string; geometry: GeometryManifest };
}

function configuredStatisticsCdnBase(): string {
  return String(import.meta.env.VITE_STATISTICS_CDN_BASE || DEFAULT_STATISTICS_CDN_BASE).replace(/\/+$/, '');
}

/** Local DEV fetches the fixed public CDN through Vite; receipts stay canonical. */
export function statisticsBoundaryFetchUrl(manifest: GeometryManifest, origin?: string): string {
  const canonicalBase = configuredStatisticsCdnBase();
  if (!import.meta.env.DEV || canonicalBase !== DEFAULT_STATISTICS_CDN_BASE) return manifest.resource;
  const root = new URL(`${canonicalBase}/`);
  const resource = new URL(manifest.resource, root);
  if (resource.origin !== root.origin || !resource.pathname.startsWith(root.pathname)) return manifest.resource;
  if (!origin) throw new Error('本地 statistics CDN proxy 需要 browser origin');
  const relative = resource.pathname.slice(root.pathname.length);
  return new URL(`${LOCAL_STATISTICS_CDN_ROUTE}/${relative}`, origin).href;
}

function statisticsCdnBase(recipe?: StatisticsRecipe): string {
  // This delivery is incremental. Only its exact registered datasets use the opt-in local origin.
  const social = recipe?.layerKey ? getSocialRecipe(recipe.layerKey) : undefined;
  if (import.meta.env.DEV && import.meta.env.VITE_SOCIAL_STATISTICS_PREVIEW === 'true'
    && social?.enabled && social.dataset_id === recipe?.datasetId) {
    return new URL('/__social-statistics-cdn', window.location.origin).href;
  }
  const configured = configuredStatisticsCdnBase();
  if (import.meta.env.DEV && configured === DEFAULT_STATISTICS_CDN_BASE) {
    return new URL(LOCAL_STATISTICS_CDN_ROUTE, window.location.origin).href;
  }
  return configured;
}

function statisticsCdnReferenceBase(fetchBase: string): string {
  if (!import.meta.env.DEV || configuredStatisticsCdnBase() !== DEFAULT_STATISTICS_CDN_BASE) return fetchBase;
  const local = new URL(LOCAL_STATISTICS_CDN_ROUTE, window.location.origin).href;
  return fetchBase === local ? DEFAULT_STATISTICS_CDN_BASE : fetchBase;
}

function assetUrl(base: string, path: string): string {
  if (!path || path.startsWith('/') || path.includes('\\')) throw new Error('Statistics CDN artifact path 不合法');
  const root = new URL(`${base}/`);
  const resolved = new URL(path, root);
  if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname) || resolved.username || resolved.password) {
    throw new Error('Statistics CDN artifact 不可離開版本根目錄');
  }
  return resolved.href;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
}

async function fetchJson(url: string, expected?: StatisticsCdnAsset): Promise<unknown> {
  const response = await fetch(url, expected ? undefined : { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Statistics CDN 回應 ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (expected) {
    if (!Number.isInteger(expected.bytes) || expected.bytes < 2 || bytes.byteLength !== expected.bytes) throw new Error('Statistics CDN artifact 大小不符');
    if (!/^[0-9a-f]{64}$/.test(expected.sha256) || await sha256Hex(bytes) !== expected.sha256) throw new Error('Statistics CDN artifact SHA-256 不符');
  }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('Statistics CDN JSON 格式不符'); }
}

const loadCdnManifestCached = cachedByKey<StatisticsCdnManifest>(async base => {
  const pointer = await fetchJson(`${base}/current.json`) as StatisticsCdnPointer;
  if (pointer?.schema_version !== STATISTICS_CDN_SCHEMA || !pointer.manifest) throw new Error('Statistics CDN current manifest 契約不符');
  const manifest = await fetchJson(assetUrl(base, pointer.manifest.path), pointer.manifest) as StatisticsCdnManifest;
  if (manifest?.schema_version !== STATISTICS_CDN_SCHEMA || manifest.catalog?.status !== 'OK'
    || !Array.isArray(manifest.catalog.indicators) || !Array.isArray(manifest.indicators)
    || !Array.isArray(manifest.selectors) || !Array.isArray(manifest.geometries)) throw new Error('Statistics CDN manifest 契約不符');
  return manifest;
}, 60_000, 2);

const loadCdnArtifactCached = cachedByKey<StatisticsCdnArtifact>(async key => {
  const { base, asset } = JSON.parse(key) as { base: string; asset: StatisticsCdnAsset };
  const artifact = await fetchJson(assetUrl(base, asset.path), asset) as StatisticsCdnArtifact;
  if (artifact?.schema_version !== STATISTICS_CDN_SCHEMA || !artifact.values || !artifact.sources || !artifact.geometry) {
    throw new Error('Statistics CDN release artifact 契約不符');
  }
  return artifact;
}, 24 * 60 * 60_000, 64);

export function clearRegionalStatisticsCdnCache(): void {
  loadCdnManifestCached.invalidate();
  loadCdnArtifactCached.invalidate();
}

async function cdnManifest(base: string, signal?: AbortSignal): Promise<StatisticsCdnManifest> {
  return waitForGeometry(loadCdnManifestCached(base), signal);
}

async function cdnArtifact(base: string, asset: StatisticsCdnAsset, signal?: AbortSignal): Promise<StatisticsCdnArtifact> {
  return waitForGeometry(loadCdnArtifactCached(JSON.stringify({ base, asset })), signal);
}

const AGRI_PREVIEW_DEFAULT_URL = '/__agri-statistics-preview-api';
const AGRI_PREVIEW_BOUNDARY_PATH = '/__agri-statistics-preview-boundaries';
const AGRI_BOUNDARIES: Record<string, Omit<GeometryManifest, 'boundary_version' | 'level'>> = {
  COUNTY_MOI_1140318: { resource: `${AGRI_PREVIEW_BOUNDARY_PATH}/statistics_county_reference.geojson`, sha256: '5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6', code_scheme: '行政區域代碼', code_property: '行政區域代碼', name_property: '名稱' },
  township_reference_20260626_v1: { resource: `${AGRI_PREVIEW_BOUNDARY_PATH}/statistics_township_reference.geojson`, sha256: 'a7859ba26c0231a90d4e56aaad43735a3835769f31a9233f4766435f5bb0a8cf', code_scheme: 'TOWNCODE', code_property: 'TOWNCODE', name_property: 'TOWNNAME' },
  township_boundary_20260626_identity_only: { resource: `${AGRI_PREVIEW_BOUNDARY_PATH}/statistics_township_reference.geojson`, sha256: 'a7859ba26c0231a90d4e56aaad43735a3835769f31a9233f4766435f5bb0a8cf', code_scheme: 'TOWNCODE', code_property: 'TOWNCODE', name_property: 'TOWNNAME' },
  TOWN_MOI_1140318: { resource: `${AGRI_PREVIEW_BOUNDARY_PATH}/statistics_township_reference.geojson`, sha256: 'a7859ba26c0231a90d4e56aaad43735a3835769f31a9233f4766435f5bb0a8cf', code_scheme: 'TOWNCODE', code_property: 'TOWNCODE', name_property: 'TOWNNAME' },
};

function agriPreviewEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_AGRI_STATISTICS_PREVIEW === 'true';
}

function sameDimensions(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a); const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every(key => a[key] === b[key]);
}

function previewUrl(route: string, query: Record<string, unknown>, layerKey?: string): string {
  const params = new URLSearchParams(Object.entries({ ...query, layer_key: layerKey }).filter(([, value]) => value != null).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]));
  return `${AGRI_PREVIEW_DEFAULT_URL}/statistics/${route}?${params}`;
}

/** The delivery preview has two coverage shapes; retain both without inventing a count. */
export function normalizeAgriPreviewHealth(body: Record<string, unknown>, level: StatisticsLevel): StatisticsHealth {
  const coverage = body.coverage as Record<string, unknown> | undefined;
  const observed = coverage?.observed as Record<string, unknown> | undefined;
  const expected = coverage?.expected as Record<string, unknown> | undefined;
  const countKey = level === 'township' ? 'township_count' : 'county_count';
  return {
    status: body.status === 'BLOCKED' ? 'BLOCKED' : 'OK', availability: typeof body.status === 'string' ? body.status : undefined,
    coverage_status: typeof coverage?.status === 'string' ? coverage.status : typeof observed?.status === 'string' ? observed.status : undefined,
    coverage_numerator: typeof coverage?.observed === 'number' ? coverage.observed : typeof observed?.[countKey] === 'number' ? observed[countKey] : undefined,
    coverage_denominator: typeof coverage?.expected === 'number' ? coverage.expected : typeof expected?.[countKey] === 'number' ? expected[countKey] : undefined,
    coverage,
  };
}

async function previewRequest<T>(route: string, query: Record<string, unknown>, recipe: StatisticsRecipe, agri: AgriRecipe, signal?: AbortSignal): Promise<T> {
  if (route === 'geometry-manifest') {
    const boundary = AGRI_BOUNDARIES[String(query.boundary_version)];
    if (!boundary || agri.level !== query.level) throw new Error('本地 preview 找不到交付參考邊界');
    return { status: 'OK', geometry: { ...boundary, boundary_version: query.boundary_version, level: query.level } } as T;
  }
  const response = await fetch(previewUrl(route, query, recipe.layerKey), { signal });
  if (!response.ok) throw new Error(`農業統計 preview 回應 ${response.status}`);
  const body = await response.json() as Record<string, unknown>;
  if (body.status === 'BLOCKED') throw new Error(`此農業統計尚未可接線：${String(body.reason ?? 'BLOCKED')}`);
  if (route === 'catalog') {
    const layers = Array.isArray(body.layers) ? body.layers as Array<Record<string, unknown>> : [];
    return { indicators: layers.filter(layer => layer.enabled === true).map(layer => ({ dataset_id: layer.dataset_id, indicator_id: layer.indicator_id, name: layer.label, unit: layer.unit, levels: [layer.level] })) } as T;
  }
  if (route === 'releases') {
    const releases = Array.isArray(body.releases) ? body.releases : [];
    return { releases: releases.map(item => ({ ...(item as Record<string, unknown>), dataset_id: agri.dataset_id, indicator_id: agri.indicator_id, boundary_version: agri.boundary_version, levels: [agri.level] })) } as T;
  }
  if (route === 'values') {
    const release = agri.release_options.find(option => option.release_id === query.release_id && sameDimensions(option.dimensions, query.dimensions as Record<string, unknown>));
    if (!release) throw new Error('農業統計 preview selector 未命中交付白名單');
    return { ...body, release: { release_id: release.release_id, dataset_id: agri.dataset_id, indicator_id: agri.indicator_id, boundary_version: agri.boundary_version, period_start: release.period_start, period_end: release.period_end, levels: [agri.level] }, area_level: agri.level } as T;
  }
  if (route === 'sources') return { status: body.status, source: body.release ?? {} } as T;
  if (route === 'health') return normalizeAgriPreviewHealth(body, agri.level) as T;
  return body as T;
}

async function request<T>(route: string, query: Record<string, unknown>, signal?: AbortSignal, recipe?: StatisticsRecipe): Promise<T> {
  const agri = recipe?.layerKey ? getAgriRecipe(recipe.layerKey) : undefined;
  if (agriPreviewEnabled() && agri) return previewRequest<T>(route, query, recipe!, agri, signal);
  const base = statisticsCdnBase(recipe);
  const manifest = await cdnManifest(base, signal);
  if (route === 'catalog') return manifest.catalog as T;
  if (route === 'releases') {
    const indicator = manifest.indicators.find(item => item.dataset_id === query.dataset_id && item.indicator_id === query.indicator_id);
    return { status: 'OK', releases: indicator?.releases ?? [] } as T;
  }
  if (route === 'geometry-manifest') {
    const geometry = manifest.geometries.find(item => item.boundary_version === query.boundary_version && item.level === query.level);
    return (geometry ? { status: 'OK', geometry: { ...geometry, resource: assetUrl(statisticsCdnReferenceBase(base), geometry.resource) } } : { status: 'NOT_FOUND' }) as T;
  }
  const selector = manifest.selectors.find(item => item.dataset_id === query.dataset_id
    && item.indicator_id === query.indicator_id && item.release_id === query.release_id
    && item.area_level === query.level && sameDimensions(item.dimensions, (query.dimensions ?? {}) as Record<string, unknown>));
  if (!selector) return { status: 'NOT_FOUND' } as T;
  const artifact = await cdnArtifact(base, selector.artifact, signal);
  if (route === 'values') return artifact.values as T;
  if (route === 'sources') return artifact.sources as T;
  if (route === 'health') return (artifact.health ?? { status: 'NOT_FOUND' }) as T;
  throw new Error(`Statistics CDN 不支援 route: ${route}`);
}
interface ResolvedStatisticsRecipe {
  catalog: StatisticsCatalogItem[];
  releases: StatisticsRelease[];
  release: StatisticsRelease;
  effectiveRecipe: StatisticsRecipe;
  agri?: AgriRecipe;
}

async function resolveStatisticsRecipe(recipe: StatisticsRecipe, signal?: AbortSignal): Promise<ResolvedStatisticsRecipe> {
  const renderKey = recipe.layerKey;
  const view = renderKey ? getEducationPresentationView(renderKey) : undefined;
  if (view) {
    const base = view.metrics.find(metric => (getSocialRecipe(metric.layerKey) ?? getComparisonRecipe(metric.layerKey))?.indicator_id === recipe.indicatorId);
    if (!base || recipe.dimensions?.education_stage !== view.stage) throw new Error('教育學制或指標不符固定入口');
    recipe = {...recipe, layerKey: base.layerKey};
  }
    const [catalogResponse, releasesResponse] = await Promise.all([
      request<{indicators: StatisticsCatalogItem[]}>('catalog', {}, signal, recipe),
      request<{releases: StatisticsRelease[]}>('releases', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId }, signal, recipe),
    ]);
    const { indicators: catalog } = catalogResponse;
    const { releases } = releasesResponse;
    if (!Array.isArray(catalog) || !Array.isArray(releases)) throw new Error('統計目錄格式不符');
    let effectiveRecipe = recipe;
    const social = recipe.layerKey ? getSocialRecipe(recipe.layerKey) : undefined;
    const agri = recipe.layerKey ? getAgriRecipe(recipe.layerKey) : undefined;
    const compatibleReleases = () => releases
      .filter(item => !item.levels || item.levels.includes(recipe.level))
      .map(item => ({ release: item, dimensions: recipe.releaseFallback ? recipe.releaseFallback(item) : recipe.dimensions ?? {} }))
      .filter((item): item is { release: StatisticsRelease; dimensions: Record<string, unknown> } => item.dimensions !== null)
      .sort((a, b) => b.release.period_end.localeCompare(a.release.period_end) || b.release.period_start.localeCompare(a.release.period_start) || b.release.release_id.localeCompare(a.release.release_id));
    let release: StatisticsRelease | undefined;
    if (!recipe.releaseId && (agri || social)) {
      const option = (social ? socialReleaseOptions : agriReleaseOptions)(recipe.layerKey!, releases)[0];
      if (!option) throw new Error('統計尚無已公開且通過交付白名單的期別');
      release = releases.find(item => item.release_id === option.releaseId);
      effectiveRecipe = { ...recipe, releaseId: option.releaseId, dimensions: option.dimensions, allowReleaseFallback: false };
    } else release = recipe.releaseId ? releases.find(r => r.release_id === recipe.releaseId) : releases[0];
    if (!agri && !social && !recipe.releaseId && recipe.releaseFallback) {
      const requested = recipe.dimensions ?? {};
      const matched = compatibleReleases().find(candidate => Object.entries(requested).every(([key, value]) => candidate.dimensions[key] === value));
      if (!matched) throw new Error('指定統計維度尚未公開或已撤回，請重新選擇');
      release = matched.release;
      effectiveRecipe = { ...recipe, releaseId: release.release_id, dimensions: matched.dimensions, allowReleaseFallback: false };
    }
    if (!social && !agri && !release && recipe.releaseId && recipe.allowReleaseFallback) {
      const fallback = compatibleReleases()[0];
      if (!fallback) throw new Error('預設統計期別已撤回，且沒有相容的公開期別可使用');
      release = fallback.release;
      effectiveRecipe = { ...recipe, releaseId: release.release_id, dimensions: fallback.dimensions, allowReleaseFallback: false };
    }
    if (!release) throw new Error('指定統計期別尚未公開或已撤回，請重新選擇');
    const indicator = catalog.find(c => c.dataset_id === recipe.datasetId && c.indicator_id === recipe.indicatorId);
    if (!indicator || !indicator.levels.includes(recipe.level)) throw new Error('此指標不提供指定地理層級');
    const comparison = recipe.layerKey ? getComparisonRecipe(recipe.layerKey) : undefined;
    if (comparison) {
      const option = comparisonReleaseOptions(recipe.layerKey!, releases).find(o => o.releaseId === release!.release_id && sameDimensions(o.dimensions, effectiveRecipe.dimensions ?? {}));
      if (!option || indicator.unit !== comparison.unit || comparison.dataset_id !== recipe.datasetId || comparison.indicator_id !== recipe.indicatorId || comparison.level !== recipe.level) throw new Error('比較統計未命中已驗證期別或單位');
    }
    if (agri || social) {
      const configured = social ?? agri;
      if (!configured) throw new Error('統計 recipe 與正式發布契約不符');
      if (!configured.enabled || configured.dataset_id !== recipe.datasetId || configured.indicator_id !== recipe.indicatorId || configured.level !== recipe.level || configured.boundary_version !== release.boundary_version) throw new Error('統計 recipe 與正式發布契約不符');
      if (indicator.unit !== configured.unit) throw new Error('統計單位與已驗證 recipe 不符');
      const resolved = (social ? resolveSocialRelease : resolveAgriRelease)(recipe.layerKey!, release, (effectiveRecipe.dimensions ?? {}) as Record<string, string>);
      if (!resolved) throw new Error('統計期別或維度不在已驗證白名單中');
      effectiveRecipe = { ...effectiveRecipe, releaseId: resolved.releaseId, dimensions: resolved.dimensions, allowReleaseFallback: false };
    }
    return { catalog, releases, release, effectiveRecipe, agri };
}

function validateStatisticsValues(first: StatisticsValues, release: StatisticsRelease, recipe: StatisticsRecipe): StatisticsObservation[] {
  if (!['OK', 'NO_DATA'].includes(first.status) || first.release?.release_id !== release.release_id || first.release.boundary_version !== release.boundary_version || first.release.dataset_id !== recipe.datasetId || first.release.indicator_id !== recipe.indicatorId || first.area_level !== recipe.level) throw new Error('統計回應期別或範圍不符');
  if (!Array.isArray(first.observations) || first.returned !== first.observations.length || first.total !== first.returned || first.truncated || first.next_offset !== null || !Number.isInteger(first.total) || first.total < 0) throw new Error('Statistics CDN release artifact 不完整');
  return first.observations;
}

async function loadStatisticsValuesResult(recipe: StatisticsRecipe, signal?: AbortSignal, includeBoundary = false): Promise<RegionalStatisticsValuesResult & { boundary?: StatisticsBoundaryGeometry }> {
    const { catalog, releases, release, effectiveRecipe, agri } = await resolveStatisticsRecipe(recipe, signal);
    const query = { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id, level: recipe.level, dimensions: effectiveRecipe.dimensions ?? {} };
    // These requests share a validated release, not each other's response. Keep
    // the atomic result gate below: no values render before provenance/health/SHA pass.
    const [{ first, observations }, geometryResult, sourceResponse, health] = await Promise.all([
      (async () => {
        const first = await request<StatisticsValues>('values', query, signal, recipe);
        return { first, observations: validateStatisticsValues(first, release, recipe) };
      })(),
      (async () => {
        const geometryResponse = await request<{status: string; geometry: GeometryManifest}>('geometry-manifest', { boundary_version: release.boundary_version, level: recipe.level }, signal, recipe);
        const geometryManifest = geometryResponse.geometry;
        if (geometryResponse.status !== 'OK' || !geometryManifest || geometryManifest.boundary_version !== release.boundary_version || geometryManifest.level !== recipe.level) throw new Error('參考邊界、來源紀錄或健康狀態不可用');
        if (!includeBoundary) return { geometryManifest };
        const boundary = await waitForGeometry(statisticsGeometryCache.load(geometryManifest, async () => {
          const response = await fetch(statisticsBoundaryFetchUrl(geometryManifest, globalThis.location?.origin));
          if (!response.ok) throw new Error(`邊界載入失敗 ${response.status}`);
          return response.arrayBuffer();
        }), signal);
        return { geometryManifest, boundary };
      })(),
      request<{status: string; source: StatisticsSource}>('sources', query, signal, recipe),
      recipe.includeHealth
        ? request<StatisticsHealth>('health', query, signal, recipe)
        : Promise.resolve(undefined),
    ]);
    if (sourceResponse.status !== 'OK' || (health && health.status !== 'OK')) throw new Error('參考邊界、來源紀錄或健康狀態不可用');
    const social = effectiveRecipe.layerKey ? getSocialRecipe(effectiveRecipe.layerKey) : undefined;
    const requiresSourceSemantics = social?.dataset_id === 'nursing_workforce_statistics' || agri?.release_options.some(option => option.release_id === release.release_id && Boolean(option.semantics_sidecar_path));
    const byCode = new Map<string, StatisticsObservation>();
    for (const value of observations) {
      assertStatisticsSourceSemantics(value, Boolean(requiresSourceSemantics));
      if (typeof value.area_code !== 'string' || byCode.has(value.area_code) || (value.status === 'observed' ? typeof value.value !== 'number' || !Number.isFinite(value.value) : value.value !== null)) throw new Error('統計區代碼或數值格式錯誤');
      byCode.set(value.area_code, value);
    }
    return { catalog, releases, values: { ...first, observations, returned: observations.length, truncated: false, next_offset: null }, sources: sourceResponse.source, health, effectiveRecipe, geometryManifest: geometryResult.geometryManifest, boundary: geometryResult.boundary };
}

export async function loadRegionalStatisticsValues(recipe: StatisticsRecipe, signal?: AbortSignal): Promise<RegionalStatisticsValuesResult> {
  return withLoading(`statistics-values:${recipe.datasetId}:${recipe.indicatorId}`, recipe.label ?? '區域統計數值', loadStatisticsValuesResult(recipe, signal));
}

export async function loadRegionalStatistics(recipe: StatisticsRecipe, signal?: AbortSignal): Promise<RegionalStatisticsResult> {
  const renderKey = recipe.layerKey;
  return withLoading(`statistics:${recipe.datasetId}:${recipe.indicatorId}`, recipe.label ?? '區域統計', (async () => {
    const result = await loadStatisticsValuesResult(recipe, signal, true);
    const { catalog, releases, values: first, sources, health, effectiveRecipe, geometryManifest, boundary } = result;
    const { release } = first;
    const comparison = effectiveRecipe.layerKey ? getComparisonRecipe(effectiveRecipe.layerKey) : undefined;
    const social = effectiveRecipe.layerKey ? getSocialRecipe(effectiveRecipe.layerKey) : undefined;
    const agri = effectiveRecipe.layerKey ? getAgriRecipe(effectiveRecipe.layerKey) : undefined;
    const sourceResponse = { source: sources };
    const observations = first.observations;
    if (!boundary) throw new Error('參考邊界、來源紀錄或健康狀態不可用');
    const indicator = catalog.find(item => item.dataset_id === recipe.datasetId && item.indicator_id === recipe.indicatorId);
    if (!indicator) throw new Error('此指標不提供指定地理層級');
    const byCode = new Map(observations.map(value => [value.area_code, value]));
    const geometryCodes = new Set<string>();
    const features = boundary.features.map(feature => {
      const code = feature.properties?.area_code;
      if (typeof code !== 'string' || geometryCodes.has(code) || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) throw new Error('參考邊界代碼或幾何錯誤');
      geometryCodes.add(code);
      const value = byCode.get(code);
      const derivation = sourceResponse.source.derivation as Record<string, unknown> | undefined;
      const processing = sourceResponse.source.processing_summary as Record<string, unknown> | undefined;
      return { ...feature, properties: { ...feature.properties, area_code: code, value: value?.value ?? null, status: value?.status ?? 'missing', source_status: value?.source_status, source_token: value?.source_token, inputs: value?.inputs, indicator_name: comparison?.label ?? social?.label ?? indicator.name, unit: indicator.unit, format: agri?.format, release_id: release.release_id, period_label: `${release.period_start} — ${release.period_end}`, boundary_version: release.boundary_version, publisher: sourceResponse.source.publisher, raw_sha256: sourceResponse.source.raw_sha256, method_version: sourceResponse.source.method_version, source_statistical_boundary_version: agri?.source_statistical_boundary_version, availability: health?.availability, coverage_status: health?.coverage_status, comparison_formula: derivation?.formula ?? processing?.formula, interpretation: derivation?.interpretation ?? processing?.interpretation ?? processing?.description, time_caveat: derivation?.time_caveat ?? processing?.time_caveat } };
    });
    if (observations.some(value => !geometryCodes.has(value.area_code))) throw new Error('統計區找不到對應邊界');
    return { catalog, releases, values: first, sources: sourceResponse.source, health, effectiveRecipe: { ...effectiveRecipe, layerKey: renderKey ?? effectiveRecipe.layerKey }, geometryManifest, features };
  })());
}
