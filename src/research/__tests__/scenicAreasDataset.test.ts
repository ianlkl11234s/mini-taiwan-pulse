import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { QueryExecutor } from "../queryExecutor";
import { scenicAreasAdapter, scenicAreasDescriptor } from "../scenicAreasDataset";

const path = "public/tourism/national_scenic_areas_national.geojson";
const fetchSnapshot = async () => new Response(await readFile(path), { headers: { "content-type": "application/geo+json" } });

it("reads exactly the SHA-bound 12 national scenic area polygons", async () => {
  const original = globalThis.fetch; globalThis.fetch = fetchSnapshot;
  const adapter = { ...scenicAreasAdapter, read: (_p: Readonly<Record<string, unknown>>, signal?: AbortSignal) => scenicAreasAdapter.read({}, signal) };
  let result;
  try { result = await new QueryExecutor([adapter]).execute({ datasetId: scenicAreasDescriptor.datasetId, select: ["name", "category", "geometry"], limit: 12 }); } finally { globalThis.fetch = original; }
  expect(result.totalMatched).toBe(12);
  expect(result.rows.every(row => row.category === "national_scenic_area" && (row.geometry as { type: string }).type === "MultiPolygon")).toBe(true);
  expect(result.sourceRefs[0]).toEqual(expect.objectContaining({ checksumSha256: "9910b7329a361247989b91f50ebda63762e557411eae13dda6f1ead997384e38" }));
});

it("fails closed when the fixed display asset differs", async () => {
  const adapter = { ...scenicAreasAdapter, read: async () => { const original = globalThis.fetch; globalThis.fetch = async () => new Response("{}", { status: 200 }); try { return await scenicAreasAdapter.read({}); } finally { globalThis.fetch = original; } } };
  await expect(new QueryExecutor([adapter]).execute({ datasetId: scenicAreasDescriptor.datasetId, limit: 1 })).rejects.toThrow("SCENIC_AREAS_SOURCE_MISMATCH");
});

it("records the known upstream coverage boundary", () => {
  expect(scenicAreasDescriptor.coverage).toContain("雲嘉南濱海國家風景區");
  expect(scenicAreasDescriptor.geometry.spatialAnalysisEligible).toBe(true);
  expect(scenicAreasDescriptor.layerRefs).toEqual(["tourScenicAreas"]);
});

it("matches independent interior places and a name variant against full surfaces", async () => {
  const original = globalThis.fetch; globalThis.fetch = fetchSnapshot;
  try {
    const executor = new QueryExecutor([scenicAreasAdapter]);
    const dapeng = await executor.execute({ datasetId: scenicAreasDescriptor.datasetId, bbox: [120.47728, 22.44026, 120.47730, 22.44028], filters: [{ field: "name", op: "eq", value: "大鵬灣國家風景區" }], select: ["name", "area_km2", "geometry"], limit: 12 });
    const matsu = await executor.execute({ datasetId: scenicAreasDescriptor.datasetId, bbox: [119.94490, 26.17491, 119.94492, 26.17493], filters: [{ field: "name", op: "eq", value: "馬祖國家風景區" }], select: ["name", "area_km2"], limit: 12 });
    expect(dapeng).toMatchObject({ totalMatched: 1, rows: [expect.objectContaining({ name: "大鵬灣國家風景區", area_km2: 28.494 })] });
    expect(matsu).toMatchObject({ totalMatched: 1, rows: [expect.objectContaining({ name: "馬祖國家風景區" })] });
  } finally { globalThis.fetch = original; }
});
