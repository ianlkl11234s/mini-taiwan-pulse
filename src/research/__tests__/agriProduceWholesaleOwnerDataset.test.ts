import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { agriProduceWholesaleOwnerAdapter, agriProduceWholesaleOwnerDescriptor } from "../agriProduceWholesaleOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const runtimeRoot = "../runtime/owner-only/agri-produce-wholesale/", urlPrefix = "/__local-research-owner-only/agri-produce-wholesale/";
const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/agriculture/produce_wholesale_companies/produce_wholesale_companies.geojson";
type Bbox = readonly [number, number, number, number];
async function oracle(bbox: Bbox) { const featureCollection = JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { [key: string]: string } }[] }; return featureCollection.features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]; }).length; }
beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${runtimeRoot}${url.slice(urlPrefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bbox and exposes only safe proxy fields", async () => {
  const executor = new QueryExecutor([agriProduceWholesaleOwnerAdapter]);
  await expect(executor.execute({ datasetId: agriProduceWholesaleOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(agriProduceWholesaleOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(agriProduceWholesaleOwnerDescriptor.supportedOperations).not.toContain("nearest");
  expect(agriProduceWholesaleOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["統一編號", "公司名稱", "負責人", "公司地址", "資本總額", "lon", "lat"]));
});

it("matches Taipei and Taichung full-source oracles and preserves the status variant", async () => {
  const executor = new QueryExecutor([agriProduceWholesaleOwnerAdapter]);
  for (const [bbox, expected] of [[[121.5, 25.02, 121.58, 25.1], 3446], [[120.62, 24.12, 120.75, 24.22], 2296]] as const) {
    const result = await executor.execute({ datasetId: agriProduceWholesaleOwnerDescriptor.datasetId, bbox, filters: [{ field: "company_status", op: "eq", value: "核准設立" }], select: ["business_type", "company_status", "produced_at", "geometry"], limit: 100 });
    expect(await oracle(bbox)).toBe(expected); expect(result.totalMatched).toBe(expected); expect(result.rows.every(row => row.company_status === "核准設立")).toBe(true);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024); expect(result.excludedByReason).toMatchObject({ approved_tgos_geocode_miss: 203 });
  }
  const excludedStatus = await executor.execute({ datasetId: agriProduceWholesaleOwnerDescriptor.datasetId, bbox: [121.5, 25.02, 121.58, 25.1], filters: [{ field: "company_status", op: "eq", value: "解散" }], limit: 1 });
  expect(excludedStatus.totalMatched).toBe(0);
});

it("fails closed for a country-scale bbox", async () => {
  await expect(new QueryExecutor([agriProduceWholesaleOwnerAdapter]).execute({ datasetId: agriProduceWholesaleOwnerDescriptor.datasetId, bbox: [118, 21, 124, 27], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE");
});
