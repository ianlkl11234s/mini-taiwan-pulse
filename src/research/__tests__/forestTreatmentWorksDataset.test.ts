import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { forestTreatmentWorksOwnerAdapter, forestTreatmentWorksOwnerDescriptor } from "../forestTreatmentWorksDataset";

const sidecar = "../runtime/owner-only/forest-treatment-works/forest-treatment-works-owner-20260802.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/forestry/forestry_treatment_works/forestry_treatment_works.geojson";
const bbox = [120.43, 23.47, 120.46, 23.5] as const;

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sidecar))("keeps the owner-only processed receipt, a new-place bbox oracle, and year/blank-city variants", async () => {
  const source = JSON.parse(await readFile(processed, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { planyear: number; city: string } }[] };
  const oracle = source.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]);
  const executor = new QueryExecutor([forestTreatmentWorksOwnerAdapter]);
  const nearby = await executor.execute({ datasetId: forestTreatmentWorksOwnerDescriptor.datasetId, bbox, select: ["eng_no", "eng_name", "planyear", "city", "coord_rule", "geometry"], limit: 100 });
  const year113 = await executor.execute({ datasetId: forestTreatmentWorksOwnerDescriptor.datasetId, bbox, filters: [{ field: "planyear", op: "eq", value: 113 }], select: ["eng_no", "planyear"], limit: 100 });
  const blankCity = await executor.execute({ datasetId: forestTreatmentWorksOwnerDescriptor.datasetId, filters: [{ field: "city", op: "eq", value: "" }], select: ["city"], limit: 100 });
  expect(oracle).toHaveLength(40); expect(nearby.totalMatched).toBe(oracle.length); expect(year113.totalMatched).toBe(5); expect(blankCity.totalMatched).toBe(77);
  expect(nearby.rows).toContainEqual(expect.objectContaining({ eng_no: "11309前瞻19", planyear: 113, city: "嘉義市", coord_rule: "tm2" }));
  expect(nearby.excludedByReason).toMatchObject({ upstream_unlocated_from_documented_predecessor: 62, raw_version_mismatch_hold: 1, missing_geometry: 0, non_point_geometry: 0, invalid_geometry: 0 });
  expect(forestTreatmentWorksOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset" }, geometry: { role: "proxy", spatialAnalysisEligible: false }, supportedOperations: ["query_records", "aggregate"] });
  expect(forestTreatmentWorksOwnerDescriptor.license).toContain("RAW_VERSION_MISMATCH_HOLD");
});
