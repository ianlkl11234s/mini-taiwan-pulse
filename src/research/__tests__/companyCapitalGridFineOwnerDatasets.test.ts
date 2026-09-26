import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { companyCapitalGrid150mOwnerAdapter, companyCapitalGrid150mOwnerDescriptor, companyCapitalGrid450mOwnerAdapter, companyCapitalGrid450mOwnerDescriptor } from "../companyCapitalGridFineOwnerDatasets";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/company-capital-grid-fine/";
const prefix = "/__local-research-owner-only/company-capital-grid-fine/";
const analytics = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/business_registry/company_capital_grid";
type Bbox = readonly [number, number, number, number];

function boxIntersects(a: Bbox, b: Bbox): boolean { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }
function featureBbox(feature: { geometry: { coordinates: number[][][] } }): Bbox { const ring = feature.geometry.coordinates[0]!; return [Math.min(...ring.map(point => point[0]!)), Math.min(...ring.map(point => point[1]!)), Math.max(...ring.map(point => point[0]!)), Math.max(...ring.map(point => point[1]!))]; }
async function oracle(scale: 150 | 450, bbox: Bbox): Promise<number> { const source = JSON.parse(await readFile(`${analytics}/company_capital_grid_${scale}m_202608_r2.geojson`, "utf8")) as { features: { geometry: { coordinates: number[][][] } }[] }; return source.features.filter(feature => boxIntersects(featureBbox(feature), bbox)).length; }

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => vi.unstubAllGlobals());

it("requires a bbox and keeps polygon cells as an owner-only, non-point surface", async () => {
  const executor = new QueryExecutor([companyCapitalGrid150mOwnerAdapter, companyCapitalGrid450mOwnerAdapter]);
  await expect(executor.execute({ datasetId: companyCapitalGrid150mOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  for (const descriptor of [companyCapitalGrid150mOwnerDescriptor, companyCapitalGrid450mOwnerDescriptor]) {
    expect(descriptor.geometry).toMatchObject({ type: "Polygon", role: "generalized", spatialAnalysisEligible: false });
    expect(descriptor.license).toContain("RIGHTS_HOLD");
    expect(descriptor.coverage).toContain("未出現的格網不等於零");
  }
});

it.skipIf(!existsSync(`${root}manifest-150m.json`))("matches Taipei and Kaohsiung full-source grid oracles at both scales within bounds", async () => {
  const cases: readonly Bbox[] = [[121.48, 25.02, 121.50, 25.04], [120.28, 22.56, 120.30, 22.58]];
  for (const [scale, adapter, descriptor] of [[150, companyCapitalGrid150mOwnerAdapter, companyCapitalGrid150mOwnerDescriptor], [450, companyCapitalGrid450mOwnerAdapter, companyCapitalGrid450mOwnerDescriptor]] as const) {
    const executor = new QueryExecutor([adapter]);
    for (const bbox of cases) {
      const expected = await oracle(scale, bbox); const result = await executor.execute({ datasetId: descriptor.datasetId, bbox, select: ["grid_id", "n_companies", "capital_median"], limit: 100 });
      expect(result.totalMatched).toBe(expected); expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000); expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
    }
  }
});

it.skipIf(!existsSync(`${root}manifest-150m.json`))("preserves all-missing capital as null and fails closed for a broad Taiwan bbox", async () => {
  for (const [adapter, descriptor] of [[companyCapitalGrid150mOwnerAdapter, companyCapitalGrid150mOwnerDescriptor], [companyCapitalGrid450mOwnerAdapter, companyCapitalGrid450mOwnerDescriptor]] as const) {
    await expect(new QueryExecutor([adapter]).execute({ datasetId: descriptor.datasetId, bbox: [118, 21.5, 122.5, 26.5], limit: 1 })).rejects.toThrow("SCAN_BUDGET_EXCEEDED");
  }
  const source = JSON.parse(await readFile(`${analytics}/company_capital_grid_150m_202608_r2.geojson`, "utf8")) as { features: { geometry: { coordinates: number[][][] }; properties: { grid_id: string; capital_sum: number; capital_median: number | null } }[] };
  const absentCapital = source.features.find(feature => feature.properties.capital_median === null)!; const bbox = featureBbox(absentCapital);
  const result = await new QueryExecutor([companyCapitalGrid150mOwnerAdapter]).execute({ datasetId: companyCapitalGrid150mOwnerDescriptor.datasetId, bbox, filters: [{ field: "grid_id", op: "eq", value: absentCapital.properties.grid_id }], select: ["capital_sum", "capital_median"], limit: 1 });
  expect(result.rows).toEqual([{ capital_sum: 0, capital_median: null }]);
});
