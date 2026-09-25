import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { agriLeisureFarmZonesOwnerAdapter, agriLeisureFarmZonesOwnerDescriptor } from "../agriLeisureFarmZonesOwnerDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = `${process.cwd()}/../runtime/owner-only/agri-leisure-farm-zones/agri-leisure-farm-zones.geojson`;
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset)))); });
afterEach(() => vi.unstubAllGlobals());

it("returns all 109 source attributes and records the seven bounded make_valid repairs", async () => {
  const result = await new QueryExecutor([agriLeisureFarmZonesOwnerAdapter]).execute({ datasetId: agriLeisureFarmZonesOwnerDescriptor.datasetId, select: ["record_id", "la_name", "zone_name", "area_source_ha", "area_ha", "geometry_status", "raw_geometry_valid"], limit: 109 });
  expect(result.totalMatched).toBe(109);
  expect(result.excludedByReason).toMatchObject({ raw_self_intersection_repaired: 7 });
  expect(result.sourceRefs[0]).toMatchObject({ checksumSha256: "80f19d00ae63fe3b86544bb086a454730280ae33e9bb9672684e92f3baf1a02d", reference: "/__local-research-owner-only/agri-leisure-farm-zones/agri-leisure-farm-zones.geojson" });
  expect(result.rows.filter(row => row.geometry_status === "repaired_from_invalid_raw").map(row => row.record_id).sort()).toEqual(["A83", "E74", "G72", "K29", "K78", "M42", "U14"]);
  expect(result.rows.every(row => typeof row.la_name === "string" && typeof row.zone_name === "string" && typeof row.area_source_ha === "number" && typeof row.area_ha === "number")).toBe(true);
  expect(agriLeisureFarmZonesOwnerDescriptor.geometry).toMatchObject({ type: "MultiPolygon", role: "actual", spatialAnalysisEligible: true });
});

it("matches two independent WGS84 bbox oracles, including one repaired source surface", async () => {
  const executor = new QueryExecutor([agriLeisureFarmZonesOwnerAdapter]);
  const maokong = await executor.execute({ datasetId: agriLeisureFarmZonesOwnerDescriptor.datasetId, bbox: [121.580, 24.960, 121.596, 24.980], filters: [{ field: "record_id", op: "eq", value: "A83" }], select: ["record_id", "zone_name", "geometry_status"], limit: 10 });
  const baishihu = await executor.execute({ datasetId: agriLeisureFarmZonesOwnerDescriptor.datasetId, bbox: [121.588, 25.096, 121.604, 25.112], filters: [{ field: "record_id", op: "eq", value: "A80" }], select: ["record_id", "zone_name", "geometry_status", "raw_geometry_valid"], limit: 10 });
  expect(maokong).toMatchObject({ totalMatched: 1, rows: [{ record_id: "A83", zone_name: "貓空", geometry_status: "repaired_from_invalid_raw" }] });
  expect(baishihu).toMatchObject({ totalMatched: 1, rows: [{ record_id: "A80", zone_name: "白石湖", geometry_status: "source_valid", raw_geometry_valid: true }] });
  const sourceRows = await agriLeisureFarmZonesOwnerAdapter.read({}, undefined);
  expect(sourceRows.rows.find(row => row.record_id === "A83")?.geometry).toMatchObject({ type: "MultiPolygon" });
});

it("fails closed when the owner-only sidecar does not match its bound bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([agriLeisureFarmZonesOwnerAdapter]).execute({ datasetId: agriLeisureFarmZonesOwnerDescriptor.datasetId })).rejects.toThrow("AGRI_LEISURE_FARM_ZONES_ASSET_MISMATCH");
});
