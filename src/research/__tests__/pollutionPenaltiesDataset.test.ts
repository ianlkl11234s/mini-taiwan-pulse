import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pollutionPenaltyEventsAdapter, pollutionPenaltyEventsDescriptor } from "../pollutionPenaltiesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/owner-only/pollution-penalties-v2/";
const prefix = "/__local-research-owner-only/pollution-penalties-v2/";
const source = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/environment/pollution_source/frontend/pollution_penalties_events_20260706.geojsonseq";
type Bbox = readonly [number, number, number, number];

async function fullSourceOracle(bboxes: readonly Bbox[]): Promise<number[]> {
  const counts = bboxes.map(() => 0);
  const lines = createInterface({ input: createReadStream(source), crlfDelay: Infinity });
  for await (const line of lines) {
    const coordinates = (JSON.parse(line) as { geometry: { coordinates: [number, number] } }).geometry.coordinates;
    for (let index = 0; index < bboxes.length; index++) {
      const bbox = bboxes[index]!;
      if (coordinates[0] >= bbox[0] && coordinates[0] <= bbox[2] && coordinates[1] >= bbox[1] && coordinates[1] <= bbox[3]) counts[index]!++;
    }
  }
  return counts;
}

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("matches independent full-source oracles for dense Taipei and rural contrast within hard budgets", async () => {
  const executor = new QueryExecutor([pollutionPenaltyEventsAdapter]);
  expect(pollutionPenaltyEventsDescriptor.layerRefs).toEqual(["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile", "noiseEnforcementEvents"]);
  expect(pollutionPenaltyEventsDescriptor.recordGrain).toBe("event");
  expect(pollutionPenaltyEventsDescriptor.access.query.supportsBbox).toBe(true);
  for (const field of ["violation_fact", "document_no", "ems_no", "fac_name", "source_row_no", "event_id", "full_address"]) expect(pollutionPenaltyEventsDescriptor.fields.map(item => item.name)).not.toContain(field);
  await expect(executor.execute({ datasetId: pollutionPenaltyEventsDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  const bboxes = [[121.525, 25.04, 121.535, 25.05], [120.67, 24.13, 120.69, 24.15]] as const;
  const [oracle, results] = await Promise.all([
    fullSourceOracle(bboxes),
    Promise.all(bboxes.map(bbox => executor.execute({ datasetId: pollutionPenaltyEventsDescriptor.datasetId, bbox, select: ["event_medium", "severity_event", "geocode_precision", "geometry"], limit: 100 }))),
  ]);
  for (const [index, result] of results.entries()) {
    expect(result.totalMatched).toBeGreaterThan(0);
    expect(result.totalMatched).toBe(oracle[index]);
    expect(result.cost.bytesScanned).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(result.rows.every(row => (row.geometry as { type?: string }).type === "Point")).toBe(true);
    expect(result.sourceRefs[0]?.checksumSha256).toBe("247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937");
  }
});

it("fails closed for a broad bbox", async () => {
  await expect(new QueryExecutor([pollutionPenaltyEventsAdapter]).execute({ datasetId: pollutionPenaltyEventsDescriptor.datasetId, bbox: [118, 21, 123, 27], limit: 1 })).rejects.toThrow("DATASET_TOO_LARGE");
});

it("documents the frontend severity filters and noise overlap", () => {
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("critical（55,281）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("high 或 normal（248,556）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("mobile（111,067）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("noise（29,661）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("交叉");
});
