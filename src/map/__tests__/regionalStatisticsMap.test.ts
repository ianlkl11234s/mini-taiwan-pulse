import { beforeEach, describe, expect, it, vi } from 'vitest';

type Snapshot = { selection?: { indicatorId?: string }; data: GeoJSON.FeatureCollection | null };

const state = vi.hoisted(() => {
  const snapshots = new Map<string, Snapshot>();
  const statisticsListeners = new Map<string, Set<() => void>>();
  let visibilityListener: (() => void) | undefined;
  let paramsListener: (() => void) | undefined;
  const visibility: Record<string, boolean> = {};
  const params: Record<string, unknown> = {};
  return {
    snapshots, statisticsListeners, visibility, params,
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
  statisticsRenderRecipe: (_key: string, indicator?: string) => indicator === 'institution_count'
    ? { dataset_id: 'education_statistics', indicator_id: 'institution_count', label: '機構數', level: 'county', unit: '所', dimensions: { education_stage: 'elementary' }, releaseId: 'social-114', colors: ['#200', '#201', '#202', '#203', '#204'], breaks: [10, 20, 30, 40] }
    : indicator === 'short_palette'
      ? { dataset_id: 'comparison_statistics', indicator_id: 'short_palette', label: '短色盤', level: 'county', unit: '所／萬名居民', dimensions: { education_stage: 'elementary' }, releaseId: 'derived-114', colors: ['#300', '#301', '#302'], breaks: [1, 2] }
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
    subscribe: (listener: () => void) => { state.paramsListener = listener; return () => { state.paramsListener = undefined; }; },
  },
}));
vi.mock('../../lib/loadingRegistry', () => ({ keepLoadingUntilMapIdle: vi.fn() }));

import { attachRegionalStatistics } from '../regionalStatisticsMap';

type Layer = { id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> };
function mapMock() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, Layer>();
  const paintCalls: Array<[string, string, unknown]> = [];
  const layoutCalls: Array<[string, string, unknown]> = [];
  const events = new Map<string, (() => void)>();
  const map = {
    isStyleLoaded: () => true,
    hasImage: () => false,
    addImage: vi.fn(),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn() }),
    addLayer: (layer: Layer) => layers.set(layer.id, { ...layer, layout: { ...layer.layout }, paint: { ...layer.paint } }),
    setPaintProperty: (id: string, property: string, value: unknown) => { paintCalls.push([id, property, value]); layers.get(id)?.paint && (layers.get(id)!.paint![property] = value); },
    setLayoutProperty: (id: string, property: string, value: unknown) => { layoutCalls.push([id, property, value]); layers.get(id)?.layout && (layers.get(id)!.layout![property] = value); },
    on: (event: string, listener: () => void) => events.set(event, listener),
    off: vi.fn(),
  };
  return { map, sources, layers, paintCalls, layoutCalls, events };
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
    expect((mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-color'] as unknown[])[3]).toBe('#social-missing');
    expect(mock.layers.get(`${VIEW}-suppressed`)).toMatchObject({ layout: { visibility: 'visible' }, paint: { 'fill-opacity': 0.72 } });
    expect(mock.sources.get(VIEW)?.setData).toHaveBeenLastCalledWith(expect.objectContaining({ features: [expect.objectContaining({ properties: expect.objectContaining({ value: 22 }) })] }));

    state.params[`${VIEW}Opacity`] = 0.41;
    state.paramsListener?.();
    expect(mock.layers.get(`${VIEW}-fill`)?.paint?.['fill-opacity']).toBe(0.41);
    expect(mock.layers.get(`${VIEW}-line`)?.paint?.['line-opacity']).toBe(0.41);
    expect(mock.layers.get(`${VIEW}-suppressed`)?.paint?.['fill-opacity']).toBe(0.41);

    state.visibility[VIEW] = false;
    state.visibilityListener?.();
    for (const suffix of ['fill', 'line', 'suppressed']) {
      expect(mock.layers.get(`${VIEW}-${suffix}`)?.layout?.visibility).toBe('none');
    }
    dispose();
  });

  it('uses the last available color for short-palette outlines', () => {
    state.snapshots.set(VIEW, { selection: { indicatorId: SHORT_PALETTE }, data: feature(2) });
    state.visibility[VIEW] = true;
    const mock = mapMock();
    const dispose = attachRegionalStatistics(mock.map as never);

    expect(mock.layers.get(`${VIEW}-line`)?.paint?.['line-color']).toBe('#302');

    state.snapshots.set(VIEW, { selection: { indicatorId: DERIVED }, data: feature(2) });
    state.statisticsListeners.get(VIEW)?.forEach(listener => listener());

    expect(mock.layers.get(`${VIEW}-line`)?.paint?.['line-color']).toBe('#104');
    dispose();
  });
});
