import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { pollutionPenaltyEventsAdapter, pollutionPenaltyEventsDescriptor } from "../pollutionPenaltiesDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { clearPointPartitionCache } from "../pointDatasetPartitions";
import { QueryExecutor } from "../queryExecutor";

const root = "../runtime/point-partitions/pollution-penalties/";
const prefix = "/__local-research-point-partitions/pollution-penalties/";

beforeEach(() => {
  clearPointDatasetCache(); clearPointPartitionCache();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(await readFile(`${root}${url.slice(prefix.length)}`), { headers: { "content-type": "application/geo+json" } })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); clearPointPartitionCache(); });

it("requires bounded reads and preserves non-exclusive noise membership without identity fields", async () => {
  const executor = new QueryExecutor([pollutionPenaltyEventsAdapter]);
  expect(pollutionPenaltyEventsDescriptor.layerRefs).toEqual(["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile", "noiseEnforcementEvents"]);
  expect(pollutionPenaltyEventsDescriptor.recordGrain).toBe("event");
  expect(pollutionPenaltyEventsDescriptor.access.query.supportsBbox).toBe(true);
  for (const field of ["violation_fact", "document_no", "ems_no", "fac_name", "source_row_no", "event_id", "full_address"]) expect(pollutionPenaltyEventsDescriptor.fields.map(item => item.name)).not.toContain(field);
  await expect(executor.execute({ datasetId: pollutionPenaltyEventsDescriptor.datasetId })).rejects.toThrow("BBOX_REQUIRED");
  const results = await Promise.all(([[120.67, 24.13, 120.69, 24.15], [121.5, 25.03, 121.52, 25.05]] as const).map(bbox => executor.execute({ datasetId: pollutionPenaltyEventsDescriptor.datasetId, bbox, select: ["event_medium", "severity_event", "geocode_precision", "geometry"], limit: 100 })));
  for (const result of results) {
    expect(result.totalMatched).toBeGreaterThan(0);
    expect(result.cost.bytesScanned).toBeLessThan(8 * 1024 * 1024);
    expect(result.cost.rowsScanned).toBeLessThanOrEqual(20_000);
    expect(result.rows.every(row => (row.geometry as { type?: string }).type === "Point")).toBe(true);
    expect(result.sourceRefs[0]?.checksumSha256).toBe("247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937");
  }
});

it("documents the frontend severity filters and noise overlap", () => {
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("critical（55,281）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("high 或 normal（248,556）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("mobile（111,067）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("noise（29,661）");
  expect(pollutionPenaltyEventsDescriptor.coverage).toContain("交叉");
});
