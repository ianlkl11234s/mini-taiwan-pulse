import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { geothermalWellsOwnerAdapter, geothermalWellsOwnerDescriptor } from "../geothermalWellsOwnerDataset";

const sidecar = "../runtime/owner-only/geothermal-wells/geothermal-wells-owner-20260615.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/energy/geothermal_wells/geothermal_wells_20260615.geojson";
const bboxes = { yilan: [121.60, 24.60, 121.65, 24.63] as const, taitung: [120.90, 22.50, 121.05, 22.75] as const };

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("matches two independent historical source bbox oracles and an area filter", async () => {
  const source = JSON.parse(await readFile(processed, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { geothermal_area: string } }[] };
  const executor = new QueryExecutor([geothermalWellsOwnerAdapter]);
  for (const bbox of Object.values(bboxes)) {
    const expected = source.features.filter(({ geometry: { coordinates: [lng, lat] } }) => lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]).length;
    const result = await executor.execute({ datasetId: geothermalWellsOwnerDescriptor.datasetId, bbox, select: ["well_id", "county_code", "geothermal_area", "report_name", "geometry"], limit: 36 });
    expect(result.totalMatched).toBe(expected);
  }
  const qingshui = await executor.execute({ datasetId: geothermalWellsOwnerDescriptor.datasetId, filters: [{ field: "geothermal_area", op: "eq", value: "清水" }], select: ["well_id", "geothermal_area", "report_name"], limit: 36 });
  expect(qingshui.totalMatched).toBe(11);
  expect(qingshui.rows).toContainEqual(expect.objectContaining({ well_id: "cpc-86147-010", geothermal_area: "清水" }));
});

it("retains actual fixed-point semantics and removes raw coordinates and external report links", () => {
  expect(geothermalWellsOwnerDescriptor).toMatchObject({ access: { mode: "owner_only", method: "local_asset", query: { supportsBbox: true } }, geometry: { role: "actual", spatialAnalysisEligible: true }, supportedOperations: ["query_records", "nearest", "aggregate"] });
  expect(geothermalWellsOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["lng_raw", "lat_raw", "figure_content", "report_url", "figure_url"]));
  expect(geothermalWellsOwnerDescriptor.license).toContain("OGDL-Taiwan-1.0");
});
