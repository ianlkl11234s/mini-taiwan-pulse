import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadReleaseGate() {
  vi.resetModules();
  const recipes = await import('../comparisonStatisticsRecipes');
  const views = await import('../statisticsPresentationViews');
  const groups = await import('../medicalStatisticsGroups');
  const catalog = await import('../../components/sidebar/layerCatalog');
  return { recipes, views, groups, catalog };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('statistics comparison release gate', () => {
  it('keeps comparisons local-only for production defaults while preserving raw selectors and education views', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_STATISTICS_COMPARISONS_ENABLED', 'false');
    const { recipes, views, groups, catalog } = await loadReleaseGate();

    expect(recipes.COMPARISON_ENABLED_RECIPES).toHaveLength(188);
    expect(recipes.STATISTICS_COMPARISONS_UI_ENABLED).toBe(false);
    expect(recipes.COMPARISON_UI_RECIPES).toEqual([]);
    expect(views.EDUCATION_PRESENTATION_VIEWS).toHaveLength(12);
    expect(views.EDUCATION_PRESENTATION_VIEWS.every(view => view.metrics.length > 0 && view.metrics.every(metric => !metric.layerKey.startsWith('statsComparison')))).toBe(true);
    expect(Object.values(views.EDUCATION_PRESENTATION_VIEW_BY_KEY).every(view => view.metrics.every(metric => !metric.layerKey.startsWith('statsComparison')))).toBe(true);
    expect(groups.MEDICAL_STATISTICS_GROUPS.find(group => group.key === 'hospitalCount')?.options.map(option => option.key)).toEqual(['statsHealthHospitalCount']);
    expect(groups.STATISTICS_TOGGLE_GROUPS.every(group => group.options.length > 0 && group.options.every(option => !String(option.key).startsWith('statsComparison')))).toBe(true);
    expect(groups.STATISTICS_TOGGLE_GROUPS.some(group => group.key === 'a2AccidentCount')).toBe(false);
    expect(catalog.STATISTICS_DATA_THEMES.some(theme => theme.title === '統計比較')).toBe(false);
    expect(catalog.STATISTICS_TAB_THEMES.flatMap(theme => theme.groups).flatMap(group => group.layers).some(layer => String(layer.key).startsWith('statsComparison'))).toBe(false);
  });

  it('shows every comparison recipe during development', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_STATISTICS_COMPARISONS_ENABLED', 'false');
    const { recipes, views, groups, catalog } = await loadReleaseGate();

    expect(recipes.STATISTICS_COMPARISONS_UI_ENABLED).toBe(true);
    expect(recipes.COMPARISON_UI_RECIPES).toHaveLength(188);
    expect(views.EDUCATION_PRESENTATION_VIEWS.some(view => view.metrics.some(metric => metric.layerKey.startsWith('statsComparison')))).toBe(true);
    expect(groups.MEDICAL_STATISTICS_GROUPS.find(group => group.key === 'hospitalCount')?.options).toHaveLength(3);
    expect(catalog.STATISTICS_DATA_THEMES.some(theme => theme.title === '統計比較')).toBe(true);
  });

  it('accepts an explicit production release opt-in', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_STATISTICS_COMPARISONS_ENABLED', 'true');
    const { recipes, catalog } = await loadReleaseGate();

    expect(recipes.STATISTICS_COMPARISONS_UI_ENABLED).toBe(true);
    expect(recipes.COMPARISON_UI_RECIPES).toHaveLength(188);
    expect(catalog.STATISTICS_TAB_THEMES.flatMap(theme => theme.groups).flatMap(group => group.layers).filter(layer => String(layer.key).startsWith('statsComparison'))).not.toHaveLength(0);
  });
});
