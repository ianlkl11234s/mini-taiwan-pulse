import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { clearTaipeiZoningSidecarCache, taipeiZoningAttributeAdapter } from "../zoningAttributeSidecar";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearTaipeiZoningSidecarCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/urban/urban_zoning_taipei.analysis.json"), {
    headers: { "content-type": "application/json" },
  })));
});
afterEach(() => { clearTaipeiZoningSidecarCache(); vi.unstubAllGlobals(); });

it("answers category and source-code variants from all 15,518 records with a pinned receipt", async () => {
  const executor = new QueryExecutor([taipeiZoningAttributeAdapter]);
  const residential = await executor.execute({ datasetId: "urban_zoning_taipei", filters: [{ field: "zone_category", op: "eq", value: "residential" }], limit: 2 });
  const r3 = await executor.execute({ datasetId: "urban_zoning_taipei", filters: [{ field: "zone_code", op: "eq", value: "R3" }], limit: 2 });
  expect(residential).toMatchObject({ totalMatched: 7811, returned: 2, countGrain: "feature", access: { method: "pmtiles_sidecar" } });
  expect(r3.totalMatched).toBeGreaterThan(0);
  expect(residential.sourceRefs[0]?.checksumSha256).toBe("497bc0abf3fcf81457c867a6439c8131204a3ec5de37c02b35d0ecff94d0b646");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(registeredDatasetForLayer("urbanZoningTaipei")?.datasetId).toBe("urban_zoning_taipei");
  expect(taipeiZoningAttributeAdapter.descriptor).toMatchObject({ geometry: { type: "none", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  await expect(executor.execute({ datasetId: "urban_zoning_taipei", bbox: [121.4, 24.9, 121.7, 25.3] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});

it("pages beyond ten thousand features without truncating the source", async () => {
  const executor = new QueryExecutor([taipeiZoningAttributeAdapter]);
  const page = await executor.execute({ datasetId: "urban_zoning_taipei", offset: 15_500, limit: 20 });
  expect(page).toMatchObject({ totalMatched: 15_518, returned: 18, displayTruncated: false, analysisComplete: true });
});

it("fails closed if the sidecar bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"changed":true}', { headers: { "content-type": "application/json" } })));
  await expect(new QueryExecutor([taipeiZoningAttributeAdapter]).execute({ datasetId: "urban_zoning_taipei" })).rejects.toThrow("ZONING_SIDECAR_SHA_MISMATCH");
});
