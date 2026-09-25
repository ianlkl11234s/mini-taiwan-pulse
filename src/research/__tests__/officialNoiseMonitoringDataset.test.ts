import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { officialNoiseMonitoringAdapter } from "../officialNoiseMonitoringDataset";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/environment/official_noise_monitoring.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("keeps all stations while distinguishing measured, historical and unavailable rows", async () => {
  const executor = new QueryExecutor([officialNoiseMonitoringAdapter]);
  const all = await executor.execute({ datasetId: "tw-official-noise-monitoring-fixed-source", select: ["station_id", "freshness_status", "geometry"], limit: 1 });
  const fresh = await executor.execute({ datasetId: "tw-official-noise-monitoring-fixed-source", filters: [{ field: "freshness_status", op: "eq", value: "fresh" }], select: ["station_name", "laeq_window_db", "latest_observation_date", "active_day_ratio"], limit: 1 });
  const unavailable = await executor.execute({ datasetId: "tw-official-noise-monitoring-fixed-source", filters: [{ field: "freshness_status", op: "eq", value: "unavailable" }], select: ["laeq_window_db", "sample_count"], limit: 1 });
  expect(all).toMatchObject({ totalMatched: 426, excludedByReason: { missing_geometry: 11 } });
  expect(fresh.totalMatched).toBe(15);
  expect(fresh.rows[0]?.laeq_window_db).not.toBeNull();
  expect(unavailable).toMatchObject({ totalMatched: 267, rows: [{ laeq_window_db: null, sample_count: 0 }] });
  expect(all.sourceRefs[0]?.checksumSha256).toBe("8f88b0192d0a874ee0a42da322c0ba1390ae69b40e5b90345fbe00b3088ff162");
});

it("allows bounded geometry only for located official stations", async () => {
  const result = await new QueryExecutor([officialNoiseMonitoringAdapter]).execute({ datasetId: "tw-official-noise-monitoring-fixed-source", bbox: [121.44, 25.01, 121.47, 25.04], select: ["station_id", "geometry"], limit: 20 });
  expect(result.totalMatched).toBeGreaterThan(0);
  expect(result.rows.every(row => (row.geometry as { type?: string } | null)?.type === "Point")).toBe(true);
  expect(officialNoiseMonitoringAdapter.descriptor.geometry.spatialAnalysisEligible).toBe(true);
});
