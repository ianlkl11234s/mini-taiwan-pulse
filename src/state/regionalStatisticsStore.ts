import { loadRegionalStatistics, type RegionalStatisticsResult, type StatisticsRecipe } from '../data/regionalStatisticsLoader';
export interface RegionalStatisticsSnapshot {
  loading: boolean; error: string | null; selection: StatisticsRecipe | null;
  catalog: RegionalStatisticsResult['catalog']; releases: RegionalStatisticsResult['releases'];
  data: GeoJSON.FeatureCollection | null; source: RegionalStatisticsResult['sources'] | null;
  release: RegionalStatisticsResult['values']['release'] | null; health: RegionalStatisticsResult['health'] | null;
}
const STORAGE = 'mini-taiwan:regional-statistics:v1';
const snapshots = new Map<string, RegionalStatisticsSnapshot>();
const listeners = new Map<string, Set<() => void>>();
const controllers = new Map<string, AbortController>();
const generations = new Map<string, number>();
function readSelections(): Record<string, StatisticsRecipe> {
  try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, StatisticsRecipe> : {}; } catch { return {}; }
}
const persisted = readSelections();
function getSnapshot(key: string): RegionalStatisticsSnapshot {
  if (!snapshots.has(key)) snapshots.set(key, { loading: false, error: null, selection: null, catalog: [], releases: [], data: null, source: null, release: null, health: null });
  return snapshots.get(key)!;
}
function update(key: string, changes: Partial<RegionalStatisticsSnapshot>) {
  snapshots.set(key, { ...getSnapshot(key), ...changes });
  listeners.get(key)?.forEach(callback => callback());
}
function cancel(key: string) { controllers.get(key)?.abort(); generations.set(key, (generations.get(key) ?? 0) + 1); }
export const regionalStatisticsStore = {
  getSnapshot,
  subscribe(key: string, callback: () => void): () => void {
    const callbacks = listeners.get(key) ?? new Set(); callbacks.add(callback); listeners.set(key, callbacks);
    return () => { callbacks.delete(callback); };
  },
  registerRecipe(key: string, recipe: StatisticsRecipe) {
    const current = getSnapshot(key).selection;
    if (current?.datasetId === recipe.datasetId && current.indicatorId === recipe.indicatorId) return;
    const saved = persisted[key];
    const matching = saved?.datasetId === recipe.datasetId && saved.indicatorId === recipe.indicatorId;
    const selection = matching ? { ...recipe, ...saved, ...(saved.releaseId && saved.releaseId !== recipe.releaseId ? { allowReleaseFallback: false } : {}) } : recipe;
    update(key, { selection, data: null, source: null, release: null, health: null });
  },
  setSelection(key: string, recipe: StatisticsRecipe | null) {
    cancel(key);
    if (recipe) persisted[key] = recipe; else delete persisted[key];
    try { localStorage.setItem(STORAGE, JSON.stringify(persisted)); } catch { /* Optional browser persistence. */ }
    update(key, { selection: recipe, data: null, source: null, release: null, health: null, loading: false, error: null });
  },
  disable(key: string) {
    cancel(key);
    update(key, { data: null, source: null, release: null, health: null, loading: false, error: null });
  },
  async load(key: string) {
    const recipe = getSnapshot(key).selection;
    if (!recipe) return;
    cancel(key);
    const generation = generations.get(key);
    const controller = new AbortController(); controllers.set(key, controller);
    update(key, { loading: true, error: null, data: null, source: null, release: null, health: null });
    try {
      const result = await loadRegionalStatistics(recipe, controller.signal);
      if (controller.signal.aborted || generations.get(key) !== generation) return;
      update(key, { loading: false, selection: result.effectiveRecipe ?? recipe, catalog: result.catalog, releases: result.releases, data: { type: 'FeatureCollection', features: result.features }, source: result.sources, health: result.health ?? null, release: result.values.release });
    } catch (error) {
      if (controller.signal.aborted || generations.get(key) !== generation) return;
      update(key, { loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
};
