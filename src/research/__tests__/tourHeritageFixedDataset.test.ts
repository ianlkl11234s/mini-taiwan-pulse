import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { tourHeritageFixedAdapter } from "../tourHeritageFixedDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/tourism/heritage_national.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads the pinned Point snapshot for a new-place bbox and preserves historical-building grade missingness", async () => {
  const executor = new QueryExecutor([tourHeritageFixedAdapter]);
  const nearby = await executor.execute({
    datasetId: "tw-tour-heritage-fixed-20260524", bbox: [120.44, 23.47, 120.46, 23.50],
    select: ["name", "category", "grade", "geometry"], limit: 100,
  });
  const landscapes = await executor.execute({
    datasetId: "tw-tour-heritage-fixed-20260524", filters: [{ field: "category", op: "eq", value: "文化景觀" }],
    select: ["name", "category", "grade", "geometry"], limit: 100,
  });
  const historicalBuildings = await executor.execute({
    datasetId: "tw-tour-heritage-fixed-20260524", filters: [{ field: "category", op: "eq", value: "歷史建築" }],
    select: ["name", "category", "grade", "geometry"], limit: 1,
  });

  expect(nearby.rows.some(row => row.name === "嘉義仁武宮" && row.category === "古蹟" && (row.geometry as { type?: unknown }).type === "Point")).toBe(true);
  expect(landscapes.totalMatched).toBe(79);
  expect(landscapes.rows[0]).toMatchObject({ name: "阿里山林業暨鐵道文化景觀", category: "文化景觀", grade: "文化景觀", geometry: { type: "Point" } });
  expect(historicalBuildings.totalMatched).toBe(1759);
  expect(historicalBuildings.rows[0]).toMatchObject({ name: "原嘉義酒廠", category: "歷史建築", grade: "", geometry: { type: "Point" } });
  expect(tourHeritageFixedAdapter.descriptor.geometry.precision).toContain("不是古蹟或歷史建築的建物／基地範圍");
});
