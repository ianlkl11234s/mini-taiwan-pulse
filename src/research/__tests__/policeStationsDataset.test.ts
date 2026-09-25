import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { policeStationsSourceCoordinatesAdapter } from "../policeStationsDataset";
import { QueryExecutor } from "../queryExecutor";
import { registeredDatasetsForLayer } from "../researchDatasets";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/research/police-stations-20260626.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps the verified police-station Point snapshot without publishing contact or provenance fields", async () => {
  const result = await new QueryExecutor([policeStationsSourceCoordinatesAdapter]).execute({ datasetId: "tw-police-stations-source-coordinates", select: ["entity_id", "facility_subtype", "geometry"], limit: 1 });
  expect(result).toMatchObject({ totalMatched: 2065, analysisComplete: true });
  expect(policeStationsSourceCoordinatesAdapter.descriptor.layerRefs).toEqual(["policeStation"]);
  expect(registeredDatasetsForLayer("policeStation").map(descriptor => descriptor.datasetId)).toContain("tw-police-stations-source-coordinates");
  expect(policeStationsSourceCoordinatesAdapter.descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "_provenance"]));
  expect(result.sourceRefs[0]?.checksumSha256).toBe("5d2bcc9d34d5f293b70255fbbdf70d7499a701137bd384df42bb60f477b66a16");
  expect(policeStationsSourceCoordinatesAdapter.descriptor.coverage).toContain("2,065");
  expect(policeStationsSourceCoordinatesAdapter.descriptor.coverage).toContain("無地址、電話與 _provenance");
});

it("preserves repeated entity_id rows with version-scoped record IDs and supports Point queries", async () => {
  const executor = new QueryExecutor([policeStationsSourceCoordinatesAdapter]);
  const rows = await executor.execute({ datasetId: "tw-police-stations-source-coordinates", filters: [{ field: "entity_id", op: "eq", value: "pj_pstation_loc_25045_121517" }], select: ["record_id", "entity_id"], limit: 50 });
  const nearby = await executor.execute({ datasetId: "tw-police-stations-source-coordinates", bbox: [120.42, 23.46, 120.47, 23.49], select: ["name", "geometry"], limit: 50 });
  expect(rows.totalMatched).toBe(2);
  expect(new Set(rows.rows.map(row => row.record_id)).size).toBe(2);
  expect(nearby.totalMatched).toBeGreaterThan(0);
  expect(nearby.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(policeStationsSourceCoordinatesAdapter.descriptor.supportedOperations).toContain("nearest");
});

it("rejects changed source bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([policeStationsSourceCoordinatesAdapter]).execute({ datasetId: "tw-police-stations-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
