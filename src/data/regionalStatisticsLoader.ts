import { supabase } from '../lib/supabase';
import { withLoading } from '../lib/loadingRegistry';

export type StatisticsLevel = 'county' | 'township' | 'village' | 'statistical_min' | 'statistical_l1' | 'statistical_l2';
export interface StatisticsRecipe { datasetId: string; indicatorId: string; level: StatisticsLevel; dimensions?: Record<string, unknown>; releaseId?: string; label?: string; includeHealth?: boolean }
export interface StatisticsCatalogItem { dataset_id: string; indicator_id: string; name: string; unit: string; levels: StatisticsLevel[] }
export interface StatisticsRelease { release_id: string; dataset_id: string; indicator_id: string; boundary_version: string; period_start: string; period_end: string; levels?: StatisticsLevel[] }
export interface StatisticsObservation { area_code: string; value: number | null; status: string }
export interface StatisticsValues { status: string; release: StatisticsRelease; area_level: StatisticsLevel; total: number; returned: number; truncated: boolean; next_offset: number | null; observations: StatisticsObservation[] }
export type StatisticsSource = Record<string, unknown>;
export interface StatisticsHealth { status: string; availability?: string; coverage_status?: string; coverage_numerator?: number; coverage_denominator?: number; mapped_total?: number; unallocated_total?: number; currency?: string }
export interface GeometryManifest { resource: string; sha256: string; code_scheme: string; boundary_version: string; level: StatisticsLevel }
export interface RegionalStatisticsResult { catalog: StatisticsCatalogItem[]; releases: StatisticsRelease[]; values: StatisticsValues; sources: StatisticsSource; health?: StatisticsHealth; geometryManifest: GeometryManifest; features: GeoJSON.Feature[] }

async function request<T>(route: string, query: Record<string, unknown>, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
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
    const catalogResponse = await request<{indicators: StatisticsCatalogItem[]}>('catalog', {}, {}, signal);
    const releasesResponse = await request<{releases: StatisticsRelease[]}>('releases', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId }, { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId }, signal);
    const { indicators: catalog } = catalogResponse;
    const { releases } = releasesResponse;
    if (!Array.isArray(catalog) || !Array.isArray(releases)) throw new Error('統計目錄格式不符');
    const release = recipe.releaseId ? releases.find(r => r.release_id === recipe.releaseId) : releases[0];
    if (!release) throw new Error('指定統計期別尚未公開或已撤回，請重新選擇');
    const indicator = catalog.find(c => c.dataset_id === recipe.datasetId && c.indicator_id === recipe.indicatorId);
    if (!indicator || !indicator.levels.includes(recipe.level)) throw new Error('此指標不提供指定地理層級');
    let first: StatisticsValues | undefined;
    const observations: StatisticsObservation[] = [];
    let offset = 0;
    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      const query = { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id, level: recipe.level, dimensions: recipe.dimensions ?? {}, limit: 10000, offset };
      const page = await request<StatisticsValues>('values', query, { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId, p_release: release.release_id, p_level: recipe.level, p_dimensions: recipe.dimensions ?? {}, p_limit: 10000, p_offset: offset }, signal);
      if (!['OK', 'NO_DATA'].includes(page.status) || page.release?.release_id !== release.release_id || page.release.boundary_version !== release.boundary_version || page.release.dataset_id !== recipe.datasetId || page.release.indicator_id !== recipe.indicatorId || page.area_level !== recipe.level) throw new Error('統計回應期別或範圍不符');
      if (!Array.isArray(page.observations) || page.returned !== page.observations.length || !Number.isInteger(page.total) || page.total < 0 || (first && page.total !== first.total)) throw new Error('統計分頁完整度不符');
      first ??= page;
      observations.push(...page.observations);
      if (!page.truncated) break;
      if (!Number.isInteger(page.next_offset) || page.next_offset !== offset + page.returned || page.returned === 0 || pageIndex === 99) throw new Error('統計分頁無法繼續');
      offset = page.next_offset!;
    }
    if (!first || observations.length !== first.total) throw new Error('統計資料未完整載入');
    const geometryResponse = await request<{status: string; geometry: GeometryManifest}>('geometry-manifest', { boundary_version: release.boundary_version, level: recipe.level }, { p_boundary_version: release.boundary_version, p_level: recipe.level }, signal);
    const sourceResponse = await request<{status: string; source: StatisticsSource}>('sources', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id }, { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId, p_release: release.release_id }, signal);
    const health = recipe.includeHealth
      ? await request<StatisticsHealth>('health', { dataset_id: recipe.datasetId, indicator_id: recipe.indicatorId, release_id: release.release_id }, { p_dataset: recipe.datasetId, p_indicator: recipe.indicatorId, p_release: release.release_id }, signal)
      : undefined;
    const geometryManifest = geometryResponse.geometry;
    if (geometryResponse.status !== 'OK' || sourceResponse.status !== 'OK' || (health && health.status !== 'OK') || !geometryManifest || geometryManifest.boundary_version !== release.boundary_version || geometryManifest.level !== recipe.level) throw new Error('參考邊界、來源紀錄或健康狀態不可用');
    const response = await fetch(geometryManifest.resource, { signal });
    if (!response.ok) throw new Error(`邊界載入失敗 ${response.status}`);
    const bytes = await response.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    if (digest !== geometryManifest.sha256) throw new Error('邊界檔案版本校驗失敗');
    const geometry = JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection;
    if (geometry.type !== 'FeatureCollection' || !Array.isArray(geometry.features)) throw new Error('邊界格式不符');
    const byCode = new Map<string, StatisticsObservation>();
    for (const value of observations) {
      if (typeof value.area_code !== 'string' || byCode.has(value.area_code) || (value.status === 'observed' ? typeof value.value !== 'number' || !Number.isFinite(value.value) : value.value !== null)) throw new Error('統計區代碼或數值格式錯誤');
      byCode.set(value.area_code, value);
    }
    const geometryCodes = new Set<string>();
    const features = geometry.features.map(feature => {
      const code = feature.properties?.area_code;
      if (typeof code !== 'string' || geometryCodes.has(code) || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) throw new Error('參考邊界代碼或幾何錯誤');
      geometryCodes.add(code);
      const value = byCode.get(code);
      return { ...feature, properties: { ...feature.properties, area_code: code, value: value?.value ?? null, status: value?.status ?? 'missing', indicator_name: indicator.name, unit: indicator.unit, release_id: release.release_id, period_label: `${release.period_start} — ${release.period_end}`, boundary_version: release.boundary_version, publisher: sourceResponse.source.publisher } };
    });
    if (observations.some(value => !geometryCodes.has(value.area_code))) throw new Error('統計區找不到對應邊界');
    return { catalog, releases, values: { ...first, observations, returned: observations.length, truncated: false, next_offset: null }, sources: sourceResponse.source, health, geometryManifest, features };
  })());
}
