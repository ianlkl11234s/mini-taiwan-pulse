import { describe, expect, it, vi } from "vitest";
import { createPopulationSnapshotAdapter, type PopulationBoundarySnapshot, type PopulationSnapshotAdapterConfig } from "../populationDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

const encoder = new TextEncoder();
const sha256 = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const codes = Array.from({ length: 22 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);

function boundary(): PopulationBoundarySnapshot {
  const checksum = "b".repeat(64);
  return {
    receipt: { sourceId: "county-boundary", version: "COUNTY_MOI_1140318", acquiredAt: "2026-09-23T00:00:00Z", checksumSha256: checksum, reference: "local-preview://county-boundary" },
    boundaryVersion: "COUNTY_MOI_1140318", sha256: checksum, codeProperty: "行政區域代碼", nameProperty: "名稱",
    features: codes.map((code, index) => ({ type: "Feature", properties: { 行政區域代碼: code, 名稱: `縣市${index + 1}` }, geometry: { type: "Polygon", coordinates: [[[120 + index / 100, 23], [120.005 + index / 100, 23], [120.005 + index / 100, 23.005], [120 + index / 100, 23.005], [120 + index / 100, 23]]] } })),
  };
}

async function config(mutate?: (artifact: Record<string, unknown>) => void): Promise<PopulationSnapshotAdapterConfig> {
  const geometry = boundary();
  const artifact: Record<string, unknown> = {
    schema_version: "regional-statistics-cdn-v1",
    values: { status: "OK", release: { release_id: "2025-12-total_population-county-local-preview", dataset_id: "population_statistics", indicator_id: "total_population", boundary_version: geometry.boundaryVersion, period_start: "2025-12-31", period_end: "2025-12-31" }, area_level: "county", total: 22, returned: 22, truncated: false, next_offset: null, observations: codes.map((code, index) => ({ area_code: code, area_name: `縣市${index + 1}`, value: 1_000 + index, status: "observed" })) },
    sources: { status: "OK", source: { id: "segis-114y12m-administrative-population", population_label: "行政區人口數", population_scope_note: "原始 receipt 未限定戶籍或現住。", unit: "人" } },
    geometry: { status: "OK", geometry: { sha256: geometry.sha256, boundary_version: geometry.boundaryVersion, level: "county" } },
    local_preview_contract: { not_published: true, dimensions: { population_scope: "total", population_measure: "administrative_population" } },
  };
  mutate?.(artifact);
  const bytes = encoder.encode(JSON.stringify(artifact));
  return {
    contract: { datasetId: "population_statistics", indicatorId: "total_population", releaseId: "2025-12-total_population-county-local-preview", level: "county", periodStart: "2025-12-31", periodEnd: "2025-12-31", dimensions: { population_scope: "total", population_measure: "administrative_population" }, unit: "人", label: "2025-12 行政區人口數", expectedAreas: 22, populationLabel: "行政區人口數" },
    receipt: { status: "PASS_LOCAL_PREVIEW_ONLY", notPublished: true, artifact: { sha256: await sha256(bytes), bytes: bytes.byteLength } },
    readArtifact: vi.fn(async () => bytes), loadBoundary: vi.fn(async () => geometry),
  };
}

describe("verified population snapshot materializer", () => {
  it("describes the required release selector before any source read", async () => {
    const input = await config();
    const executor = new QueryExecutor([createPopulationSnapshotAdapter(input)]);
    const descriptor = executor.describe(input.contract.datasetId)!;
    expect(descriptor.parameters).toEqual([{ name: "releaseId", type: "string", required: true, options: [input.contract.releaseId] }]);
    expect(input.readArtifact).not.toHaveBeenCalled();
    expect(() => executor.validateParameters({ datasetId: descriptor.datasetId, limit: 1 })).toThrow("REQUIRED_PARAMETER_MISSING");
    const releaseId = descriptor.parameters![0]!.options![0]!;
    const result = await executor.execute({ datasetId: descriptor.datasetId, parameters: { releaseId }, select: ["area_code", "value"], limit: 1 });
    expect(result.totalMatched).toBe(22);
  });

  it("joins only the injected same-version verified boundary and retains local-preview provenance", async () => {
    const input = await config();
    const result = await new QueryExecutor([createPopulationSnapshotAdapter(input)]).execute({ datasetId: "population_statistics", parameters: { releaseId: "2025-12-total_population-county-local-preview" }, limit: 1 });
    expect(result.totalMatched).toBe(22);
    expect(result.rows[0]).toMatchObject({ area_code: "C01", value: 1000, status: "observed", dimensions: { population_scope: "total", population_measure: "administrative_population" }, source_population_scope_note: "原始 receipt 未限定戶籍或現住。" });
    expect(result.rows[0]).not.toHaveProperty("geometry"); // Full surfaces stay in the materialized result, not the default receipt.
    expect(result.sourceRefs).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "segis-114y12m-administrative-population", reference: "snapshot://injected" }), expect.objectContaining({ sourceId: "county-boundary", reference: "local-preview://county-boundary" })]));
    expect(input.readArtifact).toHaveBeenCalledOnce();
    expect(input.loadBoundary).toHaveBeenCalledOnce();
  });

  it("rejects a changed artifact before materialization and cannot substitute a publication claim", async () => {
    const input = await config();
    const corrupted = { ...input, readArtifact: vi.fn(async () => encoder.encode("{}")) };
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(corrupted)]).execute({ datasetId: "population_statistics", parameters: { releaseId: corrupted.contract.releaseId } })).rejects.toThrow("POPULATION_ARTIFACT_RECEIPT_MISMATCH");
    const published = await config();
    const publicationMismatch = { ...published, receipt: { ...published.receipt, status: "PASS_LOCAL_PREVIEW_ONLY" as const, notPublished: false } };
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(publicationMismatch)]).execute({ datasetId: "population_statistics", parameters: { releaseId: publicationMismatch.contract.releaseId } })).rejects.toThrow("POPULATION_PUBLICATION_STATUS_MISMATCH");
  });

  it("rejects observed nulls, boundary code drift, and undeclared release selectors", async () => {
    const nullObserved = await config(artifact => ((artifact.values as Record<string, unknown>).observations as Record<string, unknown>[])[0]!.value = null);
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(nullObserved)]).execute({ datasetId: "population_statistics", parameters: { releaseId: nullObserved.contract.releaseId } })).rejects.toThrow("POPULATION_OBSERVATION_INVALID");
    const drift = await config();
    const driftedBoundary = { ...drift, loadBoundary: vi.fn(async () => ({ ...boundary(), features: boundary().features.slice(1) })) };
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(driftedBoundary)]).execute({ datasetId: "population_statistics", parameters: { releaseId: driftedBoundary.contract.releaseId } })).rejects.toThrow("POPULATION_BOUNDARY_CONTRACT_MISMATCH");
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(await config())]).execute({ datasetId: "population_statistics", parameters: { releaseId: "other" } })).rejects.toThrow("RELEASE_NOT_ALLOWED");
  });

  it("rejects source unit/label or dimensions that conflict with the caller contract and local-only artifacts marked verified", async () => {
    const wrongUnit = await config(artifact => (((artifact.sources as Record<string, unknown>).source as Record<string, unknown>).unit = "persons"));
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(wrongUnit)]).execute({ datasetId: "population_statistics", parameters: { releaseId: wrongUnit.contract.releaseId } })).rejects.toThrow("POPULATION_SOURCE_SEMANTICS_MISMATCH");
    const wrongDimensions = await config(artifact => (((artifact.local_preview_contract as Record<string, unknown>).dimensions as Record<string, unknown>).population_scope = "subset"));
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(wrongDimensions)]).execute({ datasetId: "population_statistics", parameters: { releaseId: wrongDimensions.contract.releaseId } })).rejects.toThrow("POPULATION_DIMENSIONS_MISMATCH");
    const local = await config();
    const falselyVerified = { ...local, receipt: { ...local.receipt, status: "PASS_VERIFIED_SNAPSHOT" as const, notPublished: false } };
    await expect(new QueryExecutor([createPopulationSnapshotAdapter(falselyVerified)]).execute({ datasetId: "population_statistics", parameters: { releaseId: falselyVerified.contract.releaseId } })).rejects.toThrow("POPULATION_PUBLICATION_STATUS_MISMATCH");
  });
});
