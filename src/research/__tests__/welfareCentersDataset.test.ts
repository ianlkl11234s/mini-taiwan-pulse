import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";
import { welfareCentersUpstreamCoordinatesAdapter } from "../welfareCentersDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/welfare_centers_upstream_20260812.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers only upstream TGOS welfare centers and answers a new location plus 台/臺 variants", async () => {
  const executor = new QueryExecutor([welfareCentersUpstreamCoordinatesAdapter]);
  const matsu = await executor.execute({ datasetId: "tw-welfare-centers-upstream-coordinates", filters: [{ field: "county", op: "eq", value: "連江縣" }] });
  const taipei = await executor.execute({ datasetId: "tw-welfare-centers-upstream-coordinates", filters: [{ field: "county", op: "eq", value: "台北市" }] });
  expect(matsu).toMatchObject({ totalMatched: 1, rows: [{ uid: "welfare_centers:985a882a", name: "連江縣社會福利服務中心", county: "連江縣", town: "南竿鄉", address: "連江縣南竿鄉介壽村260-3號", coord_method: "upstream_tgos", geometry: { type: "Point", coordinates: [119.95101, 26.157733] } }] });
  expect(taipei.totalMatched).toBe(12);
  expect(registeredDatasetForLayer("welfareCenters")?.datasetId).toBe("tw-welfare-centers-upstream-coordinates");
  expect(welfareCentersUpstreamCoordinatesAdapter.descriptor.fields.map(field => field.name)).not.toContain("service_area");
});

it("permits bbox reads for the selected address coordinates", async () => {
  const result = await new QueryExecutor([welfareCentersUpstreamCoordinatesAdapter]).execute({ datasetId: "tw-welfare-centers-upstream-coordinates", bbox: [119.94, 26.15, 119.96, 26.16] });
  expect(result).toMatchObject({ totalMatched: 1, rows: [{ name: "連江縣社會福利服務中心" }] });
});

it("fails closed if deterministic sidecar bytes change", async () => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { "content-type": "application/geo+json" } })));
  await expect(new QueryExecutor([welfareCentersUpstreamCoordinatesAdapter]).execute({ datasetId: "tw-welfare-centers-upstream-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
