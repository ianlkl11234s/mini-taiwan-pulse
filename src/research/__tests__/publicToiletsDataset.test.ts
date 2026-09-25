import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { publicToiletsSourceCoordinatesAdapter } from "../publicToiletsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/environment/public_toilets_national.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("queries the pinned full facility snapshot by county and a Hualien bbox", async () => {
  const executor = new QueryExecutor([publicToiletsSourceCoordinatesAdapter]);
  const county = await executor.execute({ datasetId: "tw-public-toilets-source-coordinates", filters: [{ field: "county", op: "eq", value: "花蓮縣" }], limit: 2 });
  const nearby = await executor.execute({ datasetId: "tw-public-toilets-source-coordinates", bbox: [121.596, 23.971, 121.616, 23.989], limit: 50 });
  expect(county.totalMatched).toBeGreaterThan(2);
  expect(nearby.totalMatched).toBeGreaterThan(0);
  expect(nearby.rows.every(row => row.county === "花蓮縣")).toBe(true);
  expect(county.sourceRefs[0]?.checksumSha256).toBe("3f8f9e75b6f05e3697a0af90224bed792e435b1605678ce8182f6045e5d2bc5b");
  expect(registeredDatasetForLayer("publicToilets")?.datasetId).toBe("tw-public-toilets-source-coordinates");
  expect(publicToiletsSourceCoordinatesAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(true);
  expect(publicToiletsSourceCoordinatesAdapter.descriptor.coverage).toContain("type2 有 2 筆空字串");
});

it("fails closed when the facility asset differs from the pinned bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([publicToiletsSourceCoordinatesAdapter]).execute({ datasetId: "tw-public-toilets-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
