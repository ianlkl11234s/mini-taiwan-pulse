import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { coastGuardStationsSourceCoordinatesAdapter } from "../coastGuardStationsDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("../runtime/research-public/coast-guard-stations-20260626.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps the verified coast-guard snapshot without publishing contact, service, or provenance fields", async () => {
  const result = await new QueryExecutor([coastGuardStationsSourceCoordinatesAdapter]).execute({ datasetId: "tw-coast-guard-stations-source-coordinates", select: ["entity_id", "facility_subtype", "geometry"], limit: 1 });
  expect(result).toMatchObject({ totalMatched: 269, analysisComplete: true });
  expect(coastGuardStationsSourceCoordinatesAdapter.descriptor.layerRefs).toEqual(["coastGuardStation"]);
  expect(coastGuardStationsSourceCoordinatesAdapter.descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "postal", "service", "aliases", "_provenance"]));
  expect(result.sourceRefs[0]?.checksumSha256).toBe("f8ec09536e9a2e3df7f2da6ee039c4ec000dc36ad1fa9a5d0270058ab044c702");
  expect(coastGuardStationsSourceCoordinatesAdapter.descriptor.coverage).toContain("252");
  expect(coastGuardStationsSourceCoordinatesAdapter.descriptor.coverage).toContain("17");
});

it("preserves duplicate entity_id rows, subtype, and actual Point queries", async () => {
  const executor = new QueryExecutor([coastGuardStationsSourceCoordinatesAdapter]);
  const repeated = await executor.execute({ datasetId: "tw-coast-guard-stations-source-coordinates", filters: [{ field: "entity_id", op: "eq", value: "pj_cga_pier_1" }], select: ["record_id", "entity_id", "facility_subtype"], limit: 50 });
  const nearby = await executor.execute({ datasetId: "tw-coast-guard-stations-source-coordinates", bbox: [120.18, 22.60, 120.29, 22.89], select: ["name", "facility_subtype", "geometry"], limit: 50 });
  expect(repeated.totalMatched).toBe(2);
  expect(new Set(repeated.rows.map(row => row.record_id)).size).toBe(2);
  expect(repeated.rows.every(row => row.facility_subtype === "ocean_pier")).toBe(true);
  expect(nearby.totalMatched).toBeGreaterThan(0);
  expect(nearby.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(coastGuardStationsSourceCoordinatesAdapter.descriptor.supportedOperations).toContain("nearest");
});

it("rejects changed sidecar bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  clearPointDatasetCache();
  await expect(new QueryExecutor([coastGuardStationsSourceCoordinatesAdapter]).execute({ datasetId: "tw-coast-guard-stations-source-coordinates" })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
});
