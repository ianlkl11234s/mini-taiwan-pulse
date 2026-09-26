import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { QueryExecutor } from "../queryExecutor";
import { tourEventsFixedDescriptor, tourEventsFixedPointAdapter } from "../tourEventsFixedDataset";

beforeEach(() => {
  clearPointDatasetCache();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(await readFile("public/tourism/activities_national.geojson"), {
    headers: { "content-type": "application/geo+json" },
  })));
});
afterEach(() => { vi.unstubAllGlobals(); clearPointDatasetCache(); });

it("reads the fixed stale event snapshot with source time, category, and cancellation semantics", async () => {
  const executor = new QueryExecutor([tourEventsFixedPointAdapter]);
  const all = await executor.execute({ datasetId: tourEventsFixedDescriptor.datasetId, select: ["id", "event_status", "geometry"], limit: 1 });
  const yinggeApril = await executor.execute({
    datasetId: tourEventsFixedDescriptor.datasetId,
    bbox: [121.34, 24.93, 121.36, 24.96],
    filters: [{ field: "city", op: "eq", value: "新北市" }, { field: "event_class", op: "eq", value: "2" }],
    time: { field: "start_time", start: "2026-04-01T00:00:00+08:00", end: "2026-05-01T00:00:00+08:00" },
    select: ["id", "name", "start_time", "end_time", "event_status", "geometry"], limit: 100,
  });
  const cancelled = await executor.execute({ datasetId: tourEventsFixedDescriptor.datasetId, filters: [{ field: "event_status", op: "eq", value: "EventCancelled" }], select: ["id", "name", "start_time", "end_time", "event_status"], limit: 1 });
  expect(all).toMatchObject({ totalMatched: 828, freshness: "stale", sourceRefs: [expect.objectContaining({ checksumSha256: "0e51aea0298b1eb60c60990f2ff326efa30e0367925e2405271ba94e7de1ea3c" })] });
  expect(yinggeApril.totalMatched).toBe(6);
  expect(yinggeApril.rows).toContainEqual(expect.objectContaining({ id: "Event_382000000A_003768", name: "2026春遊三鶯", start_time: "2026-04-02T16:00:00+08:00", end_time: "2026-06-21T15:59:59+08:00", event_status: "EventScheduled", geometry: { type: "Point", coordinates: [121.35203, 24.94925] } }));
  expect(cancelled.rows).toEqual([expect.objectContaining({ id: "Event_A15010500H_000004", name: "在東引拼一座島", event_status: "EventCancelled" })]);
  expect(tourEventsFixedDescriptor.timeFields.map(field => field.name)).toEqual(["start_time", "end_time"]);
  expect(tourEventsFixedDescriptor.valueSemantics.stale).toContain("不可宣稱 current events");
});
