import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { publicLibrariesListedAdapter, publicLibrariesTgosCoordinatesAdapter } from "../publicLibrariesDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/public-libraries-source-20260717.geojson"), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps all 644 official records and their ten unlocated rows", async () => {
  const executor = new QueryExecutor([publicLibrariesListedAdapter, publicLibrariesTgosCoordinatesAdapter]);
  const listed = await executor.execute({ datasetId: "tw-public-libraries-listed", select: ["uid", "county", "coord_method", "geometry"], limit: 1 });
  const unlocated = await executor.execute({ datasetId: "tw-public-libraries-listed", filters: [{ field: "coord_method", op: "eq", value: "none" }], select: ["geometry"], limit: 20 });
  expect(listed).toMatchObject({ totalMatched: 644, excludedByReason: { missing_geometry: 10 } });
  expect(unlocated).toMatchObject({ totalMatched: 10, rows: Array(10).fill({ geometry: null }) });
  expect(publicLibrariesListedAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(false);
  await expect(executor.execute({ datasetId: "tw-public-libraries-listed", bbox: [121.5, 25, 121.6, 25.1] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});

it("allows bounded spatial reads only for the 570 TGOS address coordinates", async () => {
  const executor = new QueryExecutor([publicLibrariesTgosCoordinatesAdapter]);
  const tgos = await executor.execute({ datasetId: "tw-public-libraries-tgos-coordinates", filters: [{ field: "coord_method", op: "eq", value: "TGOS" }], select: ["coord_method", "geometry"], limit: 1 });
  const nearby = await executor.execute({ datasetId: "tw-public-libraries-tgos-coordinates", bbox: [121.50, 24.99, 121.53, 25.02], select: ["name", "geometry"], limit: 50 });
  expect(tgos).toMatchObject({ totalMatched: 570, excludedByReason: { excluded_by_selection: 64 } });
  expect(nearby.totalMatched).toBeGreaterThan(0);
  expect(publicLibrariesTgosCoordinatesAdapter.descriptor.supportedOperations).toContain("nearest");
  expect(tgos.sourceRefs[0]?.checksumSha256).toBe("d096a63d3b4c6c61be29e236c6e3e4f9f5139a89189b67e541011a112f9805f8");
});

it("rejects changed source bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([publicLibrariesListedAdapter]).execute({ datasetId: "tw-public-libraries-listed" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
