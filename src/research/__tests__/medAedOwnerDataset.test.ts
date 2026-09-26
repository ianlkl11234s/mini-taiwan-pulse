import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { medAedOwnerAdapter, medAedOwnerDescriptor } from "../medAedOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/med-aed/";
const prefix = "/__local-research-owner-only/med-aed/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/emergency_response/aed/aed_20260524.geojson";
type Bbox = readonly [number, number, number, number];

async function rawOracle(bbox: Bbox, category?: string): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { PlaceCategory: string } }[] };
  return source.features.filter(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && (category === undefined || feature.properties.PlaceCategory === category);
  }).length;
}

beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox, keeps safe fields, and does not offer emergency or nearest claims", async () => {
  const executor = new QueryExecutor([medAedOwnerAdapter]);
  await expect(executor.execute({ datasetId: medAedOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(medAedOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(medAedOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(medAedOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "aed_location", "aed_location_desc", "emergency_phone", "lat", "lng"]));
  expect(medAedOwnerDescriptor.coverage).toContain("4 筆在範圍外");
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches two independent full-source bbox and category oracles within bounded reads", async () => {
  const cases: { bbox: Bbox; category?: string; expected: number }[] = [
    { bbox: [121.48, 25.02, 121.58, 25.10], category: "學校、大型集會場所", expected: 453 },
    { bbox: [120.28, 22.56, 120.38, 22.67], expected: 666 },
  ];
  const executor = new QueryExecutor([medAedOwnerAdapter]);
  for (const item of cases) {
    const oracle = await rawOracle(item.bbox, item.category);
    const result = await executor.execute({ datasetId: medAedOwnerDescriptor.datasetId, bbox: item.bbox, filters: item.category ? [{ field: "place_category", op: "eq", value: item.category }] : [], select: ["place_id", "aed_id", "place_category", "geometry"], limit: 100 });
    expect(oracle).toBe(item.expected); expect(result.totalMatched).toBe(oracle);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(10_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it.skipIf(!existsSync(`${root}manifest.json`))("fails closed when a broad bbox exceeds the row scan budget", async () => {
  await expect(new QueryExecutor([medAedOwnerAdapter]).execute({ datasetId: medAedOwnerDescriptor.datasetId, bbox: [118, 21.5, 122.5, 26.5], limit: 1 })).rejects.toThrow("SCAN_BUDGET_EXCEEDED");
});
