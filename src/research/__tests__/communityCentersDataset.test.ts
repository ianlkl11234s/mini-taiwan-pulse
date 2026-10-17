import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { communityCentersNativeCoordinatesAdapter } from "../communityCentersDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/civic_facilities/community_centers_national.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers only the bounded native-coordinate subset and handles 台/臺 county variants", async () => {
  const executor = new QueryExecutor([communityCentersNativeCoordinatesAdapter]);
  const taipei = await executor.execute({ datasetId: "tw-community-centers-native-coordinates", filters: [{ field: "county", op: "eq", value: "台北市" }], limit: 1 });
  const native = await executor.execute({ datasetId: "tw-community-centers-native-coordinates", filters: [{ field: "coord_method", op: "eq", value: "native" }] });
  expect(taipei).toMatchObject({ totalMatched: 162, rows: [{ uid: "community_centers:A:0001", name: "敦化", county: "臺北市", town: "松山區", coord_method: "native", geometry: { type: "Point", coordinates: [121.55020970561942, 25.04626391927319] } }] });
  expect(native.totalMatched).toBe(592);
  expect(communityCentersNativeCoordinatesAdapter.descriptor.coverage).toContain("高雄只含 17/38 區");
});

it("permits a Taipei bbox for source-native locations only", async () => {
  const result = await new QueryExecutor([communityCentersNativeCoordinatesAdapter]).execute({
    datasetId: "tw-community-centers-native-coordinates", bbox: [121.54, 25.04, 121.57, 25.06], limit: 50,
  });
  expect(result.totalMatched).toBe(16);
  expect(result.rows.every(row => row.coord_method === "native" && row.county === "臺北市")).toBe(true);
});

it("fails closed if the pinned public snapshot changes", async () => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([communityCentersNativeCoordinatesAdapter]).execute({ datasetId: "tw-community-centers-native-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
