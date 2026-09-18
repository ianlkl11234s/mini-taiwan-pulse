import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { describeLayerStatistics, summarizeLayer } from "../layerStatistics";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
const feature = (properties: Record<string, unknown>, geometry: unknown = { type: "Point", coordinates: [121.5, 25] }) => ({ type: "Feature", properties, geometry });
const fc = (features: unknown[]) => ({ type: "FeatureCollection", features });
const county = fc([feature({ area_name: "臺北市", area_code: "63000" }, null), feature({ area_name: "新北市", area_code: "65000" }, null)]);
const town = fc([feature({ area_name: "臺北市中正區", area_code: "63000050" }, null), feature({ area_name: "新北市中正區", area_code: "test-other" }, null)]);
function setup(data: unknown) { vi.stubGlobal("fetch", vi.fn(async (input: string) => new Response(JSON.stringify(input.includes("county-reference") ? county : input.includes("township-reference") ? town : data), { headers: { "content-type": "application/geo+json" } }))); }
beforeEach(() => clearPointDatasetCache());
afterEach(() => vi.unstubAllGlobals());
const schools = fc([
  feature({ code: "a", city: "臺北市", district: "中正區", school_level: "高中", region_type: null }),
  feature({ code: "a", city: "台北市", district: "中正區", school_level: "附設國中", region_type: "偏遠" }, null),
  feature({ code: "b", city: "新北市", district: "中正區", school_level: "國小", region_type: null }),
  feature({ code: null, city: null, district: null, school_level: null, region_type: null }, { type: "Point", coordinates: [999, 99] }),
]);
describe("generic full-source statistics", () => {
  it("counts records rather than rendered geometry or deduplicated school IDs", async () => {
    setup(schools); const result = await summarizeLayer({ layerKey: "schools" });
    expect(result.totalRows).toBe(4); expect(result.totalMatched).toBe(4);
    expect(result.identity).toMatchObject({ duplicateExtraRecords: 1, missing: 1, deduplicated: false });
    expect(result.geometryIssues).toEqual({ missing_geometry: 1, non_point_geometry: 0, invalid_geometry: 1 });
    expect(result).toMatchObject({ artifactComplete: true, populationCoverage: "unknown", sourceYear: null, bounds: [121.5, 25, 121.5, 25] });
  });
  it("preserves unknown groups and reconciles all group counts", async () => {
    setup(schools); const result = await summarizeLayer({ layerKey: "schools", groupBy: ["region_type"] });
    expect(result.groups).toEqual(expect.arrayContaining([expect.objectContaining({ values: { region_type: null }, count: 3 })]));
    expect((result.groups as { count: number }[]).reduce((a, b) => a + b.count, 0)).toBe(result.totalMatched);
  });
  it("normalizes 台/臺, identifies unknown filter rows, permits explicit null", async () => {
    setup(schools); const result = await summarizeLayer({ layerKey: "schools", filters: [{ field: "city", value: "台北市" }] });
    expect(result).toMatchObject({ totalMatched: 2, filterUnknownRows: 1, countCompleteness: "partial_attribution" });
    expect((await summarizeLayer({ layerKey: "schools", filters: [{ field: "city", value: null }] })).totalMatched).toBe(1);
  });
  it("does not call documented non-remote nulls unknown filter exclusions", async () => {
    setup(schools);
    expect(await summarizeLayer({ layerKey: "schools", filters: [{ field: "region_type", value: "偏遠" }] })).toMatchObject({ totalMatched: 1, filterUnknownRows: 0, countCompleteness: "complete_for_asset" });
  });
  it("keeps same-name districts in different cities separate and pages ties deterministically", async () => {
    setup(schools); const first = await summarizeLayer({ layerKey: "schools", groupBy: ["district"], limit: 1 });
    expect(first.groupBy).toEqual(["city", "district"]); expect(first.groupTotal).toBe(3); expect(first.nextOffset).toBe(1);
    const second = await summarizeLayer({ layerKey: "schools", groupBy: ["district"], offset: 1, limit: 2 });
    expect(second.nextOffset).toBeNull(); expect(second.truncated).toBe(false);
    expect((second.groups as { rank: number }[]).map(g => g.rank)).toEqual([2, 2]);
  });
  it("declares support and returns provenance and bounded values before statistics", async () => {
    setup(schools); const result = await describeLayerStatistics({ layerKey: "schools" });
    expect(result.capabilities).toMatchObject({ count: true, area: false, spatialJoin: false });
    expect(result.sourceRefs).toHaveLength(3);
    expect((result.sourceRefs as {checksumSha256: string}[])[0]!.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it("uses anchored address-derived attribution and distinguishes police department categories", async () => {
    setup(fc([
      feature({ entity_id: "1", address: "100臺北市中正區測試路", facility_subtype: "police_dept" }),
      feature({ entity_id: "2", address: "新北市中正區測試路", facility_subtype: "substation" }),
      feature({ entity_id: "3", address: "某地址提及臺北市中正區", facility_subtype: "precinct" }),
    ]));
    const all = await summarizeLayer({ layerKey: "policeStations", groupBy: ["city"] });
    expect(all).toMatchObject({ layerKey: "policeStation", totalMatched: 3, administrativeAttribution: { method: "address_prefix", unmatchedCity: 1 } });
    const r = await summarizeLayer({ layerKey: "policeStation", filters: [{ field: "city", value: "台北市" }, { field: "facility_subtype", value: "police_dept" }] });
    expect(r.totalMatched).toBe(1);
  });
  it.each([
    { layerKey: "schools", groupBy: ["does_not_exist"] },
    { layerKey: "schools", groupBy: ["city", "city"] },
    { layerKey: "schools", filters: [{ field: "city", value: 1 }] },
    { layerKey: "schools", limit: 51 },
    { layerKey: "schools", offset: -1 },
    { layerKey: "schools", sql: "select *" },
  ])("rejects unsupported input without claiming zero: %j", async input => {
    setup(schools); await expect(summarizeLayer(input as never)).rejects.toThrow();
  });
  it("does not enable arbitrary registered layer readers", async () => {
    setup(schools); await expect(describeLayerStatistics({ layerKey: "__proto__" })).rejects.toThrow("LAYER_STATISTICS_UNSUPPORTED");
    await expect(summarizeLayer({ layerKey: "schoolsElementary" })).rejects.toThrow("LAYER_STATISTICS_UNSUPPORTED");
  });
  it("counts valid GeoJSON properties:null as missing fields", async () => {
    setup(fc([{ type: "Feature", properties: null, geometry: { type: "Point", coordinates: [121,25] } }]));
    const result = await summarizeLayer({ layerKey: "schools" });
    expect(result).toMatchObject({ totalRows: 1, missingByField: { city: 1, school_level: 1 }, identity: { missing: 1 } });
  });
  it("valid empty is zero; malformed or HTML-success is never zero", async () => {
    setup(fc([])); expect((await summarizeLayer({ layerKey: "schools" })).totalMatched).toBe(0);
    clearPointDatasetCache(); setup({ type: "FeatureCollection" }); await expect(summarizeLayer({ layerKey: "schools" })).rejects.toThrow("INVALID_DATASET");
    clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>SPA</html>", { headers: { "content-type": "text/html" } })));
    await expect(summarizeLayer({ layerKey: "schools" })).rejects.toThrow("DATASET_ASSET_MISSING");
  });
  it("fetch failure is retriable and not cached as zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    await expect(summarizeLayer({ layerKey: "schools" })).rejects.toThrow("DATASET_UNAVAILABLE");
    setup(schools); expect((await summarizeLayer({ layerKey: "schools" })).totalMatched).toBe(4);
  });
});
const local = ["education/schools.geojson", "police_justice/police_stations/police_stations_20260626.geojson", "statistics/county-reference-2025.geojson", "statistics/township-reference.geojson"].every(p => existsSync(`public/${p}`));
describe.skipIf(!local)("local source asset acceptance (not production)", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(readFileSync(`public/${url.replace(/^\.\//, "")}`), { headers: { "content-type": "application/geo+json" } }))));
  it("reconciles the school snapshot and preserves repeated school codes", async () => {
    const result = await summarizeLayer({ layerKey: "schools", groupBy: ["city"], limit: 50 });
    expect(result.totalRows).toBe(4315);
    expect((result.groups as {count: number}[]).reduce((n, g) => n + g.count, 0)).toBe(4315);
    expect(result.identity).toMatchObject({ duplicateExtraRecords: 269 });
    expect(result.administrativeAttribution).toMatchObject({ unmatchedCity: 0, unmatchedDistrict: 0 });
  });
  it("reconciles police source categories and checks both requested cities", async () => {
    const result = await summarizeLayer({ layerKey: "policeStation", groupBy: ["facility_subtype"] });
    expect(result.totalRows).toBe(2065);
    expect((result.groups as {count: number}[]).reduce((n, g) => n + g.count, 0)).toBe(2065);
    const taipei = await summarizeLayer({ layerKey: "policeStation", filters: [{ field: "city", value: "台北市" }] });
    const newTaipei = await summarizeLayer({ layerKey: "policeStation", filters: [{ field: "city", value: "新北市" }] });
    expect(taipei.totalMatched).toBe(161); expect(newTaipei.totalMatched).toBe(212);
    expect(taipei.administrativeAttribution).toMatchObject({ method: "address_prefix", unmatchedCity: 4 });
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(24 * 1024);
  });
});
