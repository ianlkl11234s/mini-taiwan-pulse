import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { forestWildlifeReferenceAdapter, forestWildlifeReferenceDescriptor } from "../forestWildlifeReferenceDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const sourcePath = "public/forestry/wildlife_distribution_3rd.geojson";
const hualienBbox = [121.2, 23.5, 121.3, 23.6] as const;

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sourcePath), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps the fixed receipt, a new-place bbox oracle, and opaque source-field semantics", async () => {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as {
    features: { geometry: { coordinates: [number, number] }; properties: { RECORDNO: string; WILDLIFE_: number; PERIMETER: number; TM2X: string; TM2Y: string } }[];
  };
  const oracle = source.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= hualienBbox[0] && lng <= hualienBbox[2] && lat >= hualienBbox[1] && lat <= hualienBbox[3]);
  const executor = new QueryExecutor([forestWildlifeReferenceAdapter]);
  const nearby = await executor.execute({ datasetId: forestWildlifeReferenceDescriptor.datasetId, bbox: hualienBbox, select: ["RECORDNO", "WILDLIFE_", "TM2X", "TM2Y", "geometry"], limit: 100 });
  const sourceValue = await executor.execute({ datasetId: forestWildlifeReferenceDescriptor.datasetId, filters: [{ field: "WILDLIFE_", op: "eq", value: 385 }], select: ["RECORDNO", "WILDLIFE_", "PERIMETER"], limit: 10 });
  const repeatedGrid = await executor.execute({ datasetId: forestWildlifeReferenceDescriptor.datasetId, filters: [{ field: "TM2X", op: "eq", value: "274700" }, { field: "TM2Y", op: "eq", value: "2607700" }], select: ["RECORDNO", "TM2X", "TM2Y"], limit: 10 });

  expect(oracle).toHaveLength(4);
  expect(nearby.totalMatched).toBe(oracle.length);
  expect(nearby.rows).toContainEqual(expect.objectContaining({ RECORDNO: "0840", WILDLIFE_: 385, TM2X: "274750", TM2Y: "2607150" }));
  expect(sourceValue.totalMatched).toBe(1);
  expect(sourceValue.rows).toEqual([{ RECORDNO: "0840", WILDLIFE_: 385, PERIMETER: 0 }]);
  expect(repeatedGrid.totalMatched).toBe(2);
  expect(nearby.excludedByReason).toMatchObject({ source_lineage_hold: 1, duplicate_tm2_grid_locations: 176, missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 });
  expect(forestWildlifeReferenceDescriptor).toMatchObject({ access: { mode: "owner_only", method: "static_asset" }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(forestWildlifeReferenceDescriptor.license).toContain("SOURCE_LINEAGE_HOLD");
});
