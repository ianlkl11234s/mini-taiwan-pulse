import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { tourismFactoriesOwnerAdapter, tourismFactoriesOwnerDescriptor } from "../tourismFactoriesOwnerDataset";

const sidecar = "../runtime/owner-only/tourism-factories/tourism-factories-owner-20260723.geojson";
const processed = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/tourism/tourism_factory/tourism_factory_20260723.geojson";
const bboxes = { keelung: [121.69, 25.14, 121.71, 25.16] as const, linkou: [121.39, 25.07, 121.42, 25.08] as const };
async function oracle(id: string) {
  const source = JSON.parse(await readFile(processed, "utf8")) as { features: { properties: Record<string, unknown> }[] };
  const p = source.features.find(feature => feature.properties.id === id)?.properties; if (!p) throw new Error("ORACLE_NOT_FOUND");
  return { id: p.id, name: p.name, geocode_source: p.geocode_source, geocode_precision: p.geocode_precision };
}
beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it.skipIf(!existsSync(sidecar))("retains two source-oracle places and distinct geocode provenance without contact fields", async () => {
  const executor = new QueryExecutor([tourismFactoriesOwnerAdapter]);
  const keelung = await executor.execute({ datasetId: tourismFactoriesOwnerDescriptor.datasetId, bbox: bboxes.keelung, select: ["id", "name", "geocode_source", "geocode_precision", "geometry"], limit: 100 });
  const linkou = await executor.execute({ datasetId: tourismFactoriesOwnerDescriptor.datasetId, bbox: bboxes.linkou, select: ["id", "name", "geocode_source", "geocode_precision", "geometry"], limit: 100 });
  expect(keelung.rows).toContainEqual(expect.objectContaining(await oracle("1"))); expect(linkou.rows).toContainEqual(expect.objectContaining(await oracle("2")));
  expect(await oracle("1")).toMatchObject({ geocode_source: "google", geocode_precision: "exact" }); expect(await oracle("2")).toMatchObject({ geocode_source: "offline_l15", geocode_precision: "interpolated" });
  expect(tourismFactoriesOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["address", "phone", "website", "lat", "lon"]));
});

it("keeps Google coordinates owner-only proxy references and holds nearest-distance claims", async () => {
  const descriptor = tourismFactoriesOwnerDescriptor;
  expect(descriptor).toMatchObject({ layerRefs: ["tourFactories"], geometry: { type: "Point", role: "proxy", spatialAnalysisEligible: false }, access: { mode: "owner_only", query: { supportsBbox: true } }, supportedOperations: ["query_records", "aggregate"] });
  expect(descriptor.geometry.precision).toContain("Google 34"); expect(descriptor.geometry.precision).toContain("不得用於最近點"); expect(descriptor.license).toContain("未核");
});
