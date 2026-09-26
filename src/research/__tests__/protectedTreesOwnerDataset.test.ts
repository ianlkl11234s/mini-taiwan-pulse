import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { protectedTreesOwnerAdapter, protectedTreesOwnerDescriptor } from "../protectedTreesOwnerDataset";
import { QueryExecutor } from "../queryExecutor";

const sidecar = "../runtime/owner-only/protected-trees/protected-trees-owner-20260714.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/urban_open_space/protected_trees_national/protected_trees_national_20260714.geojson";
const chiayiBbox = [120.32, 23.44, 120.35, 23.46] as const;

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sidecar))("keeps the owner-only eight-city receipt, new-place bbox oracle, and source null variant", async () => {
  const source = JSON.parse(await readFile(processed, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { city: string; tree_id: string; species: string; estimated_age_years: number | null } }[] };
  const oracle = source.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= chiayiBbox[0] && lng <= chiayiBbox[2] && lat >= chiayiBbox[1] && lat <= chiayiBbox[3]).length;
  const executor = new QueryExecutor([protectedTreesOwnerAdapter]);
  const nearby = await executor.execute({ datasetId: protectedTreesOwnerDescriptor.datasetId, bbox: chiayiBbox, select: ["tree_id", "city", "species", "estimated_age_years", "geometry"], limit: 100 });
  const chiayi = await executor.execute({ datasetId: protectedTreesOwnerDescriptor.datasetId, filters: [{ field: "city", op: "eq", value: "嘉義縣" }], select: ["tree_id", "city", "estimated_age_years"], limit: 100 });
  const missingAge = await executor.execute({ datasetId: protectedTreesOwnerDescriptor.datasetId, filters: [{ field: "estimated_age_years", op: "eq", value: null }], select: ["estimated_age_years"], limit: 1 });

  expect(nearby.totalMatched).toBe(oracle);
  expect(nearby.rows).toContainEqual(expect.objectContaining({ tree_id: "1", city: "嘉義縣", species: "榕樹", estimated_age_years: 170 }));
  expect(chiayi.totalMatched).toBe(92);
  expect(missingAge.totalMatched).toBe(5236);
  expect(nearby.excludedByReason).toMatchObject({ upstream_invalid_coordinates: 126, missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 });
  expect(protectedTreesOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset" }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(protectedTreesOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "lat", "lon"]));
});
