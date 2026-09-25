import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { amusementParksListedAdapter, amusementParksSourceCoordinatesAdapter } from "../amusementParksDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/research/amusement-parks-source-20260723.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps 27 listed parks while excluding parking proxies from spatial eligibility", async () => {
  const executor = new QueryExecutor([amusementParksListedAdapter, amusementParksSourceCoordinatesAdapter]);
  const listed = await executor.execute({ datasetId: "tw-amusement-parks-listed", select: ["name", "coord_source", "geometry"], limit: 1 });
  const missing = await executor.execute({ datasetId: "tw-amusement-parks-listed", filters: [{ field: "coord_source", op: "eq", value: "none" }], select: ["name", "geometry"], limit: 5 });
  const source = await executor.execute({ datasetId: "tw-amusement-parks-source-coordinates", select: ["name", "coord_source", "geometry"], limit: 1 });
  expect(listed).toMatchObject({ totalMatched: 27, excludedByReason: { missing_geometry: 1 } });
  expect(missing).toMatchObject({ totalMatched: 1, rows: [{ geometry: null }] });
  expect(source.totalMatched).toBe(24);
  expect(source.rows[0]?.coord_source).toBe("park_address");
  expect(listed.sourceRefs[0]?.checksumSha256).toBe("65e70b6312204b5b40b974e382e328f88d872d139a845e435c6e70e3b1b0c4ea");
  expect(amusementParksListedAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(false);
  expect(amusementParksSourceCoordinatesAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(true);
  await expect(executor.execute({ datasetId: "tw-amusement-parks-listed", bbox: [120, 22, 121, 24] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});
