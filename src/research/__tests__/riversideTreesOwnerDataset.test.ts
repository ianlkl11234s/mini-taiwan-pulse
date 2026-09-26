import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { riversideTreesTaipeiOwnerAdapter, riversideTreesTaipeiOwnerDescriptor } from "../riversideTreesOwnerDataset";

const sidecar = "../runtime/owner-only/riverside-trees-taipei/riverside-trees-taipei-owner-20260714.geojson";
const prefix = "/__local-research-owner-only/riverside-trees-taipei/";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/urban_open_space/riverside_trees_taipei/riverside_trees_taipei_20260714.geojson";
const bbox = [121.55, 24.97, 121.56, 24.99] as const;

async function oracle(species?: string) {
  const data = JSON.parse(await readFile(processed, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { species: string } }[] };
  return data.features.filter(({ geometry: { coordinates: [lng, lat] }, properties }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && (species === undefined || properties.species === species)).length;
}
beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${sidecar.slice(0, sidecar.lastIndexOf("/") + 1)}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sidecar))("uses the owner-only sidecar for a bounded historical tree query while retaining null notes", async () => {
  const executor = new QueryExecutor([riversideTreesTaipeiOwnerAdapter]);
  const nearby = await executor.execute({ datasetId: riversideTreesTaipeiOwnerDescriptor.datasetId, bbox, select: ["tree_id", "species", "survey_date", "notes", "geometry"], limit: 100 });
  const celtis = await executor.execute({ datasetId: riversideTreesTaipeiOwnerDescriptor.datasetId, bbox, filters: [{ field: "species", op: "eq", value: "茄苳" }], select: ["tree_id", "species", "notes", "geometry"], limit: 100 });
  expect(await oracle()).toBe(86); expect(nearby.totalMatched).toBe(86);
  expect(await oracle("茄苳")).toBe(5); expect(celtis.totalMatched).toBe(5);
  expect(nearby.rows).toContainEqual(expect.objectContaining({ tree_id: "JM0DN10001", species: "茄苳", survey_date: "2016-11-25", notes: "多主幹2枝", geometry: { type: "Point", coordinates: [121.553778, 24.979803] } }));
  expect(nearby.rows).toContainEqual(expect.objectContaining({ tree_id: "JM0DN10002", notes: null }));
  expect(nearby).toMatchObject({ freshness: "stale", access: { mode: "owner_only" }, sourceRefs: [expect.objectContaining({ checksumSha256: "2bc603414206c8b302754ac1d958916f505f2f3752ae08c640892c86e3ea4dbe" })] });
  expect(riversideTreesTaipeiOwnerDescriptor.timeFields).toEqual([]);
  expect(riversideTreesTaipeiOwnerDescriptor.license).toContain("RIGHTS_HOLD");
});
