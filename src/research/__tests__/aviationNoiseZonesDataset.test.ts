import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { aviationNoiseZonesDescriptor, createAviationNoiseZonesDatasetAdapter, validateAviationNoiseZonesSnapshot } from "../aviationNoiseZonesDataset";
import { QueryExecutor } from "../queryExecutor";
import { isMapEligibleGeometry } from "../researchAnalysisSession";

const asset = new URL("../../../public/environment/aviation_noise_zones.geojson", import.meta.url);

describe("aviation noise legal village zones fixed snapshot adapter", () => {
  it("checksum-binds all 76 administrative proxy polygons and preserves non-contour semantics", async () => {
    const bytes = await readFile(asset);
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
    const result = await new QueryExecutor([createAviationNoiseZonesDatasetAdapter(fetcher)]).execute({ datasetId: aviationNoiseZonesDescriptor.datasetId, filters: [{ field: "county", op: "eq", value: "桃園市" }], select: ["zone_id", "zone_levels", "display_zone_level", "effective_date", "spatial_precision", "is_measured_contour", "geometry"], limit: 50 });
    expect(fetcher).toHaveBeenCalledWith("/environment/aviation_noise_zones.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result.totalMatched).toBe(31); expect(result.cost).toMatchObject({ rowsScanned: 76, bytesScanned: 1_072_567 });
    expect(result.rows.find(row => row.zone_levels === "1,2,3")).toMatchObject({ display_zone_level: 3, effective_date: null, spatial_precision: "admin_join", is_measured_contour: false });
    expect(aviationNoiseZonesDescriptor.geometry).toMatchObject({ type: "Polygon", role: "proxy", spatialAnalysisEligible: false });
    expect(result.sourceRefs.map(source => source.sourceId)).toEqual(["tycg:26115", "kcg:107165", aviationNoiseZonesDescriptor.datasetId]);
  });

  it("uses complete Polygon intersection only as a bounded read selector", async () => {
    const bytes = await readFile(asset); const raw = JSON.parse(new TextDecoder().decode(bytes));
    const feature = raw.features.find((item: { properties: { county: string } }) => item.properties.county === "高雄市");
    const ring = feature.geometry.coordinates[0] as number[][]; const longitude = ring[0]![0]!, latitude = ring[0]![1]!;
    const result = await new QueryExecutor([createAviationNoiseZonesDatasetAdapter(vi.fn(async () => new Response(bytes)))]).execute({ datasetId: aviationNoiseZonesDescriptor.datasetId, bbox: [longitude - .000001, latitude - .000001, longitude + .000001, latitude + .000001], select: ["zone_id", "geometry"], limit: 50 });
    expect(result.totalMatched).toBeGreaterThan(0); expect(result.rows).toContainEqual(expect.objectContaining({ zone_id: feature.properties.zone_id }));
  });

  it("presents the administrative proxy boundary while keeping spatial analysis ineligible", () => {
    expect(isMapEligibleGeometry(aviationNoiseZonesDescriptor.geometry)).toBe(true);
    expect(aviationNoiseZonesDescriptor.geometry.spatialAnalysisEligible).toBe(false);
    expect(isMapEligibleGeometry({ ...aviationNoiseZonesDescriptor.geometry, type: "Point" })).toBe(false);
  });

  it("fails closed when fixed semantics or source bytes differ", async () => {
    await expect(new QueryExecutor([createAviationNoiseZonesDatasetAdapter(vi.fn(async () => new Response("{}")))]).execute({ datasetId: aviationNoiseZonesDescriptor.datasetId })).rejects.toThrow("AVIATION_NOISE_ZONES_SOURCE_MISMATCH");
    const malformed = { type: "FeatureCollection", features: Array.from({ length: 76 }, () => ({ type: "Feature", properties: {}, geometry: null })) };
    expect(() => validateAviationNoiseZonesSnapshot(malformed)).toThrow("AVIATION_NOISE_ZONES_ROW_INVALID");
  });
});
