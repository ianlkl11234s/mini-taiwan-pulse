import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createAdministrativeBoundaryAdapter, type AdministrativeBoundaryContract } from "../administrativeBoundaryAdapter";
import { QueryExecutor } from "../queryExecutor";

const encoder = new TextEncoder();
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
const source: { type: string; features: Array<Record<string, any>> } = { type: "FeatureCollection", features: [
  { type: "Feature", id: "one", properties: { code: "A", name: "甲" }, geometry: { type: "Polygon", coordinates: [[[120, 23], [120.1, 23], [120.1, 23.1], [120, 23.1], [120, 23]]] } },
  { type: "Feature", id: "two", properties: { code: "B", name: "乙" }, geometry: { type: "MultiPolygon", coordinates: [[[[120.2, 23], [120.3, 23], [120.3, 23.1], [120.2, 23.1], [120.2, 23]]]] } },
] };

async function contract(bytes: Uint8Array, overrides: Partial<AdministrativeBoundaryContract> = {}): Promise<AdministrativeBoundaryContract> {
  return { datasetId: "boundary:fixture", sourceUrl: "/__dev/raw-county.geojson", sourceSha256: await digest(bytes), version: "COUNTY_TEST", publisher: "fixture publisher", license: "test", codeProperty: "code", nameProperty: "name", expectedAreas: 2, maxBytes: 16 * 1024 * 1024, ...overrides };
}

describe("verified administrative boundary adapter", () => {
  it("keeps source properties/id out of the row contract while preserving raw actual MultiPolygon geometry", async () => {
    const bytes = encoder.encode(JSON.stringify(source)); const input = await contract(bytes);
    const fetcher = vi.fn(async () => new Response(bytes, { status: 200, headers: { "content-type": "application/geo+json" } }));
    const result = await new QueryExecutor([createAdministrativeBoundaryAdapter(input, fetcher)]).execute({ datasetId: input.datasetId, filters: [{ field: "area_code", op: "eq", value: "B" }] });
    expect(fetcher).toHaveBeenCalledWith(input.sourceUrl, expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result.rows).toMatchObject([{ area_code: "B", area_name: "乙", boundary_version: "COUNTY_TEST", boundary_sha256: input.sourceSha256, geometry: { type: "MultiPolygon" } }]);
    expect(result.sourceRefs).toEqual([expect.objectContaining({ sourceId: "administrative-boundary:COUNTY_TEST", checksumSha256: input.sourceSha256, reference: input.sourceUrl })]);
    expect(result.access.method).toBe("local_asset");
  });

  it("rejects hash, duplicate codes, non-surfaces, external URLs, and streamed sizes over the configured cap", async () => {
    const bytes = encoder.encode(JSON.stringify(source)); const input = await contract(bytes);
    await expect(new QueryExecutor([createAdministrativeBoundaryAdapter(input, vi.fn(async () => new Response(encoder.encode("{}"))))]).execute({ datasetId: input.datasetId })).rejects.toThrow("BOUNDARY_SHA256_MISMATCH");
    const duplicate = structuredClone(source); duplicate.features[1]!.properties.code = "A";
    const duplicateBytes = encoder.encode(JSON.stringify(duplicate)); const duplicateInput = await contract(duplicateBytes);
    await expect(new QueryExecutor([createAdministrativeBoundaryAdapter(duplicateInput, vi.fn(async () => new Response(duplicateBytes)))]).execute({ datasetId: duplicateInput.datasetId })).rejects.toThrow("BOUNDARY_CODE_CONTRACT_MISMATCH");
    const point = structuredClone(source); point.features[0]!.geometry = { type: "Point", coordinates: [120, 23] };
    const pointBytes = encoder.encode(JSON.stringify(point)); const pointInput = await contract(pointBytes);
    await expect(new QueryExecutor([createAdministrativeBoundaryAdapter(pointInput, vi.fn(async () => new Response(pointBytes)))]).execute({ datasetId: pointInput.datasetId })).rejects.toThrow("BOUNDARY_GEOMETRY_INVALID");
    const projected = structuredClone(source); (projected as Record<string, unknown>).crs = { type: "name", properties: { name: "EPSG:3857" } };
    const projectedBytes = encoder.encode(JSON.stringify(projected)); const projectedInput = await contract(projectedBytes);
    await expect(new QueryExecutor([createAdministrativeBoundaryAdapter(projectedInput, vi.fn(async () => new Response(projectedBytes)))]).execute({ datasetId: projectedInput.datasetId })).rejects.toThrow("BOUNDARY_CRS_UNSUPPORTED");
    for (const sourceUrl of ["https://example.test/raw.geojson", "/raw/../county.geojson", "/raw/%2e%2e/county.geojson", "/raw/county.geojson?version=1", "/raw/county.geojson#part", "/raw//county.geojson"]) {
      expect(() => createAdministrativeBoundaryAdapter({ ...input, sourceUrl })).toThrow("INVALID_ADMINISTRATIVE_BOUNDARY_CONTRACT");
    }
    const small = await contract(bytes, { maxBytes: 64 }); const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(65)); controller.close(); } });
    await expect(new QueryExecutor([createAdministrativeBoundaryAdapter(small, vi.fn(async () => new Response(stream)))]).execute({ datasetId: small.datasetId })).rejects.toThrow("BOUNDARY_TOO_LARGE");
  });

  it("forwards caller cancellation rather than classifying it as the fixed timeout", async () => {
    const bytes = encoder.encode(JSON.stringify(source)); const input = await contract(bytes); let requestSignal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { requestSignal = init?.signal as AbortSignal; requestSignal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }); }));
    const controller = new AbortController(); const pending = new QueryExecutor([createAdministrativeBoundaryAdapter(input, fetcher)]).execute({ datasetId: input.datasetId }, controller.signal);
    await vi.waitFor(() => expect(requestSignal).toBeDefined()); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" }); expect(requestSignal?.aborted).toBe(true);
  });

  it("rejects empty Polygon and MultiPolygon coordinate arrays", async () => {
    for (const geometry of [{ type: "Polygon", coordinates: [] }, { type: "MultiPolygon", coordinates: [[]] }]) {
      const empty = structuredClone(source); empty.features[0]!.geometry = geometry;
      const bytes = encoder.encode(JSON.stringify(empty)); const input = await contract(bytes);
      await expect(new QueryExecutor([createAdministrativeBoundaryAdapter(input, vi.fn(async () => new Response(bytes)))]).execute({ datasetId: input.datasetId })).rejects.toThrow("BOUNDARY_GEOMETRY_INVALID");
    }
  });

  it.runIf(process.env.RUN_RAW_BOUNDARY_INTEGRATION === "1")("optionally materializes the verified raw county artifact through an injected file reader", async () => {
    const raw = new URL("../../../../../../../taipei-gis-analytics/data/processed/demographics/county_boundary/county_boundary_20260626.geojson", import.meta.url);
    const bytes = await readFile(raw);
    const input: AdministrativeBoundaryContract = { datasetId: "boundary:raw-county-integration", sourceUrl: "/__dev/raw-county.geojson", sourceSha256: "5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6", version: "COUNTY_MOI_1140318", publisher: "data.gov.tw dataset 7442", license: "政府資料開放授權條款-第1版", codeProperty: "行政區域代碼", nameProperty: "名稱", expectedAreas: 22, maxBytes: 16 * 1024 * 1024 };
    const adapter = createAdministrativeBoundaryAdapter(input, vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json" } })));
    const materialized = await adapter.read({});
    expect(materialized.rows).toHaveLength(22); expect(materialized.rows[0]?.geometry).toMatchObject({ type: "MultiPolygon" });
    await expect(new QueryExecutor([adapter]).execute({ datasetId: input.datasetId, select: ["area_code"], limit: 1 })).resolves.toMatchObject({ totalMatched: 22 });
  });
});
