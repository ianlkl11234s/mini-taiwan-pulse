import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accidentTaipeiOwnerAdapter, accidentTaipeiOwnerDescriptor } from "../accidentTaipeiOwnerDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/accident-taipei/";
const prefix = "/__local-research-owner-only/accident-taipei/";
const sourcePath = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/police_justice/accident_taipei_dots/accident_taipei_dots_20260626.geojson";
type Bbox = readonly [number, number, number, number];

async function rawOracle(bbox: Bbox, caseClass: string): Promise<number> {
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as { features: { geometry: { coordinates: [number, number] }; properties: { case_class: string } }[] };
  return source.features.filter(feature => { const [lng, lat] = feature.geometry.coordinates; return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3] && feature.properties.case_class === caseClass; }).length;
}

beforeEach(() => { clearPointDatasetCache(); clearPointPartitionCache(); vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } }))); });
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires a bbox and does not expose incident text or precise time", async () => {
  const executor = new QueryExecutor([accidentTaipeiOwnerAdapter]);
  await expect(executor.execute({ datasetId: accidentTaipeiOwnerDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  expect(accidentTaipeiOwnerDescriptor).toMatchObject({ layerRefs: ["accidentTaipei"], access: { mode: "owner_only", query: { supportsBbox: true } }, geometry: { role: "proxy", spatialAnalysisEligible: false } });
  expect(accidentTaipeiOwnerDescriptor.fields.map(field => field.name)).not.toEqual(expect.arrayContaining(["entity_id", "occurred_at", "location"]));
});

it("matches independent full-source bbox and case-class oracles with bounded shard reads", async () => {
  const cases: { bbox: Bbox; caseClass: string; expected: number }[] = [
    { bbox: [121.50, 25.04, 121.54, 25.08], caseClass: "2", expected: 4943 },
    { bbox: [121.54, 25.02, 121.58, 25.06], caseClass: "1", expected: 16 },
  ];
  const executor = new QueryExecutor([accidentTaipeiOwnerAdapter]);
  for (const item of cases) {
    const oracle = await rawOracle(item.bbox, item.caseClass);
    const result = await executor.execute({ datasetId: accidentTaipeiOwnerDescriptor.datasetId, bbox: item.bbox, filters: [{ field: "case_class", op: "eq", value: item.caseClass }], select: ["record_id", "case_class", "geometry"], limit: 100 });
    expect(oracle).toBe(item.expected);
    expect(result.totalMatched).toBe(oracle);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
  }
});

it("fails closed when the sidecar manifest bytes change", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"schemaVersion":"pulse-point-partitions/2","source":{},"shards":[]}')));
  clearPointPartitionCache();
  await expect(new QueryExecutor([accidentTaipeiOwnerAdapter]).execute({ datasetId: accidentTaipeiOwnerDescriptor.datasetId, bbox: [121.5, 25.0, 121.51, 25.01] })).rejects.toThrow("PARTITION_SHA_MISMATCH");
});
