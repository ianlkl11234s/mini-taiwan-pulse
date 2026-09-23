import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { createVerifiedPointDatasetAdapter } from "../verifiedPointDataset";
import { QueryExecutor } from "../queryExecutor";

const encoder = new TextEncoder();
const sha = async (body: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(body)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const feature = (coordSource: string, coordPrecision: string, code: string, geometry: unknown = { type: "Point", coordinates: [121, 25] }) => ({ type: "Feature", properties: { coord_source: coordSource, coord_precision: coordPrecision, code, beds: null }, geometry });

async function setup(features = [feature("upstream_wgs84", "upstream", "a"), feature("tgos", "tgos", "b"), feature("upstream_wgs84", "upstream", "c")]) {
  const body = JSON.stringify({ type: "FeatureCollection", features }); const expectedSha256 = await sha(body);
  const config = { datasetId: "nursing-actual", label: "護理機構 actual", description: "固定 actual subset", sourceUrl: "/welfare/nursing.geojson", expectedSha256, expectedSourceRows: features.length, expectedSelectedRows: 2, selection: { coord_source: "upstream_wgs84", coord_precision: "upstream" },
    fields: [{ name: "record_id", type: "string" as const, nullable: false, nullMeaning: null, unit: null }, { name: "code", type: "string" as const, nullable: true, nullMeaning: "來源未提供", unit: null }, { name: "coord_source", type: "string" as const, nullable: true, nullMeaning: "來源未提供", unit: null }, { name: "coord_precision", type: "string" as const, nullable: true, nullMeaning: "來源未提供", unit: null }, { name: "beds", type: "number" as const, nullable: true, nullMeaning: "來源未提供", unit: "beds" }, { name: "geometry", type: "json" as const, nullable: false, nullMeaning: null, unit: null }], publisher: "fixture", license: "fixture", precision: "upstream actual WGS84" };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: { "content-type": "application/geo+json" } })));
  return config;
}
beforeEach(() => clearPointDatasetCache()); afterEach(() => vi.unstubAllGlobals());

describe("verified point source contract", () => {
  it("retains only its fixed actual subset with source receipt and exclusions", async () => {
    const adapter = createVerifiedPointDatasetAdapter(await setup()); const result = await new QueryExecutor([adapter]).execute({ datasetId: "nursing-actual", limit: 3 });
    expect(result).toMatchObject({ totalMatched: 2, excludedByReason: { excluded_by_selection: 1 }, sourceRefs: [expect.objectContaining({ checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })] });
    expect(result.rows.map(row => row.code)).toEqual(["a", "c"]); expect(adapter.descriptor.layerRefs).toEqual([]); expect(adapter.descriptor.recordGrain).toBe("place"); expect(adapter.descriptor.geometry).toMatchObject({ role: "actual", spatialAnalysisEligible: true });
  });
  it("fails closed for a changed source, source count, or selection count", async () => {
    const config = await setup(); const badHash = { ...config, expectedSha256: "a".repeat(64) };
    await expect(new QueryExecutor([createVerifiedPointDatasetAdapter(badHash)]).execute({ datasetId: badHash.datasetId })).rejects.toThrow("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
    clearPointDatasetCache(); const sourceCountConfig = { ...config, expectedSourceRows: 2 };
    await expect(new QueryExecutor([createVerifiedPointDatasetAdapter(sourceCountConfig)]).execute({ datasetId: sourceCountConfig.datasetId })).rejects.toThrow("VERIFIED_POINT_SOURCE_COUNT_MISMATCH");
    clearPointDatasetCache(); const selectionCountConfig = { ...config, expectedSelectedRows: 1 };
    await expect(new QueryExecutor([createVerifiedPointDatasetAdapter(selectionCountConfig)]).execute({ datasetId: selectionCountConfig.datasetId })).rejects.toThrow("VERIFIED_POINT_SELECTION_COUNT_MISMATCH");
  });
});
