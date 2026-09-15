import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { SOCIAL_ENABLED_STATISTICS_RECIPES } from '../socialStatisticsRecipes';
import { loadRegionalStatistics, clearRegionalStatisticsCdnCache } from '../regionalStatisticsLoader';
import { statisticsGeometryCache } from '../statisticsGeometryCache';

const root = process.env.SOCIAL_STATISTICS_DATA_ROOT;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.skipIf(!root)('loads all 416 delivered exact selectors through the real hash-validating loader', async () => {
  const base = 'https://social-delivery.test';
  const cdn = resolve(root!, 'output/social-statistics/cdn/v1');
  vi.stubEnv('VITE_STATISTICS_CDN_BASE', base);
  vi.stubEnv('VITE_SOCIAL_STATISTICS_PREVIEW', 'false');
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(base);
    const path = resolve(cdn, '.' + url.pathname);
    expect(path.startsWith(cdn + sep)).toBe(true);
    return new Response(await readFile(path));
  });
  clearRegionalStatisticsCdnCache(); statisticsGeometryCache.clear();
  const results = [];
  for (const recipe of SOCIAL_ENABLED_STATISTICS_RECIPES) {
    for (const option of recipe.release_options) {
      const result = await loadRegionalStatistics({ layerKey: recipe.layer_key, datasetId: recipe.dataset_id,
        indicatorId: recipe.indicator_id, level: recipe.level, releaseId: option.release_id,
        dimensions: option.dimensions, includeHealth: true });
      expect(result.effectiveRecipe.releaseId).toBe(option.release_id);
      expect(result.effectiveRecipe.dimensions).toEqual(option.dimensions);
      expect(result.values.release.period_start).toBe(option.period_start);
      expect(result.health?.status).toBe('OK');
      expect(result.features.length).toBeGreaterThan(0);
      results.push({ key: recipe.layer_key, release: option.release_id, dimensions: option.dimensions,
        observations: result.values.total, observed: result.values.observations.filter(v => v.status === 'observed').length,
        zeros: result.values.observations.filter(v => v.value === 0).length,
        missing: result.values.observations.filter(v => v.value === null).length,
        health: result.health, geometry: result.geometryManifest.sha256 });
    }
  }
  expect(results).toHaveLength(416);
  const first = SOCIAL_ENABLED_STATISTICS_RECIPES[0]!;
  await expect(loadRegionalStatistics({ layerKey: first.layer_key, datasetId: first.dataset_id,
    indicatorId: first.indicator_id, level: first.level, releaseId: 'unknown-release', allowReleaseFallback: true,
    dimensions: first.release_options[0]!.dimensions })).rejects.toThrow('指定統計期別');
  await mkdir('docs/features/social-statistics/evidence', { recursive: true });
  await writeFile('docs/features/social-statistics/evidence/actual-loader-selectors.json', JSON.stringify(results, null, 2) + '\n');
}, 120000);
