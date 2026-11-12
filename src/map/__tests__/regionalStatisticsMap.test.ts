import { beforeEach, describe, expect, it, vi } from 'vitest';

type Snapshot = { selection?: { indicatorId?: string }; data: GeoJSON.FeatureCollection | null };

const state = vi.hoisted(() => {
  const snapshots = new Map<string, Snapshot>();
  const statisticsListeners = new Map<string, Set<() => void>>();
  let visibilityListener: (() => void) | undefined;
  let paramsListener: (() => void) | undefined;
  const visibility: Record<string, boolean> = {};
  const params: Record<string, unknown> = {};
  const presentation: Record<string, string> = {};
  const hollow = { value: false };
  return {
    snapshots, statisticsListeners, visibility, params, presentation, hollow,
    get visibilityListener() { return visibilityListener; },
    set visibilityListener(value: (() => void) | undefined) { visibilityListener = value; },
    get paramsListener() { return paramsListener; },
    set paramsListener(value: (() => void) | undefined) { paramsListener = value; },
  };
});

const VIEW = 'statsEducationElementarySchool';
const DERIVED = 'education_institution_count_per_10000_residents';
const SOCIAL = 'institution_count';
const SHORT_PALETTE = 'short_palette';

vi.mock('../../data/regionalStatisticsRecipes', () => ({
  STATISTICS_RENDER_KEYS: ['statsEducationElementarySchool'],
  statisticsBaseKey: (_key: string, indicator?: string) => indicator === 'institution_count' ? 'statsEducationCountyInstitutionCount' : 'statsComparisonEducationInstitutionCountPer10000Residents',
  statisticsRenderRecipe: (_key: string, indicator?: string, _dims?: unknown, basemap?: { isDark?: boolean }) => indicator === 'institution_count'
    ? { dataset_id: 'education_statistics', indicator_id: 'institution_count', label: '機構數', level: 'county', unit: '所', dimensions: { education_stage: 'elementary' }, releaseId: 'social-114', colors: ['#200', '#201', '#202', '#203', '#204'], breaks: [10, 20, 30, 40] }
    : indicator === 'short_palette'
      ? { dataset_id: 'comparison_statistics', indicator_id: 'short_palette', label: '短色盤', level: 'county', unit: '所／萬名居民', dimensions: { education_stage: 'elementary' }, releaseId: 'derived-114', colors: basemap?.isDark ? ['#d00', '#d01', '#d02'] : ['#300', '#301', '#302'], breaks: [1, 2] }
    : { dataset_id: 'comparison_statistics', indicator_id: 'education_institution_count_per_10000_residents', label: '每萬居民機構數', level: 'county', unit: '所／萬名居民', dimensions: { education_stage: 'elementary' }, releaseId: 'derived-114', colors: ['#100', '#101', '#102', '#103', '#104'], breaks: [1, 2, 3, 4] },
  statisticsReleaseFallback: () => undefined,
}));
vi.mock('../../data/socialStatisticsRecipes', () => ({
  getSocialRecipe: (key: string) => key === 'statsEducationCountyInstitutionCount' ? { legend: { missing_color: '#social-missing' } } : undefined,
}));
vi.mock('../../data/agriStatisticsRecipes', () => ({ getAgriRecipe: () => undefined }));
vi.mock('../../state/regionalStatisticsStore', () => ({
  regionalStatisticsStore: {
    registerRecipe: (key: string, recipe: { indicatorId: string }) => {
      state.snapshots.set(key, state.snapshots.get(key) ?? { selection: { indicatorId: recipe.indicatorId }, data: null });
    },
    getSnapshot: (key: string) => state.snapshots.get(key) ?? { data: null },
    subscribe: (key: string, listener: () => void) => {
      const listeners = state.statisticsListeners.get(key) ?? new Set<() => void>();
      listeners.add(listener); state.statisticsListeners.set(key, listeners);
      return () => listeners.delete(listener);
    },
    load: vi.fn(),
    disable: vi.fn(),
  },
}));
vi.mock('../../state/layerVisibilityStore', () => ({
  layerVisibilityStore: {
    getVisibility: (key: string) => state.visibility[key] ?? false,
    getAll: () => state.visibility,
    subscribe: (listener: () => void) => { state.visibilityListener = listener; return () => { state.visibilityListener = undefined; }; },
  },
}));
vi.mock('../../state/layerParamsStore', () => ({
  layerParamsStore: {
    getParam: (_key: string, name: string) => state.params[name],
    setManyDirect: (writes: { name: string; value: number }[]) => { for (const w of writes) state.params[w.name] = w.value; if (writes.length) state.paramsListener?.(); },
    subscribe: (listener: () => void) => { state.paramsListener = listener; return () => { state.paramsListener = undefined; }; },
  },
}));
vi.mock('../../lib/loadingRegistry', () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock('../../state/statisticsPresentationStore', () => ({
  isPresentationKey: (key: string) => key in state.presentation,
  statisticsPresentationMode: (key: string) => state.presentation[key] ?? 'choropleth',
  statisticsCircleHollow: () => state.hollow.value,
}));

import { attachRegionalStatistics } from '../regionalStatisticsMap';

type Layer = { id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> };
function mapMock() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, Layer>();
  const paintCalls: Array<[string, string, unknown]> = [];
  const layoutCalls: Array<[string, string, unknown]> = [];
  const events = new Map<string, (() => void)>();
  const addedBefore: Array<[string, string]> = [];
  let styleLoaded = true;
  const map = {
    isStyleLoaded: () => styleLoaded,
    hasImage: () => false,
    addImage: vi.fn(),
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    addLayer: (layer: Layer, before?: string) => { layers.set(layer.id, { ...layer, layout: { ...layer.layout }, paint: { ...layer.paint } }); if (before) addedBefore.push([layer.id, before]); },
    setPaintProperty: (id: string, property: string, value: unknown) => { paintCalls.push([id, property, value]); layers.get(id)?.paint && (layers.get(id)!.paint![property] = value); },
    setLayoutProperty: (id: string, property: string, value: unknown) => { layoutCalls.push([id, property, value]); layers.get(id)?.layout && (layers.get(id)!.layout![property] = value); },
    setFilter: (id: string, filter: unknown) => { const layer = layers.get(id) as (Layer & { filter?: unknown }) | undefined; if (layer) layer.filter = filter; },
    on: (event: string, listener: () => void) => events.set(event, listener),
    off: vi.fn(),
  };
  /** 模擬 setStyle：清掉所有自訂 source／layer，style.load 當下 isStyleLoaded() 仍為 false。 */
  const switchStyle = () => {
    sources.clear(); layers.clear();
    styleLoaded = false;
    events.get('style.load')?.();
    styleLoaded = true;
  };
  return { map, sources, layers, paintCalls, layoutCalls, events, switchStyle, addedBefore };
}
function feature(value: number): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { area_code: 'A', value, status: 'observed' }, geometry: { type: 'Polygon', coordinates: [] } }] };
}
function fillColorSteps(mock: ReturnType<typeof mapMock>, key: string): unknown[] {
  return (mock.layers.get(`${key}-fill`)?.paint?.['fill-color'] as unknown[])[2] as unknown[];
}

describe('attachRegionalStatistics', () => {
  beforeEach(() => {
    state.snapshots.clear(); state.statisticsListeners.clear();
    Object.keys(state.visibility).forEach(key => delete state.visibility[key]);
    Object.keys(state.params).forEach(key => delete state.params[key]);
    Object.keys(state.presentation).forEach(key => delete state.presentation[key]);
    state.hollow.value = false;
    state.visibilityListener = undefined; state.paramsListener = undefined;
  });

  it('does not create a source for a hidden view', () => {
    const mock = mapMock();
    const dispose = attachRegionalStatistics(mock.map as never);
    expect(mock.sources.size).toBe(0);
    expect(mock.layers.size).toBe(0);
    dispose();
  });

  it('refreshes a visible view scale after a metric switch and retains suppressed rendering and opacity', () => {
    state.snapshots.set(VIEW, { selection: { indicatorId: DERIVED }, data: feature(2) });
    state.visibility[VIEW] = true;
    state.params[`${VIEW}Opacity`] = 0.72;
    const mock = mapMock();
    const dispose = attachRegionalStatistics(mock.map as never);

    expect(mock.sources.get(VIEW)?.setData).toHaveBeenCalledWith(expect.objectContaining({ type: 'FeatureCollection' }));
    expect(mock.layers.get(`${VIEW}-suppressed`)).toMatchObject({ layout: { visibility: 'visible' }, paint: { 'fill-opacity': 0.72 } });
    expect(fillColorSteps(mock, VIEW)).toEqual(['step', ['get', 'value'], '#100', 1, '#101', 2, '#102', 3, '#103', 4, '#104']);

    state.snapshots.set(VIEW, { selection: { indicatorId: SOCIAL }, data: feature(22) });
    state.statisticsListeners.get(VIEW)?.forEach(listener => listener());

    expect(fillColorSteps(mock, VIEW)).toEqual(['step', ['get', 'value'], '#200', 10, '#201', 20, '#202', 30, '#203', 40, '#204']);
    // F-3 A：缺值不再用 recipe 的灰色，改透明底＋斜線子圖層
    expect((mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-color'] as unknown[])[3]).toBe('rgba(0,0,0,0)');
    expect(mock.layers.get(`${VIEW}-missing`)).toMatchObject({ layout: { visibility: 'visible' }, paint: { 'fill-pattern': 'map-hatch-missing-dark', 'fill-opacity': 0.72 } });
    expect(mock.layers.get(`${VIEW}-suppressed`)).toMatchObject({ layout: { visibility: 'visible' }, paint: { 'fill-opacity': 0.72 } });
    expect(mock.sources.get(VIEW)?.setData).toHaveBeenLastCalledWith(expect.objectContaining({ features: [expect.objectContaining({ properties: expect.objectContaining({ value: 22 }) })] }));

    state.params[`${VIEW}Opacity`] = 0.41;
    state.paramsListener?.();
    // 滑桿值＝實際透明度（填色與斜線同值，不再依底圖換算）
    expect(mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-opacity']).toBe(0.41);
    // F-2：細縫不綁透明度滑桿
    expect((mock.layers.get(`${VIEW}-line`)?.paint?.['line-opacity'] as unknown[]).slice(2)).toEqual([0.6, 0.5]);
    expect(mock.layers.get(`${VIEW}-missing`)?.paint?.['fill-opacity']).toBe(0.41);
    expect(mock.layers.get(`${VIEW}-suppressed`)?.paint?.['fill-opacity']).toBe(0.41);

    state.visibility[VIEW] = false;
    state.visibilityListener?.();
    for (const suffix of ['fill', 'missing', 'line', 'suppressed']) {
      expect(mock.layers.get(`${VIEW}-${suffix}`)?.layout?.visibility).toBe('none');
    }
    dispose();
  });

  it('F-2／F-3：外框是 1px 底圖色細縫、缺值與遮蔽用不同斜線，並隨底圖切換', () => {
    state.snapshots.set(VIEW, { selection: { indicatorId: SHORT_PALETTE }, data: feature(2) });
    state.visibility[VIEW] = true;
    state.params[`${VIEW}Opacity`] = 0.55;   // 規格預設（淡底）
    let dark = true;
    const mock = mapMock();
    const dispose = attachRegionalStatistics(mock.map as never, () => dark);

    // 有值：底圖色細縫；無值：行政界中性灰 0.5（透明底上才看得到界線）
    expect((mock.layers.get(`${VIEW}-line`)?.paint?.['line-color'] as unknown[]).slice(2)).toEqual(['#0a0a14', '#9ca3af']);
    expect((mock.layers.get(`${VIEW}-line`)?.paint?.['line-opacity'] as unknown[]).slice(2)).toEqual([0.6, 0.5]);
    expect(mock.layers.get(`${VIEW}-line`)?.paint?.['line-width']).toBe(1);
    expect(mock.layers.get(`${VIEW}-suppressed`)?.paint?.['fill-pattern']).toBe('map-hatch-suppressed-dark');
    expect(mock.map.addImage).toHaveBeenCalledWith('map-hatch-missing-light', expect.objectContaining({ width: 8, height: 8 }));

    // Q7：暗底版色階、填色 0.75；使用者沒動過滑桿 → 滑桿本身換成暗底預設 0.75（顯示＝實際）
    expect(fillColorSteps(mock, VIEW)).toEqual(['step', ['get', 'value'], '#d00', 1, '#d01', 2, '#d02']);
    expect(mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-opacity']).toBe(0.75);
    expect(state.params[`${VIEW}Opacity`]).toBe(0.75);

    dark = false;
    mock.events.get('style.load')?.();
    // 換淡底：已開啟的統計圖層即時換回淡底色階與 0.55
    expect(fillColorSteps(mock, VIEW)).toEqual(['step', ['get', 'value'], '#300', 1, '#301', 2, '#302']);
    expect(mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-opacity']).toBe(0.55);
    expect(state.params[`${VIEW}Opacity`]).toBe(0.55);
    expect((mock.layers.get(`${VIEW}-line`)?.paint?.['line-color'] as unknown[]).slice(2)).toEqual(['#ffffff', '#374151']);
    expect((mock.layers.get(`${VIEW}-line`)?.paint?.['line-opacity'] as unknown[]).slice(2)).toEqual([0.8, 0.5]);
    expect(mock.layers.get(`${VIEW}-missing`)?.paint?.['fill-pattern']).toBe('map-hatch-missing-light');
    expect(mock.layers.get(`${VIEW}-suppressed`)?.paint?.['fill-pattern']).toBe('map-hatch-suppressed-light');

    // 使用者動過滑桿 → 換底圖保留他的值
    state.params[`${VIEW}Opacity`] = 0.4;
    state.paramsListener?.();
    dark = true;
    mock.events.get('style.load')?.();
    expect(state.params[`${VIEW}Opacity`]).toBe(0.4);
    expect(mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-opacity']).toBe(0.4);
    dispose();
  });

  it('R8-1：換底圖後用快取資料立即重建，不重抓（style.load 當下 isStyleLoaded() 為 false）', async () => {
    const { regionalStatisticsStore } = await import('../../state/regionalStatisticsStore');
    const cached = feature(2);
    state.snapshots.set(VIEW, { selection: { indicatorId: DERIVED }, data: cached });
    state.visibility[VIEW] = true;
    let dark = true;
    const mock = mapMock();
    const dispose = attachRegionalStatistics(mock.map as never, () => dark);
    const loads = vi.mocked(regionalStatisticsStore.load).mock.calls.length;

    for (const next of [false, true]) {
      dark = next;
      mock.switchStyle();
      expect(mock.sources.get(VIEW)?.setData).toHaveBeenCalledWith(cached);
      expect(mock.layers.get(`${VIEW}-fill`)?.layout?.visibility).toBe('visible');
      expect(mock.layers.get(`${VIEW}-missing`)?.paint?.['fill-pattern']).toBe(next ? 'map-hatch-missing-dark' : 'map-hatch-missing-light');
    }
    expect(vi.mocked(regionalStatisticsStore.load).mock.calls.length).toBe(loads);
    dispose();
  });
  it('比例圓：關掉面量填色、保留缺值斜線與細縫，圓在面內代表點、實心／空心依是否疊在其他面量圖上', () => {
    const square: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { area_code: 'A', value: 430, status: 'observed' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
      { type: 'Feature', properties: { area_code: 'B', value: 100, status: 'observed' }, geometry: { type: 'Polygon', coordinates: [[[4, 0], [6, 0], [6, 2], [4, 2], [4, 0]]] } },
      { type: 'Feature', properties: { area_code: 'C', value: null, status: 'missing' }, geometry: { type: 'Polygon', coordinates: [[[8, 0], [9, 0], [9, 1], [8, 1], [8, 0]]] } },
      { type: 'Feature', properties: { area_code: 'D', value: 0, status: 'observed' }, geometry: { type: 'Polygon', coordinates: [[[10, 0], [11, 0], [11, 1], [10, 1], [10, 0]]] } },
    ] };
    state.snapshots.set(VIEW, { selection: { indicatorId: DERIVED }, data: square });
    state.visibility[VIEW] = true;
    state.params[`${VIEW}Opacity`] = 0.6;
    state.presentation[VIEW] = 'circle';
    const mock = mapMock();
    const dispose = attachRegionalStatistics(mock.map as never, () => true);

    expect(mock.layers.get(`${VIEW}-fill`)?.layout?.visibility).toBe('none');
    for (const suffix of ['missing', 'suppressed', 'line']) expect(mock.layers.get(`${VIEW}-${suffix}`)?.layout?.visibility).toBe('visible');
    const points = mock.sources.get(`${VIEW}-circles`)?.setData.mock.calls[0]?.[0] as GeoJSON.FeatureCollection<GeoJSON.Point>;
    // 只畫有觀測值且 > 0 的區（缺值、0 不畫圓）；大的先畫、properties 與面相同（popup 一致）
    expect(points.features.map((f) => f.properties?.area_code)).toEqual(['A', 'B']);
    expect(points.features[0]!.geometry.coordinates).toEqual([1, 1]);
    const circle = mock.layers.get(`${VIEW}-circle`)!;
    expect(circle).toMatchObject({ layout: { visibility: 'visible' }, paint: { 'circle-color': '#104', 'circle-opacity': 0.6 } });
    // 半徑 ∝ √值：最大值 430 取整到參考值 500 → 縣市最大半徑 28 px
    expect(circle.paint!['circle-radius']).toEqual(['*', 28, ['sqrt', ['/', ['max', ['to-number', ['get', 'value'], 0], 0], 500]]]);
    expect(mock.layers.get(`${VIEW}-circle-halo`)?.layout?.visibility).toBe('none');

    state.hollow.value = true;
    state.paramsListener?.();
    expect(mock.layers.get(`${VIEW}-circle`)?.paint).toMatchObject({ 'circle-opacity': 0, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 });
    expect(mock.layers.get(`${VIEW}-circle-halo`)?.layout?.visibility).toBe('visible');

    state.presentation[VIEW] = 'choropleth';
    state.paramsListener?.();
    expect(mock.layers.get(`${VIEW}-fill`)?.layout?.visibility).toBe('visible');
    expect(mock.layers.get(`${VIEW}-circle`)?.layout?.visibility).toBe('none');
    dispose();
  });
});
