import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { speedCameraListedAdapter, speedCameraTaiwanCoordinatesAdapter } from "../speedCameraDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/research/speed-cameras-source-20260824.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("preserves all source attributes while keeping suspect coordinates out of spatial claims", async () => {
  const executor = new QueryExecutor([speedCameraListedAdapter, speedCameraTaiwanCoordinatesAdapter]);
  const listed = await executor.execute({ datasetId: "tw-speed-cameras-listed", select: ["entity_id", "facility_subtype", "coord_suspect", "fetched_at"], limit: 1 });
  const suspect = await executor.execute({ datasetId: "tw-speed-cameras-listed", filters: [{ field: "coord_suspect", op: "eq", value: true }], select: ["entity_id", "coord_suspect", "geometry"], limit: 1 });
  expect(listed).toMatchObject({ totalMatched: 2805 });
  expect(suspect).toMatchObject({ totalMatched: 62, rows: [{ coord_suspect: true }] });
  expect(speedCameraListedAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(false);
  await expect(executor.execute({ datasetId: "tw-speed-cameras-listed", bbox: [120, 22, 121, 24] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});

it("only enables bounded spatial reads for the 2,743 non-suspect coordinates", async () => {
  const executor = new QueryExecutor([speedCameraTaiwanCoordinatesAdapter]);
  const all = await executor.execute({ datasetId: "tw-speed-cameras-taiwan-coordinates", select: ["coord_suspect", "geometry"], limit: 1 });
  const nearby = await executor.execute({ datasetId: "tw-speed-cameras-taiwan-coordinates", bbox: [121.50, 24.99, 121.53, 25.02], select: ["entity_id", "geometry"], limit: 50 });
  expect(all).toMatchObject({ totalMatched: 2743, excludedByReason: { excluded_by_selection: 62 } });
  expect(all.rows.every(row => row.coord_suspect === false)).toBe(true);
  expect(nearby.totalMatched).toBeGreaterThan(0);
  expect(speedCameraTaiwanCoordinatesAdapter.descriptor.supportedOperations).toContain("nearest");
  expect(all.sourceRefs[0]?.checksumSha256).toBe("749c5fce5c6a54a0327160a7882f3373c4535bb6769e557f439097c3ba57ea3c");
});

it("rejects changed sidecar bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([speedCameraListedAdapter]).execute({ datasetId: "tw-speed-cameras-listed" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
