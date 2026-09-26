import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { performingVenuesAdapter, performingVenuesDescriptor } from "../performingVenuesDataset";
import { QueryExecutor } from "../queryExecutor";

const source = "../runtime/owner-only/performing-venues/performing-venues-source-20260716.geojson";
const url = "/__local-research-owner-only/performing-venues/performing-venues-source-20260716.geojson";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async (requested: string) => {
    if (requested !== url) throw new Error(`unexpected URL: ${requested}`);
    return new Response(await readFile(source), { headers: { "content-type": "application/geo+json" } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(source))("keeps the complete 861-row owner-only source but permits only bounded reference lookup", async () => {
  const executor = new QueryExecutor([performingVenuesAdapter]);
  expect(performingVenuesDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  await expect(executor.execute({ datasetId: performingVenuesDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  const result = await executor.execute({ datasetId: performingVenuesDescriptor.datasetId, bbox: [121.52, 25.03, 121.56, 25.07], select: ["venue_id", "venue_name", "coord_source", "precision", "geometry"], limit: 100 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.totalMatched).toBeLessThanOrEqual(100);
  expect(result.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(result.sourceRefs[0]).toMatchObject({ checksumSha256: performingVenuesDescriptor.versions[0]?.checksumSha256, reference: url });
});

it.skipIf(!existsSync(source))("preserves source coordinate provenance and null geometry without releasing source address fields", async () => {
  const executor = new QueryExecutor([performingVenuesAdapter]);
  const result = await executor.execute({ datasetId: performingVenuesDescriptor.datasetId, bbox: [118, 21, 123, 27], select: ["venue_id", "coord_source", "precision", "coord_status", "geometry"], limit: 100 });
  expect(result.totalMatched).toBe(857);
  expect(result.excludedByReason).toMatchObject({ missing_geometry: 4 });
  expect(performingVenuesDescriptor.fields.map(field => field.name)).not.toContain("address");
  expect(performingVenuesDescriptor.coverage).toContain("4 筆 no_coord");
  expect(performingVenuesDescriptor.license).toContain("RIGHTS_HOLD");
});
