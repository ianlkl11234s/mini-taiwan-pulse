import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { communityCentersListedAdapter } from "../communityCentersListedDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/community-centers-listed-source-20260717.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync("../runtime/research-public/community-centers-listed-source-20260717.geojson"))("keeps every source listing, including proxies and unlocated centers, outside spatial analysis", async () => {
  const executor = new QueryExecutor([communityCentersListedAdapter]);
  const all = await executor.execute({ datasetId: "tw-community-centers-listed", limit: 1 });
  const listed = await executor.execute({ datasetId: "tw-community-centers-listed", filters: [{ field: "county", op: "eq", value: "台北市" }], limit: 1 });
  const proxies = await executor.execute({ datasetId: "tw-community-centers-listed", filters: [{ field: "coord_method", op: "eq", value: "TGOS" }] });
  const unlocated = await executor.execute({ datasetId: "tw-community-centers-listed", filters: [{ field: "coord_method", op: "eq", value: "no_coord" }], select: ["uid", "geometry"] });
  expect(all).toMatchObject({ totalMatched: 1812, sourceRefs: [{ checksumSha256: "898e50bf7109b80675ac46203cf8c9fb94f88a76549037d373710ff856247774" }] });
  expect(listed).toMatchObject({ totalMatched: 162, rows: [{ uid: "community_centers:A:0001", geometry: { type: "Point" } }] });
  expect(proxies.totalMatched).toBe(1143);
  expect(unlocated).toMatchObject({ totalMatched: 18, excludedByReason: { missing_geometry: 18 } });
  expect(unlocated.rows.every(row => row.geometry === null)).toBe(true);
  expect(communityCentersListedAdapter.descriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  await expect(executor.execute({ datasetId: "tw-community-centers-listed", bbox: [121.54, 25.04, 121.57, 25.06] })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});
