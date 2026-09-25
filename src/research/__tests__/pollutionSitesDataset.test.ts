import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { pollutionSitesSourceCoordinatesAdapter } from "../pollutionSitesDataset";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetsForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/research/pollution-sites-20260706.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("preserves active and deannounced records as separate source states", async () => {
  const executor = new QueryExecutor([pollutionSitesSourceCoordinatesAdapter]);
  const active = await executor.execute({ datasetId: "tw-pollution-sites-source-coordinates", filters: [{ field: "is_active", op: "eq", value: 1 }], select: ["site_id", "is_active", "deanno_date"], limit: 1 });
  const deannounced = await executor.execute({ datasetId: "tw-pollution-sites-source-coordinates", filters: [{ field: "is_active", op: "eq", value: 0 }], select: ["site_id", "is_active", "deanno_date"], limit: 1 });
  expect(active.totalMatched).toBe(365);
  expect(active.rows[0]).toMatchObject({ is_active: 1, deanno_date: null });
  expect(deannounced.totalMatched).toBe(7888);
  expect(deannounced.rows[0]?.deanno_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(active.sourceRefs[0]?.checksumSha256).toBe("a9a948ff18112a4ccf82517fc6927a6249ed86f4ebf73d9f27f7f4ed8bfdcab2");
  expect(registeredDatasetsForLayer("pollutionSite").map(item => item.datasetId)).toContain("tw-pollution-sites-source-coordinates");
  expect(registeredDatasetsForLayer("pollutionPenaltyCritical")).toEqual([]);
});

it("rejects a changed fixed source", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([pollutionSitesSourceCoordinatesAdapter]).execute({ datasetId: "tw-pollution-sites-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
