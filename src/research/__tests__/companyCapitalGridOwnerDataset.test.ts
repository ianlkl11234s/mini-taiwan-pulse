import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { companyCapitalGridOwnerAdapter, companyCapitalGridOwnerDescriptor } from "../companyCapitalGridOwnerDataset";

const root = resolve(process.cwd(), "../runtime/owner-only/company-capital-grid");
const asset = readFileSync(`${root}/company-capital-grid-1500m-owner-202608.geojson`);
const checkoutRoot = process.cwd().split("/.worktrees/")[0]!;
const source = JSON.parse(readFileSync(resolve(checkoutRoot, "../taipei-gis-analytics/data/processed/business_registry/company_capital_grid/company_capital_grid_1500m_202608_r2.geojson"), "utf8"));

function useAsset() { vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(asset, { status: 200, headers: { "content-type": "application/geo+json" } })))); }
function byId(gridId: string) { return source.features.find((feature: { properties: { grid_id: string } }) => feature.properties.grid_id === gridId)!.properties; }

it("keeps the 202608 1.5km grid source identity and all-missing capital semantics", async () => {
  useAsset(); const executor = new QueryExecutor([companyCapitalGridOwnerAdapter]);
  const nullGrid = source.features.find((feature: { properties: { capital_median: unknown } }) => feature.properties.capital_median === null)!.properties.grid_id;
  const result = await executor.execute({ datasetId: companyCapitalGridOwnerDescriptor.datasetId, filters: [{ field: "grid_id", op: "eq", value: nullGrid }], select: ["grid_id", "capital_sum", "capital_median"], limit: 1 });
  expect(result).toMatchObject({ totalMatched: 1, rows: [{ grid_id: nullGrid, capital_sum: 0, capital_median: null }], excludedByReason: { capital_median_missing: 3 } });
  expect(result.cost).toMatchObject({ rowsScanned: 5745 }); expect(result.sourceRefs[0]?.checksumSha256).toBe("ecf59329d4812d55bf3f8b1cc296ab94b3cfc994dcc9da5cea866f9af496d330");
});

it("matches independent Taipei and Kaohsiung grid-cell oracles", async () => {
  useAsset(); const executor = new QueryExecutor([companyCapitalGridOwnerAdapter]);
  const cases = ["G1500_100_245", "G1500_18_77"];
  for (const gridId of cases) {
    const oracle = byId(gridId); const result = await executor.execute({ datasetId: companyCapitalGridOwnerDescriptor.datasetId, filters: [{ field: "grid_id", op: "eq", value: gridId }], limit: 1 });
    expect(result.rows[0]).toMatchObject(oracle); expect(result.totalMatched).toBe(1);
  }
});

it("does not offer polygon bbox filtering before the executor has polygon bbox semantics", async () => {
  useAsset(); const executor = new QueryExecutor([companyCapitalGridOwnerAdapter]);
  await expect(executor.execute({ datasetId: companyCapitalGridOwnerDescriptor.datasetId, bbox: [121.4, 25, 121.6, 25.2], limit: 1 })).rejects.toThrow("BBOX_NOT_SUPPORTED");
});
