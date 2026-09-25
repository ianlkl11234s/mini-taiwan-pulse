import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { agriRetailOwnerAdapter, agriRetailOwnerDescriptor } from "../agriRetailOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/agri-retail/", prefix = "/__local-research-owner-only/agri-retail/";
const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/agriculture/agri_retail_companies/agri_retail_companies.geojson";
type Bbox = readonly [number, number, number, number];
async function oracle(bbox: Bbox) { const fc = JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: [number, number] } }[] }; return fc.features.filter(feature => { const [x, y] = feature.geometry.coordinates; return x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]; }).length; }
beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });
it("requires bbox and never exposes identity or address fields", async () => { const executor = new QueryExecutor([agriRetailOwnerAdapter]); await expect(executor.execute({ datasetId: agriRetailOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED"); expect(agriRetailOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false }); expect(agriRetailOwnerDescriptor.supportedOperations).not.toContain("nearest"); expect(agriRetailOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["統一編號", "公司名稱", "負責人", "公司地址"])); });
it("matches Taipei and Taichung full-source oracles inside partition limits", async () => { const executor = new QueryExecutor([agriRetailOwnerAdapter]); for (const [bbox, expected] of [[[121.5, 25.02, 121.58, 25.1], 6082], [[120.62, 24.12, 120.75, 24.22], 3987]] as const) { const result = await executor.execute({ datasetId: agriRetailOwnerDescriptor.datasetId, bbox, filters: [{ field: "company_status", op: "eq", value: "核准設立" }], select: ["business_type", "company_status", "produced_at", "geometry"], limit: 100 }); expect(await oracle(bbox)).toBe(expected); expect(result.totalMatched).toBe(expected); expect(result.cost.rowsScanned).toBeLessThanOrEqual(20000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024); expect(result.excludedByReason).toMatchObject({ approved_geocode_miss: 359 }); } });
it("fails closed for a country-scale bbox", async () => { await expect(new QueryExecutor([agriRetailOwnerAdapter]).execute({ datasetId: agriRetailOwnerDescriptor.datasetId, bbox: [118, 21, 124, 27], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE"); });
