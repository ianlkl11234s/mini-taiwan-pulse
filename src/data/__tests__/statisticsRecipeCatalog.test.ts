import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { deriveStatisticsRecipeCatalog, STATISTICS_RECIPE_CATALOG_SPECS } from "../statisticsRecipeCatalog";

const readJson = (path: string) => JSON.parse(readFileSync(resolve(path), "utf8"));

describe("PF-7 statistics recipe catalog ↔ details", () => {
  for (const spec of STATISTICS_RECIPE_CATALOG_SPECS) {
    it(`${spec.family}: committed catalog is exactly derived from the delivered SSOT (rerun build_statistics_recipe_catalogs.ts)`, () => {
      const source = readJson(spec.source);
      const catalog = readJson(spec.catalog);
      expect(catalog).toEqual(deriveStatisticsRecipeCatalog(source, spec.omitRecipeKeys, spec.source.split("/").pop()!, { keepReleaseOptions: spec.keepReleaseOptions }));
      const catalogKeys = catalog.recipes.map((recipe: { layer_key: string }) => recipe.layer_key);
      expect(catalogKeys).toEqual(source.recipes.map((recipe: { layer_key: string }) => recipe.layer_key));
      expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
      catalog.recipes.forEach((recipe: Record<string, unknown>, index: number) => {
        if (spec.keepReleaseOptions) {
          // Labor: everything except the omitted delivery-only keys stays byte-identical, release_options included.
          const { ...expected } = source.recipes[index];
          for (const key of spec.omitRecipeKeys) delete expected[key];
          expect(recipe).toEqual(expected);
          expect(recipe).not.toHaveProperty("release_summary");
        } else {
          expect(recipe).not.toHaveProperty("release_options");
        }
        for (const key of spec.omitRecipeKeys) expect(recipe).not.toHaveProperty(key);
      });
    });
  }

  it("summaries keep the full-recipe semantics: first delivered option, count, and latest option per education stage", () => {
    const social = readJson("src/data/socialStatisticsRecipes.json");
    const catalog = readJson("src/data/socialStatisticsRecipes.catalog.json");
    type Option = { release_id: string; period_start: string; period_end: string; dimensions: Record<string, string> };
    social.recipes.forEach((recipe: { release_options: Option[] }, index: number) => {
      const summary = catalog.recipes[index].release_summary;
      expect(summary.count).toBe(recipe.release_options.length);
      expect(summary.first?.release_id ?? null).toBe(recipe.release_options[0]?.release_id ?? null);
      for (const [stage, entry] of Object.entries(summary.education_stages ?? {}) as Array<[string, { count: number; latest: Option }]>) {
        const staged = recipe.release_options.filter(option => option.dimensions.education_stage === stage);
        const latest = [...staged].sort((a, b) => b.period_end.localeCompare(a.period_end) || b.period_start.localeCompare(a.period_start))[0]!;
        expect(entry.count).toBe(staged.length);
        expect(entry.latest.release_id).toBe(latest.release_id);
      }
    });
  });

  it("details load lazily through loadingRegistry and are never read silently before loading", async () => {
    vi.resetModules();
    const details = await import("../statisticsRecipeDetails");
    const { loadingRegistry } = await import("../../lib/loadingRegistry");
    const { getAgriRecipe, getAgriRecipeDetails, agriReleaseOptions } = await import("../agriStatisticsRecipes");
    const start = vi.spyOn(loadingRegistry, "start");
    expect(details.statisticsRecipeDetailsLoaded()).toBe(false);
    expect(getAgriRecipe("statsPaddyLandAreaTownship")?.release_summary.count).toBe(1);
    expect(() => getAgriRecipeDetails("statsPaddyLandAreaTownship")).toThrow(details.STATISTICS_RECIPE_DETAILS_NOT_LOADED);
    expect(() => agriReleaseOptions("statsPaddyLandAreaTownship", [])).toThrow(details.STATISTICS_RECIPE_DETAILS_NOT_LOADED);
    expect(getAgriRecipeDetails("notAStatisticsLayer")).toBeUndefined();
    await Promise.all([details.ensureStatisticsRecipeDetails(), details.ensureStatisticsRecipeDetails()]);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledWith("statistics-recipe-details:agri", expect.any(String));
    expect(start).toHaveBeenCalledWith("statistics-recipe-details:social", expect.any(String));
    expect(details.statisticsRecipeDetailsLoaded()).toBe(true);
    expect(getAgriRecipeDetails("statsPaddyLandAreaTownship")?.release_options).toHaveLength(1);
    start.mockRestore();
  });

  it("PF-10: each family loads only its own details (social never pulls agri, and vice versa)", async () => {
    vi.resetModules();
    const details = await import("../statisticsRecipeDetails");
    const { loadingRegistry } = await import("../../lib/loadingRegistry");
    const { getAgriRecipeDetails } = await import("../agriStatisticsRecipes");
    const { getSocialRecipe, getSocialRecipeDetails } = await import("../socialStatisticsRecipes");
    const socialKey = (await import("../socialStatisticsRecipes.catalog.json")).default.recipes[0]!.layer_key;
    const start = vi.spyOn(loadingRegistry, "start");
    await Promise.all([details.ensureStatisticsRecipeDetails("social"), details.ensureStatisticsRecipeDetails(["social"])]);
    expect(start.mock.calls).toEqual([["statistics-recipe-details:social", expect.any(String)]]);
    expect(details.statisticsRecipeDetailsLoaded("social")).toBe(true);
    expect(details.statisticsRecipeDetailsLoaded("agri")).toBe(false);
    expect(details.statisticsRecipeDetailsLoaded()).toBe(false);
    expect(getSocialRecipe(socialKey)).toBeDefined();
    expect(getSocialRecipeDetails(socialKey)?.release_options.length).toBeGreaterThan(0);
    expect(() => getAgriRecipeDetails("statsPaddyLandAreaTownship")).toThrow(details.STATISTICS_RECIPE_DETAILS_NOT_LOADED);
    await details.ensureStatisticsRecipeDetails("agri");
    expect(start.mock.calls.map(([id]) => id)).toEqual(["statistics-recipe-details:social", "statistics-recipe-details:agri"]);
    expect(details.statisticsRecipeDetailsLoaded()).toBe(true);
    start.mockRestore();
  });
});
