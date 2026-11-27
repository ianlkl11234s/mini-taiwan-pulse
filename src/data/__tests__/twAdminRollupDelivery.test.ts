import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { TW_ADMIN_ROLLUP_STATISTICS_DOCUMENT } from "../twAdminRollupStatisticsRecipes";
import { loadRegionalStatistics, clearRegionalStatisticsCdnCache } from "../regionalStatisticsLoader";
import { statisticsGeometryCache } from "../statisticsGeometryCache";

/**
 * 真資料閘門（本機、未上傳 R2 前的驗收）：在 taipei-gis-analytics 的 tw_h3_grid worktree 跑
 *   docs/topic-research/tw_h3_grid/stat_bundles/assemble_admin_rollup_frontend.py <recipes> <out>/v1
 * 後，設 TW_ADMIN_ROLLUP_CDN＝<out>/v1、TW_ADMIN_ROLLUP_GEOMETRY_DIR＝線上參考界快取目錄
 * （data/raw/demographics/statistics_reference_geometry；增量包不含 geometry，原樣取線上同 sha 的檔）。沒設就略過。
 */
const cdn = process.env.TW_ADMIN_ROLLUP_CDN;
const geometryDir = process.env.TW_ADMIN_ROLLUP_GEOMETRY_DIR;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function stubCdn(base: string, dir: string, geometries: string) {
  vi.stubEnv("VITE_STATISTICS_CDN_BASE", base);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(base);
    const local = resolve(dir, "." + url.pathname);
    expect(local.startsWith(dir + sep)).toBe(true);
    const path = existsSync(local) ? local : resolve(geometries, basename(url.pathname));
    return new Response(await readFile(path));
  });
  clearRegionalStatisticsCdnCache(); statisticsGeometryCache.clear();
}

it.skipIf(!cdn || !geometryDir)("loads the 10 village／township selectors through the real hash-validating loader", async () => {
  stubCdn("https://admin-rollup-delivery.test", cdn!, geometryDir!);
  const count = { village: 7973, township: 368 } as const;
  const facts: Record<string, { observed: number; missing: number }> = {};
  for (const recipe of TW_ADMIN_ROLLUP_STATISTICS_DOCUMENT.recipes) {
    expect(recipe.release_options).toHaveLength(1);
    const option = recipe.release_options[0]!;
    const result = await loadRegionalStatistics({
      layerKey: recipe.layer_key, datasetId: recipe.dataset_id, indicatorId: recipe.indicator_id,
      level: recipe.level, releaseId: option.release_id, dimensions: option.dimensions, includeHealth: true,
    });
    expect(result.effectiveRecipe.releaseId).toBe(option.release_id);
    expect(result.features).toHaveLength(count[recipe.level as "village" | "township"]);
    const observed = result.values.observations.filter((o) => o.status === "observed");
    // 缺值一律 missing（單斜線）且 value 為 null，不補 0
    expect(result.values.observations.every((o) => o.status === "observed" || (o.status === "missing" && o.value === null))).toBe(true);
    facts[recipe.layer_key] = { observed: observed.length, missing: result.values.observations.length - observed.length };
  }
  expect(facts).toEqual({
    statsVillageCompanyCount: { observed: 7771, missing: 202 }, statsVillageCompanyPer1000: { observed: 7687, missing: 286 },
    statsVillageCompanySpecialty: { observed: 4188, missing: 3785 }, statsVillageSalePriceMedian: { observed: 3377, missing: 4596 },
    statsVillageSaleCount: { observed: 7973, missing: 0 },
    statsTownshipCompanyCount: { observed: 358, missing: 10 }, statsTownshipCompanyPer1000: { observed: 351, missing: 17 },
    statsTownshipCompanySpecialty: { observed: 309, missing: 59 }, statsTownshipSalePriceMedian: { observed: 288, missing: 80 },
    statsTownshipSaleCount: { observed: 368, missing: 0 },
  });
}, 600000);
