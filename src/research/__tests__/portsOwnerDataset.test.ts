import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { portsOwnerAdapter, portsOwnerDescriptor } from "../portsOwnerDataset";

const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/ports/ports_20260527.geojson";
const sidecar = "../runtime/owner-only/ports/ports-owner-20260527.geojson";
type Bbox = readonly [number, number, number, number];

beforeEach(() => { clearPointDatasetCache(); vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile(sidecar), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("matches independent port point oracles in two coastal regions and a category variant", async () => {
  const features = (JSON.parse(await readFile(source, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { port_class_group: string | null } }[] }).features;
  const cases: { bbox: Bbox; group?: string }[] = [
    { bbox: [121.8, 24.5, 121.95, 24.7] },
    { bbox: [120.2, 22.55, 120.4, 22.75], group: "渡輪觀光碼頭" },
  ];
  const executor = new QueryExecutor([portsOwnerAdapter]);
  for (const item of cases) {
    const expected = features.filter(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      return lng >= item.bbox[0] && lng <= item.bbox[2] && lat >= item.bbox[1] && lat <= item.bbox[3]
        && (item.group === undefined || feature.properties.port_class_group === item.group);
    }).length;
    const result = await executor.execute({ datasetId: portsOwnerDescriptor.datasetId, bbox: item.bbox, filters: item.group ? [{ field: "port_class_group", op: "eq", value: item.group }] : [], select: ["name", "port_class_group", "county", "county_id", "geometry"], limit: 100 });
    expect(result.totalMatched).toBe(expected);
  }
});

it("keeps separate point and polygon source semantics and nullable cross-strait codes", async () => {
  const executor = new QueryExecutor([portsOwnerAdapter]);
  const result = await executor.execute({ datasetId: portsOwnerDescriptor.datasetId, filters: [{ field: "county_id", op: "eq", value: null }], select: ["name", "county", "county_id"], limit: 100 });
  expect(result.totalMatched).toBe(6);
  expect(portsOwnerDescriptor.geometry).toMatchObject({ role: "proxy", spatialAnalysisEligible: false });
  expect(portsOwnerDescriptor.source.lineage).toContain("港區 polygon 展示檔");
  expect(portsOwnerDescriptor.supportedOperations).not.toContain("nearest");
});
