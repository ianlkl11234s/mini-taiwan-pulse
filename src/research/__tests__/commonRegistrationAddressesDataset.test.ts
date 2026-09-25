import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commonRegistrationAddressesAdapter, commonRegistrationAddressesDescriptor } from "../commonRegistrationAddressesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const sidecar = "../runtime/owner-only/common-registration-addresses/common-registration-addresses-owner-202608-r2.geojson";
const upstream = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/business_registry/common_registration_addresses/common_registration_addresses_202608_r2.geojson";
const taipeiBbox = [121.45, 25.0, 121.6, 25.15] as const;

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads the full immutable common-registration source with its published field contract", async () => {
  const result = await new QueryExecutor([commonRegistrationAddressesAdapter]).execute({ datasetId: commonRegistrationAddressesDescriptor.datasetId, limit: 1 });
  expect(result).toMatchObject({ totalMatched: 11_121, freshness: "stale", excludedByReason: { missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 } });
  expect(commonRegistrationAddressesDescriptor).toMatchObject({
    access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } },
    geometry: { role: "proxy", spatialAnalysisEligible: false },
    supportedOperations: ["query_records", "aggregate"],
  });
  expect(commonRegistrationAddressesDescriptor.fields.map(field => field.name)).toEqual(["record_id", "address", "n_companies", "capital_sum", "capital_median", "geometry"]);
});

it("matches the genuine r2 source for a Taipei bbox", async () => {
  const source = JSON.parse(await readFile(upstream, "utf8")) as { features: Array<{ geometry: { coordinates: [number, number] } }> };
  const expected = source.features.filter(({ geometry }) => geometry.coordinates[0] >= taipeiBbox[0] && geometry.coordinates[0] <= taipeiBbox[2] && geometry.coordinates[1] >= taipeiBbox[1] && geometry.coordinates[1] <= taipeiBbox[3]).length;
  const result = await new QueryExecutor([commonRegistrationAddressesAdapter]).execute({ datasetId: commonRegistrationAddressesDescriptor.datasetId, bbox: taipeiBbox, select: ["address", "n_companies", "geometry"], limit: 1 });
  expect(expected).toBe(5_369);
  expect(result.totalMatched).toBe(expected);
  expect(result.rows[0]?.geometry).toMatchObject({ type: "Point" });
});

it("fails closed when the immutable owner-only sidecar changes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([commonRegistrationAddressesAdapter]).execute({ datasetId: commonRegistrationAddressesDescriptor.datasetId })).rejects.toThrow("COMMON_REGISTRATION_ADDRESSES_SOURCE_SHA_MISMATCH");
});
