import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { forestryPointAdapters } from "../forestryPointDatasets";
import { clearPointDatasetCache } from "../pointDatasetAdapter";

afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("registers the three fixed, source-coordinate forestry Point snapshots", async () => {
  const fixtures = await Promise.all([
    readFile("public/forestry/dam_lakes_in_forest.geojson"),
    readFile("public/forestry/mountain_signal_points.geojson"),
    readFile("public/forestry/mountain_trail_signs.geojson"),
  ]);
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(new Response(
    url.includes("dam_lakes") ? fixtures[0] : url.includes("signal_points") ? fixtures[1] : fixtures[2],
    { headers: { "content-type": "application/geo+json" } },
  ))));
  const results = await Promise.all(forestryPointAdapters.map(adapter => adapter.read({})));
  expect(forestryPointAdapters.map(adapter => adapter.descriptor.datasetId)).toEqual([
    "tw-forest-dam-lakes", "tw-mountain-signal-points", "tw-mountain-trail-signs",
  ]);
  expect(results.map(result => result.rows.length)).toEqual([32, 1416, 3407]);
  expect(results[0]!.rows[0]).toMatchObject({ lake_name: "士文溪堰塞湖", found_date: "098-08-13" });
  expect(results[1]!.rows[0]).toMatchObject({ name: "鐵杉林自然步道", forest_district: "宜蘭" });
  expect(results[2]!.rows[0]).toMatchObject({ route_name: "巴博庫魯山徑", installed_roc_year: 105 });
  for (const adapter of forestryPointAdapters) {
    expect(adapter.descriptor).toMatchObject({
      geometry: { type: "Point", role: "actual", spatialAnalysisEligible: true },
      license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
      versions: [{ checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }],
    });
    expect(adapter.descriptor.coverage).toContain("2026-06-07");
  }
  expect(forestryPointAdapters.map(adapter => adapter.descriptor.layerRefs)).toEqual([
    ["forestDamLakes"], ["forestSignalPoints"], ["forestTrailSigns"],
  ]);
  expect(forestryPointAdapters[0].descriptor.description).toContain("不能當作湖泊範圍");
  expect(forestryPointAdapters[1].descriptor.description).toContain("不能當作即時訊號");
  expect(forestryPointAdapters[2].descriptor.description).toContain("不能推論當前步道開放");
});
