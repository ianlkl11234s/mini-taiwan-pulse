import { loadRegionalStatistics, type RegionalStatisticsResult, type StatisticsRecipe } from '../data/regionalStatisticsLoader';
import { getEducationPresentationView } from '../data/statisticsPresentationViews';
import { getSocialRecipe } from '../data/socialStatisticsRecipes';
import { getComparisonRecipe } from '../data/comparisonStatisticsRecipes';
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
const inFlight = new Map<string, { fingerprint: string; promise: Promise<void> }>();
const loadedFingerprints = new Map<string, string>();
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
function selectionFingerprint(recipe: StatisticsRecipe): string {
  const dimensions = Object.fromEntries(Object.entries(recipe.dimensions ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({ datasetId: recipe.datasetId, indicatorId: recipe.indicatorId, level: recipe.level, releaseId: recipe.releaseId ?? null, dimensions, includeHealth: Boolean(recipe.includeHealth) });
}
function cancel(key: string) {
  controllers.get(key)?.abort();
  controllers.delete(key);
  inFlight.delete(key);
  generations.set(key, (generations.get(key) ?? 0) + 1);
}
export const regionalStatisticsStore = {
  getSnapshot,
  subscribe(key: string, callback: () => void): () => void {
    const callbacks = listeners.get(key) ?? new Set(); callbacks.add(callback); listeners.set(key, callbacks);
    return () => { callbacks.delete(callback); };
  },
  registerRecipe(key: string, recipe: StatisticsRecipe) {
    const current = getSnapshot(key).selection;
    const view = getEducationPresentationView(key);
    const validViewSelection = (candidate: StatisticsRecipe | null | undefined) => Boolean(view && candidate?.dimensions?.education_stage === view.stage && view.metrics.some(metric => {
      const source = getSocialRecipe(metric.layerKey) ?? getComparisonRecipe(metric.layerKey);
      return source?.dataset_id === candidate?.datasetId && source?.indicator_id === candidate?.indicatorId;
    }));
    if (validViewSelection(current) || (current?.datasetId === recipe.datasetId && current.indicatorId === recipe.indicatorId)) return;
    const saved = persisted[key];
    const matching = validViewSelection(saved) || (saved?.datasetId === recipe.datasetId && saved.indicatorId === recipe.indicatorId);
    const selection = matching && saved ? { ...recipe, ...saved, ...(saved.releaseId && saved.releaseId !== recipe.releaseId ? { allowReleaseFallback: false } : {}) } : recipe;
    const changedMetric = current?.indicatorId !== selection.indicatorId;
    update(key, { ...(changedMetric ? { releases: [], catalog: [] } : {}), selection, data: null, source: null, release: null, health: null });
  },
  setSelection(key: string, recipe: StatisticsRecipe | null) {
    const previous = getSnapshot(key).selection;
    cancel(key);
    loadedFingerprints.delete(key);
    if (recipe) persisted[key] = recipe; else delete persisted[key];
    try { localStorage.setItem(STORAGE, JSON.stringify(persisted)); } catch { /* Optional browser persistence. */ }
    const changedMetric = previous?.datasetId !== recipe?.datasetId || previous?.indicatorId !== recipe?.indicatorId;
    update(key, { ...(changedMetric ? { releases: [], catalog: [] } : {}), selection: recipe, data: null, source: null, release: null, health: null, loading: false, error: null });
  },
  disable(key: string) {
    cancel(key);
    loadedFingerprints.delete(key);
    update(key, { data: null, source: null, release: null, health: null, loading: false, error: null });
  },
  async load(key: string) {
    const recipe = getSnapshot(key).selection;
    if (!recipe) return;
    const fingerprint = selectionFingerprint(recipe);
    if (loadedFingerprints.get(key) === fingerprint && getSnapshot(key).data) return;
    const pending = inFlight.get(key);
    if (pending?.fingerprint === fingerprint) return pending.promise;
    cancel(key);
    const generation = generations.get(key);
    const controller = new AbortController(); controllers.set(key, controller);
    update(key, { loading: true, error: null, data: null, source: null, release: null, health: null });
    let promise!: Promise<void>;
    promise = (async () => {
      try {
        const result = await loadRegionalStatistics(recipe, controller.signal);
        if (controller.signal.aborted || generations.get(key) !== generation) return;
        const effectiveSelection = result.effectiveRecipe ?? recipe;
        loadedFingerprints.set(key, selectionFingerprint(effectiveSelection));
        update(key, { loading: false, selection: effectiveSelection, catalog: result.catalog, releases: result.releases, data: { type: 'FeatureCollection', features: result.features }, source: result.sources, health: result.health ?? null, release: result.values.release });
      } catch (error) {
        if (controller.signal.aborted || generations.get(key) !== generation) return;
        loadedFingerprints.delete(key);
        update(key, { loading: false, error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (inFlight.get(key)?.promise === promise) inFlight.delete(key);
        if (controllers.get(key) === controller) controllers.delete(key);
      }
    })();
    inFlight.set(key, { fingerprint, promise });
    return promise;
  },
};
