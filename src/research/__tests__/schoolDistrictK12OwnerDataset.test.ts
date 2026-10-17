import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearSchoolDistrictK12SnapshotCache, schoolDistrictElementaryOwnerAdapter, schoolDistrictElementaryOwnerDescriptor, schoolDistrictJuniorOwnerAdapter, schoolDistrictJuniorOwnerDescriptor, validateSchoolDistrictK12Snapshot } from "../schoolDistrictK12OwnerDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = new URL("../../../../runtime/owner-only/school-district-k12/school_district_k12_20260809.geojson", import.meta.url);

beforeEach(() => { clearSchoolDistrictK12SnapshotCache(); vi.stubGlobal("fetch", vi.fn(async () => { const bytes = await readFile(asset); return new Response(bytes, { headers: { "content-length": String(bytes.byteLength), "content-type": "application/geo+json" } }); })); });
afterEach(() => vi.unstubAllGlobals());

it.skipIf(!existsSync(asset))("pins the fixed processed receipt and preserves partial-village proxy semantics", async () => {
  const result = await new QueryExecutor([schoolDistrictElementaryOwnerAdapter]).execute({ datasetId: "eduDistrictElementary", filters: [{ field: "precision", op: "eq", value: "village_partial" }], select: ["district_id", "precision", "lin_specs"], limit: 1 });
  expect(result.totalMatched).toBe(474);
  expect(result.cost).toMatchObject({ rowsScanned: 860, bytesScanned: 21_710_315, downloadedBytes: 21_710_315 });
  expect(schoolDistrictElementaryOwnerDescriptor).toMatchObject({ layerRefs: ["eduDistrictElementary"], geometry: { type: "MultiPolygon", role: "proxy", spatialAnalysisEligible: false }, access: { mode: "owner_only", query: { supportsBbox: true } } });
  expect(schoolDistrictElementaryOwnerDescriptor.versions[0]?.checksumSha256).toBe("b461e2ec305880a579874068ef955e11734acb4567718916e20be09c969584b4");
  expect(schoolDistrictElementaryOwnerDescriptor.license).toContain("HOLD");
});

it.skipIf(!existsSync(asset))("returns the independently checked Taipei and Hsinchu bbox counts without asserting address assignment", async () => {
  const executor = new QueryExecutor([schoolDistrictElementaryOwnerAdapter, schoolDistrictJuniorOwnerAdapter]);
  const cases = [
    ["eduDistrictElementary", [121.53, 25.03, 121.55, 25.05], 13], ["eduDistrictJunior", [121.53, 25.03, 121.55, 25.05], 11],
    ["eduDistrictElementary", [120.96, 24.8, 121.02, 24.84], 17], ["eduDistrictJunior", [120.96, 24.8, 121.02, 24.84], 12],
  ] as const;
  for (const [datasetId, bbox, totalMatched] of cases) {
    const result = await executor.execute({ datasetId, bbox, filters: [{ field: "county", op: "contains", value: "市" }], select: ["district_id", "geometry"], limit: 25 });
    expect(result.totalMatched).toBe(totalMatched);
    expect((result.rows[0]?.geometry as { type: string }).type).toBe("MultiPolygon");
  }
  expect(schoolDistrictJuniorOwnerDescriptor.coverage).toContain("239");
});

it("rejects changed bytes and malformed source geometry or schema", async () => {
  clearSchoolDistrictK12SnapshotCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  await expect(new QueryExecutor([schoolDistrictElementaryOwnerAdapter]).execute({ datasetId: "eduDistrictElementary", limit: 1 })).rejects.toThrow("SCHOOL_DISTRICT_K12_SOURCE_MISMATCH");
  expect(() => validateSchoolDistrictK12Snapshot({ type: "FeatureCollection", features: Array.from({ length: 860 }, () => ({ type: "Feature", properties: {}, geometry: null })) })).toThrow("SCHOOL_DISTRICT_K12_ROW_INVALID");
});
