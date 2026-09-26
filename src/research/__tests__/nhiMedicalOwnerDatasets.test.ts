import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";
import { nhiMedicalClinicOwnerAdapter, nhiMedicalClinicOwnerDescriptor, nhiMedicalHospitalOwnerAdapter, nhiMedicalHospitalOwnerDescriptor, nhiMedicalPharmacyOwnerAdapter, nhiMedicalPharmacyOwnerDescriptor } from "../nhiMedicalOwnerDatasets";

const root = "../runtime/owner-only/nhi-medical/";
const prefix = "/__local-research-owner-only/nhi-medical/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/poi/medical/nhi_institutions_geocoded.geojson";
type Bbox = readonly [number, number, number, number];

async function oracle(bbox: Bbox, categories: readonly string[]): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { category: string } }[] };
  const allowed = new Set(categories);
  return source.features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && allowed.has(feature.properties.category); }).length;
}

beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it.skipIf(!existsSync(`${root}manifest-receipt.json`))("uses the SHA-bound safe-field partition and preserves category plus geocode-source receipts", async () => {
  const receipt = JSON.parse(await readFile(`${root}manifest-receipt.json`, "utf8"));
  expect(receipt).toMatchObject({ source: { sha256: "d94164d2de2cd78f3ab777e13d93288e1d9956493329951a09c5a710038ca50d", featureCount: 31603 }, retainedFields: ["category", "geocode_source"], nullCounts: { category: 0, geocode_source: 0 }, categoryCounts: { hospital_district: 337, hospital_medical_center: 29, hospital_regional: 85, clinic: 21765, pharmacy: 7680 }, geocodeSourceCounts: { tgos: 29621, google: 1603, google_retry: 379 } });
  expect(receipt.excludedFields).toEqual(expect.arrayContaining(["facility_id", "name", "address", "phone"]));
  for (const descriptor of [nhiMedicalHospitalOwnerDescriptor, nhiMedicalClinicOwnerDescriptor, nhiMedicalPharmacyOwnerDescriptor]) {
    expect(descriptor).toMatchObject({ access: { mode: "owner_only", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
    expect(descriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["facility_id", "name", "address", "phone"]));
    expect(descriptor.license).toContain("RIGHTS_HOLD");
  }
  expect(nhiMedicalClinicOwnerDescriptor.label).toContain("其他醫療");
});

it.skipIf(!existsSync(`${root}manifest.json`))("matches two independent source bbox oracles and a categorical variant", async () => {
  const executor = new QueryExecutor([nhiMedicalHospitalOwnerAdapter, nhiMedicalClinicOwnerAdapter, nhiMedicalPharmacyOwnerAdapter]);
  const cases = [
    { adapter: nhiMedicalHospitalOwnerDescriptor, bbox: [121.48, 25.02, 121.58, 25.10] as const, categories: ["hospital_district", "hospital_medical_center", "hospital_regional"] },
    { adapter: nhiMedicalClinicOwnerDescriptor, bbox: [120.28, 22.56, 120.38, 22.67] as const, categories: ["clinic", "health_center", "home_nursing", "lab", "medical_radiology", "midwifery", "occupational_therapy", "other_nhi", "physical_therapy", "rehab_home", "speech_therapy"] },
    { adapter: nhiMedicalPharmacyOwnerDescriptor, bbox: [121.48, 25.02, 121.58, 25.10] as const, categories: ["pharmacy"], filter: "pharmacy" },
  ];
  for (const item of cases) {
    const result = await executor.execute({ datasetId: item.adapter.datasetId, bbox: item.bbox, filters: item.filter ? [{ field: "category", op: "eq", value: item.filter }] : undefined, select: ["category"], limit: 1 });
    expect(result.totalMatched).toBe(await oracle(item.bbox, item.categories));
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("requires bbox and fails closed for a broad request", async () => {
  const executor = new QueryExecutor([nhiMedicalHospitalOwnerAdapter]);
  await expect(executor.execute({ datasetId: nhiMedicalHospitalOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  await expect(executor.execute({ datasetId: nhiMedicalHospitalOwnerDescriptor.datasetId, bbox: [118, 21.5, 122.5, 26.5], limit: 1 })).rejects.toThrow();
});
