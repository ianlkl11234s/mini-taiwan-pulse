import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mentalHealthFacilitiesUpstreamCoordinatesAdapter } from "../mentalHealthFacilitiesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

const adapters = [mentalHealthFacilitiesUpstreamCoordinatesAdapter];

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/welfare/mental_health_facilities_national.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers only the direct-source subset and preserves the complete source receipt", async () => {
  const executor = new QueryExecutor(adapters);
  const taipei = await executor.execute({ datasetId: "tw-mental-health-facilities-upstream-coordinates", filters: [{ field: "name", op: "eq", value: "台北市中正區社區心理衛生中心" }] });

  expect(taipei).toMatchObject({ totalMatched: 1, rows: [{ uid: "welfare_00027", name: "臺北市中正區社區心理衛生中心", permit_status: "C04" }], excludedByReason: { excluded_by_selection: 7 } });
  expect((await executor.execute({ datasetId: mentalHealthFacilitiesUpstreamCoordinatesAdapter.descriptor.datasetId })).sourceRefs[0]).toMatchObject({ checksumSha256: "b72e5a8102b409612fabda14b2fbff54dd6e51d144bdae31eb0d87e7ed8c4e34" });
  expect(registeredDatasetForLayer("welfareMentalHealth")?.datasetId).toBe("tw-mental-health-facilities-upstream-coordinates");
  expect(executor.describe("tw-mental-health-facilities-google-exact")).toBeNull();
  expect(executor.describe("tw-mental-health-facilities-google-approximate")).toBeNull();
});

it("allows spatial reads only for the direct-source coordinate subset", async () => {
  const executor = new QueryExecutor(adapters);
  await expect(executor.execute({ datasetId: "tw-mental-health-facilities-upstream-coordinates", bbox: [121.52, 25.03, 121.54, 25.05] })).resolves.toMatchObject({ totalMatched: 2 });
});

it("fails closed if the fixed 70-record source bytes change", async () => {
  const executor = new QueryExecutor([mentalHealthFacilitiesUpstreamCoordinatesAdapter]);
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { "content-type": "application/geo+json" } })));
  clearPointDatasetCache();
  await expect(executor.execute({ datasetId: "tw-mental-health-facilities-upstream-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
