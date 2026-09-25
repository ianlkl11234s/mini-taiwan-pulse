import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createDgbasCountyTransportOwnerAdapters } from "../dgbasCountyTransportOwnerDatasets";
import { QueryExecutor } from "../queryExecutor";

const assetPath = "../runtime/owner-only/dgbas-county-transport/dgbas-county-transport-owner-only.json";
const bytes = () => readFile(assetPath);
const adapters = () => createDgbasCountyTransportOwnerAdapters(bytes);

describe("DGBAS county transport owner-only releases", () => {
  it("locks six layer refs to two immutable STALE releases and generalized display polygons", () => {
    const executor = new QueryExecutor(adapters());
    const descriptors = executor.descriptors();
    expect(descriptors).toHaveLength(6);
    expect(descriptors.map(item => item.layerRefs[0])).toEqual([
      "statsOffstreetSmallCarParkingSpacesCount", "statsOnstreetSmallCarParkingSpacesCount", "statsMotorcycleRegisteredCount",
      "statsAutomobileRegisteredCount", "statsAutomobileLicenseHoldersCount", "statsMotorcycleLicenseHoldersCount",
    ]);
    expect(descriptors.every(item => item.geometry.type === "MultiPolygon" && item.geometry.role === "generalized" && !item.geometry.spatialAnalysisEligible && item.versions.length === 2 && item.access.mode === "owner_only")).toBe(true);
  });

  it("reads two counties from each requested year without mixing releases", async () => {
    const executor = new QueryExecutor(adapters());
    const descriptor = executor.descriptors().find(item => item.layerRefs[0] === "statsAutomobileLicenseHoldersCount")!;
    const [release2023, release2024] = descriptor.parameters![0]!.options as [string, string];
    const [year2023, year2024] = await Promise.all([
      executor.execute({ datasetId: descriptor.datasetId, parameters: { releaseId: release2023 }, filters: [{ field: "area_code", op: "eq", value: "63000" }], select: ["area_code", "value", "status", "dimensions", "boundary_version"] }),
      executor.execute({ datasetId: descriptor.datasetId, parameters: { releaseId: release2024 }, filters: [{ field: "area_code", op: "eq", value: "64000" }], select: ["area_code", "value", "status", "dimensions", "boundary_version"] }),
    ]);
    expect(year2023).toMatchObject({ freshness: "stale", totalMatched: 1, rows: [{ area_code: "63000", value: 1624410, status: "observed", dimensions: { roc_year: "112" }, boundary_version: "COUNTY_MOI_1140318" }] });
    expect(year2024).toMatchObject({ freshness: "stale", totalMatched: 1, rows: [{ area_code: "64000", value: 1751538, status: "observed", dimensions: { roc_year: "113" }, boundary_version: "COUNTY_MOI_1140318" }] });
    expect(year2023.sourceRefs).toEqual(expect.arrayContaining([expect.objectContaining({ version: release2023, checksumSha256: "7c54c4949270aa4c40789832320ee8052a4db4247b7de5df7bfd802e0f7ae518" })]));
  });

  it("rejects undeclared release selectors and changed owner-only bytes", async () => {
    const descriptor = new QueryExecutor(adapters()).descriptors()[0]!;
    await expect(new QueryExecutor(adapters()).execute({ datasetId: descriptor.datasetId, parameters: { releaseId: "2025-unpublished" } })).rejects.toThrow("RELEASE_NOT_ALLOWED");
    const modified = async () => new Uint8Array([...(await bytes()), 0]);
    await expect(new QueryExecutor(createDgbasCountyTransportOwnerAdapters(modified)).execute({ datasetId: descriptor.datasetId, parameters: { releaseId: descriptor.parameters![0]!.options![0] as string } })).rejects.toThrow("DGBAS_TRANSPORT_OWNER_ASSET_MISMATCH");
  });
});
