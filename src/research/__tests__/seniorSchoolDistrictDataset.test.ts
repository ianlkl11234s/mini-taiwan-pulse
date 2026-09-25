import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { clearSeniorSchoolDistrictSnapshotCache, createSeniorSchoolDistrictDatasetAdapter, seniorSchoolDistrictDescriptor, validateSeniorSchoolDistrictSnapshot } from "../seniorSchoolDistrictDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = new URL("../../../public/education/school_district_senior_full.geojson", import.meta.url);

describe("115-school-year senior school district full-surface reader", () => {
  it("SHA-binds all 15 full county-boundary proxy surfaces", async () => {
    clearSeniorSchoolDistrictSnapshotCache();
    const bytes = await readFile(asset);
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
    const result = await new QueryExecutor([createSeniorSchoolDistrictDatasetAdapter(fetcher)]).execute({ datasetId: "eduDistrictSenior", filters: [{ field: "district", op: "eq", value: "中投區" }], select: ["district", "district_no", "county_count", "rule_row_count", "area_km2", "geometry"], limit: 1 });
    expect(fetcher).toHaveBeenCalledWith("/education/school_district_senior_full.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result.totalMatched).toBe(1); expect(result.cost).toMatchObject({ rowsScanned: 15, bytesScanned: 12_238_327 });
    expect(result.rows[0]).toMatchObject({ district: "中投區", district_no: "9", county_count: 2, rule_row_count: 6, area_km2: 6337.41 });
    expect((result.rows[0]!.geometry as { type: string }).type).toBe("MultiPolygon");
    expect(result.sourceRefs.map(source => source.checksumSha256)).toEqual(["c3b4df7dee7639dfe18e89134e2dd418b1a552639e0cad51b2579071c996e339"]);
  });

  it("matches independent Taipei and Taichung interior bboxes while remaining a proxy", async () => {
    clearSeniorSchoolDistrictSnapshotCache();
    const bytes = await readFile(asset); const executor = new QueryExecutor([createSeniorSchoolDistrictDatasetAdapter(vi.fn(async () => new Response(bytes)))]);
    for (const [index, [bbox, expected]] of ([[ [121.5599, 25.0320, 121.5601, 25.0322], "基北區" ], [[120.6799, 24.1420, 120.6801, 24.1422], "中投區" ]] as const).entries()) {
      const result = await executor.execute({ datasetId: "eduDistrictSenior", bbox, select: ["district", "geometry"], limit: 2 });
      expect(result.rows).toContainEqual(expect.objectContaining({ district: expected }));
      expect(result.cost).toMatchObject({ downloadedBytes: index === 0 ? 12_238_327 : 0, cacheHit: index > 0 });
    }
    expect(seniorSchoolDistrictDescriptor.geometry).toMatchObject({ type: "MultiPolygon", role: "proxy", spatialAnalysisEligible: false });
  });

  it("fails closed for changed bytes or malformed properties", async () => {
    clearSeniorSchoolDistrictSnapshotCache();
    await expect(new QueryExecutor([createSeniorSchoolDistrictDatasetAdapter(vi.fn(async () => new Response("{}")))]).execute({ datasetId: "eduDistrictSenior" })).rejects.toThrow("SENIOR_SCHOOL_DISTRICT_SOURCE_MISMATCH");
    expect(() => validateSeniorSchoolDistrictSnapshot({ type: "FeatureCollection", features: Array.from({ length: 15 }, () => ({ type: "Feature", properties: {}, geometry: null })) })).toThrow("SENIOR_SCHOOL_DISTRICT_ROW_INVALID");
  });
});
