import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { expect, it, vi, afterEach, beforeEach } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { companyAgeStructure450mOwnerAdapter, companyAgeStructure450mOwnerDescriptor, companyIndustryDistribution1500mOwnerAdapter, companyIndustryDistribution1500mOwnerDescriptor } from "../companyDemographicsOwnerDataset";
import { geometriesIntersect, parseSpatialGeometry, type PolygonGeometry } from "../spatialKernel";

const runtime = "../runtime/owner-only/company-demographics/";
const prefix = "/__local-research-owner-only/company-demographics/";
const analytics = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/business_registry/company_demographics_grid";
type Bbox = readonly [number, number, number, number];
function bounds(feature: { geometry: { coordinates: number[][][] } }): Bbox { const ring = feature.geometry.coordinates[0]!; return [Math.min(...ring.map(p => p[0]!)), Math.min(...ring.map(p => p[1]!)), Math.max(...ring.map(p => p[0]!)), Math.max(...ring.map(p => p[1]!))]; }
function center(feature: { geometry: { coordinates: number[][][] } }): Bbox { const [w, s, e, n] = bounds(feature), x = (w + e) / 2, y = (s + n) / 2; return [x - 0.00001, y - 0.00001, x + 0.00001, y + 0.00001]; }
function surface([w, s, e, n]: Bbox): PolygonGeometry { return { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }; }
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${runtime}${url.slice(prefix.length)}`)))); });
afterEach(() => vi.unstubAllGlobals());

it("requires bbox and exposes separate owner-only industry and age semantics", async () => {
  await expect(new QueryExecutor([companyIndustryDistribution1500mOwnerAdapter]).execute({ datasetId: companyIndustryDistribution1500mOwnerDescriptor.datasetId, select: ["grid_id"] })).rejects.toThrow("BBOX_REQUIRED");
  expect(companyIndustryDistribution1500mOwnerDescriptor.license).toContain("RIGHTS_HOLD");
  expect(companyAgeStructure450mOwnerDescriptor.valueSemantics.missing).toContain("age_median=null");
  expect(companyAgeStructure450mOwnerDescriptor.coverage).toContain("occupied-only");
  expect(companyAgeStructure450mOwnerDescriptor.coverage).toContain("setup_year missing=16");
  expect(companyAgeStructure450mOwnerDescriptor.valueSemantics.missing).toContain("1911..2026");
  expect(companyIndustryDistribution1500mOwnerDescriptor.geometry).toMatchObject({ type: "Polygon", spatialAnalysisEligible: false });
});

it.skipIf(!existsSync(`${runtime}manifest-1500m.json`))("reads exact Polygon-intersecting cells at both required grains and preserves category conservation", async () => {
  const source1500 = JSON.parse(await readFile(`${analytics}/company_demographics_grid_1500m_202608.geojson`, "utf8")) as { features: { properties: Record<string, number | string | null>; geometry: { coordinates: number[][][] } }[] };
  expect(new Set(source1500.features.map(feature => feature.properties.grid_id)).size).toBe(source1500.features.length);
  const industryFeature = source1500.features.find(feature => feature.properties.grid_id === "G1500_100_245")!;
  const industry = await new QueryExecutor([companyIndustryDistribution1500mOwnerAdapter]).execute({ datasetId: companyIndustryDistribution1500mOwnerDescriptor.datasetId, bbox: center(industryFeature), select: ["grid_id", "n_companies", "i_45", "i_unknown"], limit: 10 });
  expect(industry.rows).toEqual([{ grid_id: industryFeature.properties.grid_id, n_companies: industryFeature.properties.n_companies, i_45: industryFeature.properties.i_45, i_unknown: industryFeature.properties.i_unknown }]);
  expect(industry.cost.rowsScanned).toBeLessThanOrEqual(20_000);
  const source450 = JSON.parse(await readFile(`${analytics}/company_demographics_grid_450m_202608.geojson`, "utf8")) as { features: { properties: Record<string, number | string | null>; geometry: { coordinates: number[][][] } }[] };
  expect(new Set(source450.features.map(feature => feature.properties.grid_id)).size).toBe(source450.features.length);
  const ageFeature = source450.features.find(feature => feature.properties.age_missing === 1)!;
  const age = await new QueryExecutor([companyAgeStructure450mOwnerAdapter]).execute({ datasetId: companyAgeStructure450mOwnerDescriptor.datasetId, bbox: center(ageFeature), select: ["grid_id", "n_companies", "age_known", "age_missing", "age_invalid", "age_median"], limit: 10 });
  expect(age.rows).toEqual([{ grid_id: ageFeature.properties.grid_id, n_companies: ageFeature.properties.n_companies, age_known: ageFeature.properties.age_known, age_missing: ageFeature.properties.age_missing, age_invalid: ageFeature.properties.age_invalid, age_median: ageFeature.properties.age_median }]);
  expect(Number(age.rows[0]!.age_known) + Number(age.rows[0]!.age_missing) + Number(age.rows[0]!.age_invalid)).toBe(age.rows[0]!.n_companies);
});

it.skipIf(!existsSync(`${runtime}manifest-450m.json`))("fails closed when a Taiwan-wide query exceeds the shard scan budget", async () => {
  await expect(new QueryExecutor([companyAgeStructure450mOwnerAdapter]).execute({ datasetId: companyAgeStructure450mOwnerDescriptor.datasetId, bbox: [118, 21.5, 122.5, 26.5], limit: 1 })).rejects.toThrow("SCAN_BUDGET_EXCEEDED");
});

it.skipIf(!existsSync(`${runtime}manifest-450m.json`))("matches full-source Polygon intersections at two places, including cross-cell matches", async () => {
  const cases = [
    { path: "company_demographics_grid_450m_202608.geojson", adapter: companyAgeStructure450mOwnerAdapter, descriptor: companyAgeStructure450mOwnerDescriptor, bbox: [121.50, 25.03, 121.52, 25.05] as Bbox },
    { path: "company_demographics_grid_1500m_202608.geojson", adapter: companyIndustryDistribution1500mOwnerAdapter, descriptor: companyIndustryDistribution1500mOwnerDescriptor, bbox: [120.63, 24.13, 120.67, 24.17] as Bbox },
  ];
  for (const current of cases) {
    const full = JSON.parse(await readFile(`${analytics}/${current.path}`, "utf8")) as { features: { geometry: unknown; properties: { grid_id: string } }[] };
    const expected = full.features.filter(feature => geometriesIntersect(parseSpatialGeometry(feature.geometry), surface(current.bbox))).map(feature => feature.properties.grid_id).sort();
    const result = await new QueryExecutor([current.adapter]).execute({ datasetId: current.descriptor.datasetId, bbox: current.bbox, select: ["grid_id"], limit: 100 });
    expect(result.totalMatched).toBe(expected.length);
    expect(result.rows.map(row => String(row.grid_id)).sort()).toEqual(expected);
  }
});
