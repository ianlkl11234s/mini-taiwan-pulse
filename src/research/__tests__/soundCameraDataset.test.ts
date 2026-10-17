import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { soundCameraListedLocationsAdapter } from "../soundCameraDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/environment/sound_camera_locations.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("preserves all listed devices, including 66 with missing geometry", async () => {
  const executor = new QueryExecutor([soundCameraListedLocationsAdapter]);
  const all = await executor.execute({ datasetId: "tw-sound-camera-listed-locations", select: ["location_id", "county", "spatial_precision", "geometry"], limit: 1 });
  const unlocated = await executor.execute({ datasetId: "tw-sound-camera-listed-locations", filters: [{ field: "spatial_precision", op: "eq", value: "unlocated" }], select: ["location_id", "county", "spatial_precision", "geometry"], limit: 1 });
  const changhua = await executor.execute({ datasetId: "tw-sound-camera-listed-locations", filters: [{ field: "county", op: "eq", value: "彰化縣" }], select: ["location_id", "county"], limit: 1 });
  expect(all).toMatchObject({ totalMatched: 333, excludedByReason: { missing_geometry: 66 } });
  expect(unlocated).toMatchObject({ totalMatched: 66, rows: [{ geometry: null }] });
  expect(changhua.totalMatched).toBe(9);
  expect(all.sourceRefs[0]?.checksumSha256).toBe("671dcc019a074d5e702bcd0fa0f803a79ce03d9133511151b2d126563db5a5db");
  expect(soundCameraListedLocationsAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(false);
  await expect(executor.execute({ datasetId: "tw-sound-camera-listed-locations", bbox: [120, 22, 121, 24] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});
