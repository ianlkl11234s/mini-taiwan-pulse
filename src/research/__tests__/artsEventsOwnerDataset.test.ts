import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { artsEventsOwnerAdapter, artsEventsOwnerDescriptor } from "../artsEventsOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const asset = "../runtime/owner-only/arts-events/arts-events-owner-20260716.geojson";
beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(asset))("keeps source-grain show records and null geometry in a fixed historical snapshot", async () => {
  const executor = new QueryExecutor([artsEventsOwnerAdapter]);
  const all = await executor.execute({ datasetId: artsEventsOwnerDescriptor.datasetId, limit: 1 });
  const noCoord = await executor.execute({ datasetId: artsEventsOwnerDescriptor.datasetId, filters: [{ field: "coord_status", op: "eq", value: "no_coord" }], select: ["uid", "title", "geometry"], limit: 1 });
  expect(all).toMatchObject({ totalMatched: 7482, excludedByReason: { missing_geometry: 1361, non_point_geometry: 0, invalid_geometry: 0 } });
  expect(noCoord.totalMatched).toBe(1361);
  expect(noCoord.rows[0]?.geometry).toBe(null);
  expect(artsEventsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(artsEventsOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "webSales", "descriptionFilterHtml"]));
});

it("rejects changed local bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([artsEventsOwnerAdapter]).execute({ datasetId: artsEventsOwnerDescriptor.datasetId })).rejects.toThrow("ARTS_EVENTS_OWNER_SOURCE_MISMATCH");
});
