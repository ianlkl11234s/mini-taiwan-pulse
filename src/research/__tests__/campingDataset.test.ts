import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { campingSourceCoordinatesAdapter } from "../campingDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/tourism/camping_national.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("queries the complete fixed camping snapshot while preserving source status strings", async () => {
  const executor = new QueryExecutor([campingSourceCoordinatesAdapter]);
  const all = await executor.execute({ datasetId: "tw-camping-source-coordinates", select: ["name", "status", "legal_status", "geometry"], limit: 1 });
  expect(all.totalMatched).toBe(1737);
  expect(all.sourceRefs[0]?.checksumSha256).toBe("e15d21b89e040cf9591c46e85bc258cad03b2eb95d13d557691007bfcdfce39e");
  expect(all.rows[0]).toMatchObject({ name: "稻庄休閒農場", status: "營業中", legal_status: "符合相關法規露營場", geometry: { type: "Point" } });
  expect(campingSourceCoordinatesAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(true);
});
