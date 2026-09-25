import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { agriWholesaleMarketOwnerAdapter, agriWholesaleMarketOwnerDescriptor } from "../agriWholesaleMarketOwnerDataset";

const sidecar = "../runtime/owner-only/agri-wholesale-market/agri-wholesale-market-owner-20260525.geojson";
const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/agriculture/agri_wholesale_market_companies/agri_wholesale_market_companies.geojson";
const bboxes = [[121.45, 25.02, 121.55, 25.1], [120.25, 22.55, 120.4, 22.7]] as const;
beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("matches two independent full-source geographic counts without exposing company identifiers", async () => {
  const original = JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: number[] } }[] };
  const executor = new QueryExecutor([agriWholesaleMarketOwnerAdapter]);
  for (const bbox of bboxes) {
    const count = original.features.filter(({ geometry }) => bbox[0] <= geometry.coordinates[0]! && geometry.coordinates[0]! <= bbox[2] && bbox[1] <= geometry.coordinates[1]! && geometry.coordinates[1]! <= bbox[3]).length;
    const result = await executor.execute({ datasetId: agriWholesaleMarketOwnerDescriptor.datasetId, bbox, select: ["record_id", "company_name", "geometry"], limit: 53 });
    expect(result.totalMatched).toBe(count);
  }
  expect(agriWholesaleMarketOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["統一編號", "負責人", "公司地址", "lon", "lat"]));
  expect(agriWholesaleMarketOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
});
