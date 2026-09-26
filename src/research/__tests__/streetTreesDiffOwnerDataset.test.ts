import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { streetTreesDiffOwnerAdapter, streetTreesDiffOwnerDescriptor } from "../streetTreesDiffOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";

const root = "../runtime/owner-only/street-trees-diff/";
const prefix = "/__local-research-owner-only/street-trees-diff/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/urban_open_space/street_trees_taipei_diff/street_trees_taipei_diff_20260712.geojson";
type Bbox = readonly [number, number, number, number];

async function rawOracle(bbox: Bbox, status?: string): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { status: string } }[] };
  return source.features.filter(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && (status === undefined || feature.properties.status === status);
  }).length;
}

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox, strips TreeID and free text, and declares proxy geometry", async () => {
  const executor = new QueryExecutor([streetTreesDiffOwnerAdapter]);
  await expect(executor.execute({ datasetId: streetTreesDiffOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(streetTreesDiffOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(streetTreesDiffOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(streetTreesDiffOwnerDescriptor.fields.map(field => field.name)).toEqual(["record_id", "status", "renumber_suspect", "survey_date", "geometry"]);
  expect(streetTreesDiffOwnerDescriptor.coverage).toContain("Wayback 非官方版本化");
  expect(streetTreesDiffOwnerDescriptor.valueSemantics.stale).toContain("disappeared 僅指 TreeID 不在目前清冊");
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches two independent full-source bbox/status oracles within bounded reads", async () => {
  const cases: { bbox: Bbox; status?: "persisted" | "disappeared" | "appeared" }[] = [
    { bbox: [121.502, 25.027, 121.510, 25.040], status: "disappeared" },
    { bbox: [121.552, 25.052, 121.560, 25.070], status: "appeared" },
  ];
  const executor = new QueryExecutor([streetTreesDiffOwnerAdapter]);
  for (const item of cases) {
    const oracle = await rawOracle(item.bbox, item.status);
    const result = await executor.execute({ datasetId: streetTreesDiffOwnerDescriptor.datasetId, bbox: item.bbox, filters: [{ field: "status", op: "eq", value: item.status! }], select: ["status", "renumber_suspect", "survey_date", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(oracle);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it.skipIf(!existsSync(`${root}manifest.json`))("fails closed when a broad bbox selects more than the partition byte budget", async () => {
  await expect(new QueryExecutor([streetTreesDiffOwnerAdapter]).execute({ datasetId: streetTreesDiffOwnerDescriptor.datasetId, bbox: [121.4, 24.9, 121.7, 25.2], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE");
});
