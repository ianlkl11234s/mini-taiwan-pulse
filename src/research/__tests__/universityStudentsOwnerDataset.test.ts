import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { universityStudentsOwnerAdapter, universityStudentsOwnerDescriptor } from "../universityStudentsOwnerDataset";

const sidecar = "../runtime/owner-only/university-students/university-students-owner-20260807.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/education/university_students/university_students_20260807.geojson";
const bbox = [120.42, 23.45, 120.5, 23.51] as const;

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps different school/statistic vintages, nulls, and an independent Chiayi bbox oracle", async () => {
  const raw = JSON.parse(await readFile(processed, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { city: string; students_total: number | null } }[] };
  const oracle = raw.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]);
  const executor = new QueryExecutor([universityStudentsOwnerAdapter]);
  const near = await executor.execute({ datasetId: universityStudentsOwnerDescriptor.datasetId, bbox, select: ["school_name", "city", "students_total", "academic_year", "geometry"], limit: 100 });
  const nulls = await executor.execute({ datasetId: universityStudentsOwnerDescriptor.datasetId, filters: [{ field: "students_total", op: "eq", value: null }], select: ["school_name", "students_total"], limit: 100 });
  const taipei = await executor.execute({ datasetId: universityStudentsOwnerDescriptor.datasetId, filters: [{ field: "city", op: "eq", value: "臺北市" }], select: ["school_name", "students_total"], limit: 100 });
  expect(oracle).toHaveLength(1);
  expect(near.totalMatched).toBe(oracle.length);
  expect(nulls.totalMatched).toBe(21);
  expect(taipei.totalMatched).toBe(28);
  expect(near.excludedByReason).toMatchObject({ no_school_point_upstream: 1, no_student_statistic: 21 });
  expect(universityStudentsOwnerDescriptor).toMatchObject({ access: { mode: "owner_only" }, geometry: { role: "proxy", spatialAnalysisEligible: false } });
  expect(universityStudentsOwnerDescriptor.license).toContain("COORDINATE_RIGHTS_HOLD");
});
