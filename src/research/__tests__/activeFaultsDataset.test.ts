import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { activeFaultsDescriptor, createActiveFaultsDatasetAdapter, validateActiveFaultsSnapshot } from "../activeFaultsDataset";
import { QueryExecutor } from "../queryExecutor";

const asset = new URL("../../../public/geo/active_faults.geojson", import.meta.url);

function executor(bytes: Uint8Array) {
  const fetcher = vi.fn(async () => new Response(bytes, { headers: { "content-type": "application/geo+json", "content-length": String(bytes.byteLength) } }));
  return { fetcher, query: new QueryExecutor([createActiveFaultsDatasetAdapter(fetcher)]) };
}

describe("active-fault geological-sensitive-zone adapter", () => {
  it("SHA-binds the 22-feature source, retains only official codes, and normalizes mixed 2D/zero-Z surfaces without changing horizontal topology", async () => {
    const bytes = await readFile(asset); const raw = JSON.parse(new TextDecoder().decode(bytes));
    const { fetcher, query } = executor(bytes);
    const result = await query.execute({ datasetId: activeFaultsDescriptor.datasetId, select: ["fault_code", "geometry"], filters: [{ field: "fault_code", op: "eq", value: "F0002" }], limit: 1 });
    expect(fetcher).toHaveBeenCalledWith("/geo/active_faults.geojson", expect.objectContaining({ credentials: "same-origin", redirect: "error" }));
    expect(result).toMatchObject({ totalMatched: 1, freshness: "unknown", cost: { rowsScanned: 22, bytesScanned: 2_632_866 }, sourceRefs: [
      expect.objectContaining({ sourceId: "data.gov.tw:27744", checksumSha256: null }),
      expect.objectContaining({ sourceId: "tw-active-faults-sensitive-zones:derived-snapshot", checksumSha256: "a05a2afaf1f17b6be9e3cb7ed605fbbe35e3ea72ee0d654bf1fea97b89543b1e" }),
    ] });
    expect(result.rows[0]).toMatchObject({ fault_code: "F0002", geometry: { type: "MultiPolygon" } });
    expect(JSON.stringify(result.rows[0])).not.toContain("fault_id");
    const sourceFeature = raw.features.find((feature: { properties: Record<string, unknown> }) => feature.properties["編號"] === "F0002");
    expect((result.rows[0]!.geometry as { coordinates: unknown[] }).coordinates.length).toBe((sourceFeature.geometry.coordinates as unknown[]).length);
    expect(activeFaultsDescriptor).toMatchObject({ geometry: { type: "MultiPolygon", crs: "EPSG:4326", spatialAnalysisEligible: true }, access: { query: { supportsBbox: true } } });
  });

  it("uses actual surface intersection for two distant bbox queries, including a polygon converted to one-part MultiPolygon", async () => {
    const bytes = await readFile(asset); const { query } = executor(bytes);
    const dajia = await query.execute({ datasetId: activeFaultsDescriptor.datasetId, bbox: [120.60, 24.28, 120.64, 24.34], select: ["fault_code"], limit: 22 });
    const milun = await query.execute({ datasetId: activeFaultsDescriptor.datasetId, bbox: [121.61, 23.99, 121.63, 24.03], select: ["fault_code"], limit: 22 });
    expect(dajia.rows.map(row => row.fault_code)).toContain("F0012");
    expect(milun.rows.map(row => row.fault_code)).toContain("F1011");
    await expect(query.execute({ datasetId: activeFaultsDescriptor.datasetId, bbox: [119.0, 21.0, 119.1, 21.1] })).resolves.toMatchObject({ totalMatched: 0 });
  });

  it("fails closed for hash changes, non-zero third ordinates, duplicate codes, and invalid surface types", async () => {
    await expect(executor(new TextEncoder().encode("{}")).query.execute({ datasetId: activeFaultsDescriptor.datasetId })).rejects.toThrow("ACTIVE_FAULTS_SHA256_MISMATCH");
    const base = { type: "FeatureCollection", features: Array.from({ length: 22 }, (_, index) => ({ type: "Feature", properties: { 編號: `F${String(index + 1).padStart(4, "0")}` }, geometry: { type: "Polygon", coordinates: [[[120, 24, 0], [120.1, 24, 0], [120.1, 24.1, 0], [120, 24.1, 0], [120, 24, 0]]] } })) };
    expect(() => validateActiveFaultsSnapshot(base)).toThrow("ACTIVE_FAULTS_PROPERTY_CONTRACT_MISMATCH");
    const actual = JSON.parse(await readFile(asset, "utf8"));
    const duplicate = structuredClone(actual);
    duplicate.features[1] = structuredClone(duplicate.features[0]);
    expect(() => validateActiveFaultsSnapshot(duplicate)).toThrow("ACTIVE_FAULTS_DUPLICATE_FAULT_CODE");
    actual.features[0].geometry.coordinates[0][0][2] = 1;
    expect(() => validateActiveFaultsSnapshot(actual)).toThrow("ACTIVE_FAULTS_GEOMETRY_INVALID");
    actual.features[0].geometry = { type: "LineString", coordinates: [[120, 24], [120.1, 24.1]] };
    expect(() => validateActiveFaultsSnapshot(actual)).toThrow("ACTIVE_FAULTS_GEOMETRY_INVALID");
  });
});
