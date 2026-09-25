import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canopyGiantsAdapter, canopyGiantsDescriptor } from "../canopyGiantsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const sourcePath = "public/forestry/canopy_giants_taiwan.geojson";
const taiwanGiantBbox = [121.28, 24.84, 121.33, 24.87] as const;

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sourcePath), {
    headers: { "content-type": "application/geo+json" },
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearPointDatasetCache();
});

it("requires bbox and declares raster-derived points ineligible for nearest analysis", async () => {
  const executor = new QueryExecutor([canopyGiantsAdapter]);
  await expect(executor.execute({ datasetId: canopyGiantsDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(canopyGiantsDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(canopyGiantsDescriptor.supportedOperations).not.toContain("nearest");
});

it("matches a new-place bbox oracle from the exact Mini display artifact", async () => {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as {
    features: { geometry: { coordinates: [number, number] } }[];
  };
  const expected = source.features.filter(({ geometry: { coordinates: [lng, lat] } }) =>
    lng >= taiwanGiantBbox[0] && lng <= taiwanGiantBbox[2] && lat >= taiwanGiantBbox[1] && lat <= taiwanGiantBbox[3],
  ).length;
  const result = await new QueryExecutor([canopyGiantsAdapter]).execute({
    datasetId: canopyGiantsDescriptor.datasetId,
    bbox: taiwanGiantBbox,
    select: ["height_m", "dist_access_m", "elev_m", "geometry"],
    limit: 100,
  });
  expect(result.totalMatched).toBe(expected);
  expect(result.sourceRefs[0]?.checksumSha256).toBe("2b050b7c7d1ccb0391dd867a9c3398f7d4bafbe2a8f863f5f4d4df03bcc01e4d");
  expect(result.freshness).toBe("stale");
  expect(result.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
});

it("rejects bytes that no longer match the immutable display artifact", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([canopyGiantsAdapter]).execute({
    datasetId: canopyGiantsDescriptor.datasetId,
    bbox: taiwanGiantBbox,
  })).rejects.toThrow("CANOPY_GIANTS_SOURCE_SEMANTICS_MISMATCH");
});
