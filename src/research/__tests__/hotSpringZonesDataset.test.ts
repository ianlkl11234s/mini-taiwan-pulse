import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createHotSpringZonesDatasetAdapter, hotSpringZonesDescriptor, validateHotSpringZonesSnapshot } from "../hotSpringZonesDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = new URL("../../../public/tourism/hot_spring_zones_national.geojson", import.meta.url);

describe("Taipei hot-spring outcrop zones fixed snapshot adapter", () => {
  it("binds the 16 announced full surfaces and preserves source-null remarks", async () => {
    const bytes = await readFile(asset); const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
    const result = await new QueryExecutor([createHotSpringZonesDatasetAdapter(fetcher)]).execute({ datasetId: hotSpringZonesDescriptor.datasetId, filters: [{ field: "name", op: "eq", value: "硫磺谷" }], select: ["zone_no", "name", "area_m2", "remark", "geometry"], limit: 1 });
    expect(fetcher).toHaveBeenCalledWith("/tourism/hot_spring_zones_national.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result).toMatchObject({ totalMatched: 1, returned: 1, cost: { rowsScanned: 16, bytesScanned: 8_109 } });
    expect(result.rows[0]).toMatchObject({ zone_no: "B", name: "硫磺谷", area_m2: 23021, remark: null });
    expect(hotSpringZonesDescriptor.geometry).toMatchObject({ type: "Polygon", role: "actual", spatialAnalysisEligible: true });
  });

  it("keeps distinct places and repeated-name variants separate under bounded surface queries", async () => {
    const bytes = await readFile(asset); const raw = JSON.parse(new TextDecoder().decode(bytes));
    const executor = new QueryExecutor([createHotSpringZonesDatasetAdapter(vi.fn(async () => new Response(bytes)))]);
    const earth = await executor.execute({ datasetId: hotSpringZonesDescriptor.datasetId, filters: [{ field: "name", op: "eq", value: "地熱谷" }], select: ["zone_no", "name"], limit: 1 });
    const matsao = await executor.execute({ datasetId: hotSpringZonesDescriptor.datasetId, filters: [{ field: "name", op: "eq", value: "馬槽" }], select: ["zone_no", "name"], limit: 16 });
    const feature = raw.features.find((item: { properties: { zone_no: string } }) => item.properties.zone_no === "A"); const point = feature.geometry.coordinates[0][0];
    const bounded = await executor.execute({ datasetId: hotSpringZonesDescriptor.datasetId, bbox: [point[0] - .000001, point[1] - .000001, point[0] + .000001, point[1] + .000001], select: ["zone_no"], limit: 16 });
    expect(earth.rows).toEqual([{ zone_no: "A", name: "地熱谷" }]); expect(matsao.totalMatched).toBe(5); expect(bounded.rows).toContainEqual({ zone_no: "A" });
  });

  it("fails closed on a source-byte or schema mismatch", async () => {
    await expect(new QueryExecutor([createHotSpringZonesDatasetAdapter(vi.fn(async () => new Response("{}")))]).execute({ datasetId: hotSpringZonesDescriptor.datasetId })).rejects.toThrow("HOT_SPRING_ZONES_SOURCE_MISMATCH");
    expect(() => validateHotSpringZonesSnapshot({ type: "FeatureCollection", features: Array.from({ length: 16 }, () => ({ type: "Feature", properties: {}, geometry: null })) })).toThrow("HOT_SPRING_ZONES_ROW_INVALID");
  });
});
