import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cemeteryZoningOwnerAdapter, cemeteryZoningOwnerDescriptor } from "../cemeteryZoningOwnerDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = `${process.cwd()}/../runtime/owner-only/cemetery-zoning/cemetery-zoning.geojson`;
beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(asset)))));
afterEach(() => vi.unstubAllGlobals());

it("keeps the two-city split and full source attributes", async () => {
  const result = await new QueryExecutor([cemeteryZoningOwnerAdapter]).execute({ datasetId: cemeteryZoningOwnerDescriptor.datasetId, select: ["zoning_id", "county", "zone_label", "area_ha"], limit: 114 });
  expect(result.totalMatched).toBe(114);
  expect(result.rows.filter(row => row.county === "臺北市")).toHaveLength(12);
  expect(result.rows.filter(row => row.county === "新北市")).toHaveLength(102);
});

it("matches independent Taipei and New Taipei source surface oracles", async () => {
  const executor = new QueryExecutor([cemeteryZoningOwnerAdapter]);
  const a = await executor.execute({ datasetId: cemeteryZoningOwnerDescriptor.datasetId, bbox: [121.594,25.085,121.597,25.088], filters: [{ field: "zoning_id", op: "eq", value: "Z0001" }], select: ["zoning_id", "county", "zone_label"], limit: 10 });
  const b = await executor.execute({ datasetId: cemeteryZoningOwnerDescriptor.datasetId, bbox: [121.480,24.988,121.482,24.991], filters: [{ field: "zoning_id", op: "eq", value: "Z0013" }], select: ["zoning_id", "county", "zone_label"], limit: 10 });
  expect(a.totalMatched).toBe(1); expect(a.rows[0]).toMatchObject({ zoning_id: "Z0001", county: "臺北市" });
  expect(b.totalMatched).toBe(1); expect(b.rows[0]).toMatchObject({ zoning_id: "Z0013", county: "新北市" });
});

it("rejects changed source bytes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"FeatureCollection","features":[]}')));
  await expect(new QueryExecutor([cemeteryZoningOwnerAdapter]).execute({ datasetId: cemeteryZoningOwnerDescriptor.datasetId })).rejects.toThrow("CEMETERY_ZONING_ASSET_MISMATCH");
});
