import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { womenChildWarningOwnerAdapter, womenChildWarningOwnerDescriptor } from "../justiceEventPointsOwnerDatasets";

const asset = "../runtime/owner-only/justice-event-points/women-child-warning-owner-20260626.geojson";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("exposes only bounded owner-only warning reference points", async () => {
  const result = await new QueryExecutor([womenChildWarningOwnerAdapter]).execute({ datasetId: womenChildWarningOwnerDescriptor.datasetId, bbox: [121.48, 25.02, 121.57, 25.08], select: ["warning_type", "source", "geometry"], limit: 50 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(womenChildWarningOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(womenChildWarningOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["name", "address", "dept", "branch", "contact", "phone", "geocode_formatted"]));
  expect(result.excludedByReason.upstream_geocode_failure).toBe(3);
});

it("fails closed when the sidecar bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([womenChildWarningOwnerAdapter]).execute({ datasetId: womenChildWarningOwnerDescriptor.datasetId })).rejects.toThrow("JUSTICE_WOMEN_CHILD_WARNING_SOURCE_SHA_MISMATCH");
});
