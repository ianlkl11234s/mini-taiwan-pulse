import { supabase } from '../lib/supabase';
import { withLoading } from '../lib/loadingRegistry';
import { statisticsGeometryCache, waitForGeometry } from './statisticsGeometryCache';
import { agriReleaseOptions, getAgriRecipe, resolveAgriRelease, type AgriRecipe } from './agriStatisticsRecipes';

export type StatisticsLevel = 'county' | 'township' | 'village' | 'statistical_min' | 'statistical_l1' | 'statistical_l2';
export interface StatisticsRecipe { datasetId: string; indicatorId: string; level: StatisticsLevel; dimensions?: Record<string, unknown>; releaseId?: string; layerKey?: string; label?: string; includeHealth?: boolean; allowReleaseFallback?: boolean; releaseFallback?: (release: StatisticsRelease) => Record<string, unknown> | null }
export interface StatisticsCatalogItem { dataset_id: string; indicator_id: string; name: string; unit: string; levels: StatisticsLevel[] }
export interface StatisticsRelease { release_id: string; dataset_id: string; indicator_id: string; boundary_version: string; period_start: string; period_end: string; levels?: StatisticsLevel[] }
export interface StatisticsObservation { area_code: string; value: number | null; status: string; source_status?: string; source_token?: string }
export interface StatisticsValues { status: string; release: StatisticsRelease; area_level: StatisticsLevel; total: number; returned: number; truncated: boolean; next_offset: number | null; observations: StatisticsObservation[] }
export type StatisticsSource = Record<string, unknown>;
/** Sidecars describe nonnumeric source tokens; observed numbers need no invented token. */
export function assertStatisticsSourceSemantics(value: StatisticsObservation, required: boolean) {
  if (required && value.status !== 'observed' && (typeof value.source_status !== 'string' || typeof value.source_token !== 'string')) throw new Error('畜禽來源狀態或原始符號未提供，不能以一般缺值取代');
}

export interface StatisticsHealth { status: string; availability?: string; coverage_status?: string; coverage_numerator?: number; coverage_denominator?: number; mapped_total?: number; unallocated_total?: number; currency?: string; coverage?: Record<string, unknown> }
export interface GeometryManifest { resource: string; sha256: string; code_scheme: string; code_property?: string; name_property?: string; boundary_version: string; level: StatisticsLevel }
export interface RegionalStatisticsResult { catalog: StatisticsCatalogItem[]; releases: StatisticsRelease[]; values: StatisticsValues; sources: StatisticsSource; health?: StatisticsHealth; effectiveRecipe: StatisticsRecipe; geometryManifest: GeometryManifest; features: GeoJSON.Feature[] }

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

/** Sources and health use the stable three-argument public RPC contract. */
export function statisticsAncillaryRpcArgs(recipe: Pick<StatisticsRecipe, 'datasetId' | 'indicatorId'>, releaseId: string) {
  return { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId, p_release: releaseId };
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

async function request<T>(route: string, query: Record<string, unknown>, args: Record<string, unknown>, signal?: AbortSignal, recipe?: StatisticsRecipe): Promise<T> {
  const agri = recipe?.layerKey ? getAgriRecipe(recipe.layerKey) : undefined;
  if (agriPreviewEnabled() && agri) return previewRequest<T>(route, query, recipe!, agri, signal);
  const base = String(import.meta.env.VITE_STATISTICS_API_URL ?? '').replace(/\/$/, '');
  if (base) {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
    const response = await fetch(`${base}/statistics/${route}?${params}`, { signal });
    if (!response.ok) throw new Error(`統計服務回應 ${response.status}`);
    return response.json() as Promise<T>;
  }
  let call = supabase.rpc(`get_stat_${route.replace(/-/g, '_')}`, args);
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) throw new Error(error.message);
  return data as T;
}
export async function loadRegionalStatistics(recipe: StatisticsRecipe, signal?: AbortSignal): Promise<RegionalStatisticsResult> {
  return withLoading(`statistics:${recipe.datasetId}:${recipe.indicatorId}`, recipe.label ?? '區域統計', (async () => {
    const catalogResponse = await request<{indicators: StatisticsCatalogItem[]}>('catalog', {}, {}, signal, recipe);
    const releasesResponse = await request<{releases: StatisticsRelease[]}>('releases', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId }, { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId }, signal, recipe);
    const { indicators: catalog } = catalogResponse;
    const { releases } = releasesResponse;
    if (!Array.isArray(catalog) || !Array.isArray(releases)) throw new Error('統計目錄格式不符');
    let effectiveRecipe = recipe;
    const agri = recipe.layerKey ? getAgriRecipe(recipe.layerKey) : undefined;
    const compatibleReleases = () => releases
      .filter(item => !item.levels || item.levels.includes(recipe.level))
      .map(item => ({ release: item, dimensions: recipe.releaseFallback ? recipe.releaseFallback(item) : recipe.dimensions ?? {} }))
      .filter((item): item is { release: StatisticsRelease; dimensions: Record<string, unknown> } => item.dimensions !== null)
      .sort((a, b) => b.release.period_end.localeCompare(a.release.period_end) || b.release.period_start.localeCompare(a.release.period_start) || b.release.release_id.localeCompare(a.release.release_id));
    let release: StatisticsRelease | undefined;
    if (!recipe.releaseId && agri) {
      const option = agriReleaseOptions(recipe.layerKey!, releases)[0];
      if (!option) throw new Error('農業統計尚無已公開且通過交付白名單的期別');
      release = releases.find(item => item.release_id === option.releaseId);
      effectiveRecipe = { ...recipe, releaseId: option.releaseId, dimensions: option.dimensions, allowReleaseFallback: false };
    } else release = recipe.releaseId ? releases.find(r => r.release_id === recipe.releaseId) : releases[0];
    if (!agri && !recipe.releaseId && recipe.releaseFallback) {
      const requested = recipe.dimensions ?? {};
      const matched = compatibleReleases().find(candidate => Object.entries(requested).every(([key, value]) => candidate.dimensions[key] === value));
      if (!matched) throw new Error('指定統計維度尚未公開或已撤回，請重新選擇');
      release = matched.release;
      effectiveRecipe = { ...recipe, releaseId: release.release_id, dimensions: matched.dimensions, allowReleaseFallback: false };
    }
    if (!release && recipe.releaseId && recipe.allowReleaseFallback) {
      const fallback = compatibleReleases()[0];
      if (!fallback) throw new Error('預設統計期別已撤回，且沒有相容的公開期別可使用');
      release = fallback.release;
      effectiveRecipe = { ...recipe, releaseId: release.release_id, dimensions: fallback.dimensions, allowReleaseFallback: false };
    }
    if (!release) throw new Error('指定統計期別尚未公開或已撤回，請重新選擇');
    const indicator = catalog.find(c => c.dataset_id === recipe.datasetId && c.indicator_id === recipe.indicatorId);
    if (!indicator || !indicator.levels.includes(recipe.level)) throw new Error('此指標不提供指定地理層級');
    if (agri) {
      if (!agri.enabled || agri.dataset_id !== recipe.datasetId || agri.indicator_id !== recipe.indicatorId || agri.level !== recipe.level || agri.boundary_version !== release.boundary_version) throw new Error('農業統計 recipe 與正式發布契約不符');
      if (indicator.unit !== agri.unit) throw new Error('農業統計單位與已驗證 recipe 不符');
      const resolved = resolveAgriRelease(recipe.layerKey!, release, (effectiveRecipe.dimensions ?? {}) as Record<string, string>);
      if (!resolved) throw new Error('農業統計期別或維度不在已驗證白名單中');
      effectiveRecipe = { ...effectiveRecipe, releaseId: resolved.releaseId, dimensions: resolved.dimensions, allowReleaseFallback: false };
    }
    let first: StatisticsValues | undefined;
    const observations: StatisticsObservation[] = [];
    let offset = 0;
    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      const query = { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id, level: recipe.level, dimensions: effectiveRecipe.dimensions ?? {}, limit: 10000, offset };
      const page = await request<StatisticsValues>('values', query, { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId, p_release: release.release_id, p_level: recipe.level, p_dimensions: effectiveRecipe.dimensions ?? {}, p_limit: 10000, p_offset: offset }, signal, recipe);
      if (!['OK', 'NO_DATA'].includes(page.status) || page.release?.release_id !== release.release_id || page.release.boundary_version !== release.boundary_version || page.release.dataset_id !== recipe.datasetId || page.release.indicator_id !== recipe.indicatorId || page.area_level !== recipe.level) throw new Error('統計回應期別或範圍不符');
      if (!Array.isArray(page.observations) || page.returned !== page.observations.length || !Number.isInteger(page.total) || page.total < 0 || (first && page.total !== first.total)) throw new Error('統計分頁完整度不符');
      first ??= page;
      observations.push(...page.observations);
      if (!page.truncated) break;
      if (!Number.isInteger(page.next_offset) || page.next_offset !== offset + page.returned || page.returned === 0 || pageIndex === 99) throw new Error('統計分頁無法繼續');
      offset = page.next_offset!;
    }
    if (!first || observations.length !== first.total) throw new Error('統計資料未完整載入');
    const geometryResponse = await request<{status: string; geometry: GeometryManifest}>('geometry-manifest', { boundary_version: release.boundary_version, level: recipe.level }, { p_boundary_version: release.boundary_version, p_level: recipe.level }, signal, recipe);
    const previewDimensions = agriPreviewEnabled() && agri ? { dimensions: effectiveRecipe.dimensions ?? {} } : {};
    const sourceResponse = await request<{status: string; source: StatisticsSource}>('sources', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id, ...previewDimensions }, statisticsAncillaryRpcArgs(recipe, release.release_id), signal, recipe);
    const health = recipe.includeHealth
      ? await request<StatisticsHealth>('health', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id, ...previewDimensions }, statisticsAncillaryRpcArgs(recipe, release.release_id), signal, recipe)
      : undefined;
    const geometryManifest = geometryResponse.geometry;
    if (geometryResponse.status !== 'OK' || sourceResponse.status !== 'OK' || (health && health.status !== 'OK') || !geometryManifest || geometryManifest.boundary_version !== release.boundary_version || geometryManifest.level !== recipe.level) throw new Error('參考邊界、來源紀錄或健康狀態不可用');
    const boundary = await waitForGeometry(statisticsGeometryCache.load(geometryManifest, async () => {
      const response = await fetch(geometryManifest.resource);
      if (!response.ok) throw new Error(`邊界載入失敗 ${response.status}`);
      return response.arrayBuffer();
    }), signal);
    const requiresSourceSemantics = agri?.release_options.some(option => option.release_id === release!.release_id && Boolean(option.semantics_sidecar_path));
    const byCode = new Map<string, StatisticsObservation>();
    for (const value of observations) {
      assertStatisticsSourceSemantics(value, Boolean(requiresSourceSemantics));
      if (typeof value.area_code !== 'string' || byCode.has(value.area_code) || (value.status === 'observed' ? typeof value.value !== 'number' || !Number.isFinite(value.value) : value.value !== null)) throw new Error('統計區代碼或數值格式錯誤');
      byCode.set(value.area_code, value);
    }
    const geometryCodes = new Set<string>();
    const features = boundary.features.map(feature => {
      const code = feature.properties?.area_code;
      if (typeof code !== 'string' || geometryCodes.has(code) || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) throw new Error('參考邊界代碼或幾何錯誤');
      geometryCodes.add(code);
      const value = byCode.get(code);
      return { ...feature, properties: { ...feature.properties, area_code: code, value: value?.value ?? null, status: value?.status ?? 'missing', source_status: value?.source_status, source_token: value?.source_token, indicator_name: indicator.name, unit: indicator.unit, format: agri?.format, release_id: release.release_id, period_label: `${release.period_start} — ${release.period_end}`, boundary_version: release.boundary_version, publisher: sourceResponse.source.publisher, raw_sha256: sourceResponse.source.raw_sha256, method_version: sourceResponse.source.method_version, source_statistical_boundary_version: agri?.source_statistical_boundary_version, availability: health?.availability, coverage_status: health?.coverage_status } };
    });
    if (observations.some(value => !geometryCodes.has(value.area_code))) throw new Error('統計區找不到對應邊界');
    return { catalog, releases, values: { ...first, observations, returned: observations.length, truncated: false, next_offset: null }, sources: sourceResponse.source, health, effectiveRecipe, geometryManifest, features };
  })());
}
