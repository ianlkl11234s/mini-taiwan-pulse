import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { cemeteryZoningDescriptor, createCemeteryZoningDatasetAdapter, validateCemeteryZoningSnapshot } from "../cemeteryZoningDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const asset = new URL("../../../public/funeral/cemetery_zoning.geojson", import.meta.url);

describe("cemetery zoning derived snapshot adapter", () => {
  it("verifies the fixed bytes, count, IDs, CRS and faithfully materializes source MultiPolygons", async () => {
    const bytes = await readFile(asset); const raw = JSON.parse(new TextDecoder().decode(bytes));
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json", "content-length": String(bytes.byteLength) } }));
    const result = await new QueryExecutor([createCemeteryZoningDatasetAdapter(fetcher)]).execute({ datasetId: "tw-urban-cemetery-zones", filters: [{ field: "county", op: "eq", value: "臺北市" }], select: ["zoning_id", "zone_label", "county", "area_ha", "geometry"], limit: 1 });
    expect(fetcher).toHaveBeenCalledWith("/funeral/cemetery_zoning.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result.totalMatched).toBeGreaterThan(0); expect(result.cost.bytesScanned).toBe(601_318);
    expect(result.sourceRefs.map(source => source.sourceId)).toEqual(["data.gov.tw:156197", "data.gov.tw:166182", "tw-urban-cemetery-zones:derived-snapshot"]);
    expect(result.rows[0]?.geometry).toEqual(raw.features.find((feature: { properties: { county: string } }) => feature.properties.county === "臺北市").geometry);
    expect(cemeteryZoningDescriptor.geometry).toMatchObject({ type: "MultiPolygon", crs: "EPSG:4326", role: "derived", spatialAnalysisEligible: true });
    expect(cemeteryZoningDescriptor.versions).toEqual([expect.objectContaining({ versionId: "55302cbf68ab98cf5608b6c5ac626eaef4eaa0dc3f80c46814f8b86f5d1a844e", availableAt: null, checksumSha256: "55302cbf68ab98cf5608b6c5ac626eaef4eaa0dc3f80c46814f8b86f5d1a844e", mutable: false })]);
  });

  it("fails closed for malformed CRS, duplicate IDs, unsuitable labels, invalid geometry, and coordinate range", () => {
    const base = { type: "FeatureCollection", features: [{ type: "Feature", properties: { zoning_id: "Z0001", zone_label: "公墓用地", county: "臺北市", area_ha: 1 }, geometry: { type: "MultiPolygon", coordinates: [[[[121, 25], [121.1, 25], [121.1, 25.1], [121, 25.1], [121, 25]]]] } }] };
    for (const malformed of [
      { ...base, crs: { type: "name", properties: { name: "EPSG:3826" } }, features: Array.from({ length: 114 }, () => base.features[0]) },
      { ...base, features: Array.from({ length: 114 }, () => structuredClone(base.features[0])) },
      { ...base, features: Array.from({ length: 114 }, (_, index) => ({ ...structuredClone(base.features[0]), properties: { ...base.features[0]!.properties, zoning_id: `Z${String(index + 1).padStart(4, "0")}`, zone_label: "住宅區" } })) },
      { ...base, features: Array.from({ length: 114 }, (_, index) => ({ ...structuredClone(base.features[0]), properties: { ...base.features[0]!.properties, zoning_id: `Z${String(index + 1).padStart(4, "0")}` }, geometry: { type: "Polygon", coordinates: [] } })) },
      { ...base, features: Array.from({ length: 114 }, (_, index) => ({ ...structuredClone(base.features[0]), properties: { ...base.features[0]!.properties, zoning_id: `Z${String(index + 1).padStart(4, "0")}` }, geometry: { type: "MultiPolygon", coordinates: [[[[180, 25], [121.1, 25], [121.1, 25.1], [121, 25.1], [180, 25]]]] } })) },
    ]) expect(() => validateCemeteryZoningSnapshot(malformed)).toThrow();
  });

  it("rejects hash mismatch, oversized streams, and forwards caller cancellation", async () => {
    await expect(new QueryExecutor([createCemeteryZoningDatasetAdapter(vi.fn(async () => new Response("{}")))]).execute({ datasetId: "tw-urban-cemetery-zones" })).rejects.toThrow("CEMETERY_ZONING_SHA256_MISMATCH");
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); controller.close(); } });
    await expect(new QueryExecutor([createCemeteryZoningDatasetAdapter(vi.fn(async () => new Response(stream)))]).execute({ datasetId: "tw-urban-cemetery-zones" })).rejects.toThrow("CEMETERY_ZONING_TOO_LARGE");
    let requestSignal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { requestSignal = init?.signal as AbortSignal; requestSignal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }); }));
    const controller = new AbortController(); const pending = new QueryExecutor([createCemeteryZoningDatasetAdapter(fetcher)]).execute({ datasetId: "tw-urban-cemetery-zones" }, controller.signal);
    await vi.waitFor(() => expect(requestSignal).toBeDefined()); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" }); expect(requestSignal?.aborted).toBe(true);
  });
});
