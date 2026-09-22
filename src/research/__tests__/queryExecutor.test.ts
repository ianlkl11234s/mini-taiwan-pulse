import { describe, expect, it, vi } from "vitest";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "../dataContracts";
import { QueryExecutor } from "../queryExecutor";
import { createAdminStatisticsAdapter, createNewsEventAdapter, createPointDatasetAdapter } from "../queryAdapters";

const source = (sourceId: string, version: string): SourceReceipt => ({
  sourceId, version, acquiredAt: "2026-09-12T00:00:00.000Z", checksumSha256: "a".repeat(64), reference: `https://data.example/${sourceId}`,
});

const base = (overrides: Partial<DatasetDescriptor>): DatasetDescriptor => ({
  schemaVersion: "pulse-dataset/0.1", datasetId: "missing", label: "測試", description: "具來源與版本的驗收資料",
  layerRefs: [], kind: "point", recordGrain: "place", primaryKey: ["id"],
  fields: [{ name: "id", type: "string", nullable: false, nullMeaning: null, unit: null }],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source coordinate", spatialAnalysisEligible: true },
  timeFields: [], coverage: "fixture", license: "fixture-only", valueSemantics: DEFAULT_VALUE_SEMANTICS,
  versions: [{ versionId: "v1", observedAt: null, availableAt: "2026-09-12T00:00:00Z", checksumSha256: "a".repeat(64), mutable: false }],
  source: { publisher: "fixture", reference: "https://data.example", lineage: "source fixture -> normalized record" },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["id"], filters: ["id"], maxRowsPerQuery: 50, maxScanRows: 100 }), supportedOperations: ["query_records"], adapterId: "fixture-adapter",
  ...overrides,
});

const schools = base({
  datasetId: "tw-schools", adapterId: "geojson-point-v1", label: "學校", layerRefs: ["schools"], primaryKey: ["code"],
  fields: [
    { name: "code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  access: boundedAccess({ mode: "public", method: "static_asset", fields: ["code", "name", "city", "geometry"], filters: ["code", "name", "city"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: 100 }),
});

const news = base({
  datasetId: "tw-news-events", adapterId: "news-event-rpc-v1", label: "新聞事件", kind: "event", recordGrain: "event", primaryKey: ["event_id"], layerRefs: ["newsEvents"],
  fields: [
    { name: "event_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "title", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "published_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "occurred_at", type: "datetime", nullable: true, nullMeaning: "來源未提供事件發生時間；不可用發布時間代填", unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "事件未定位", unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "township cluster proxy or none", spatialAnalysisEligible: false },
  timeFields: [
    { name: "published_at", role: "published", timezone: "UTC" },
    { name: "occurred_at", role: "occurred", timezone: "UTC" },
  ],
  access: boundedAccess({ mode: "owner_only", method: "rpc", fields: ["event_id", "title", "published_at", "occurred_at", "geometry"], filters: ["event_id", "title"], timeFields: ["published_at", "occurred_at"], maxRowsPerQuery: 50, maxScanRows: 100 }),
});

const statistics = base({
  datasetId: "agri-crop-production", adapterId: "regional-statistics-v1", label: "作物產量", kind: "admin_statistic", recordGrain: "admin_statistic", layerRefs: ["statsCropProductionTownship"],
  primaryKey: ["release_id", "area_code"],
  fields: [
    { name: "release_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "value", type: "number", nullable: true, nullMeaning: "suppressed、not_reported 或 missing；由 status 區分", unit: "公噸" },
    { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_token", type: "string", nullable: true, nullMeaning: "observed 數值沒有原始缺值符號", unit: null },
  ],
  geometry: { type: "none", crs: null, role: "none", precision: "requires explicit boundary join", spatialAnalysisEligible: false },
  timeFields: [],
  access: boundedAccess({ mode: "public", method: "statistics_snapshot", fields: ["release_id", "area_code", "value", "status", "source_token"], filters: ["release_id", "area_code", "status"], maxRowsPerQuery: 50, maxScanRows: 100 }),
});

describe("shared research query executor", () => {
  it("uses one result contract for point, raw event, and exact-release statistics", async () => {
    const pointRead = vi.fn().mockResolvedValue({ rows: [
      { code: "A", name: "甲校", city: "臺北市", geometry: { type: "Point", coordinates: [121.5, 25] } },
      { code: "B", name: "乙校", city: null, geometry: { type: "Point", coordinates: [121.6, 25.1] } },
    ], source: source("schools", "sha256:schools-v1"), coverage: "Taiwan", exclusions: { invalid_geometry: 1 } });
    const newsRead = vi.fn().mockResolvedValue({ rows: [
      { event_id: "N1", title: "有定位消息", published_at: "2026-09-11T02:00:00Z", occurred_at: null, geometry: { type: "Point", coordinates: [121.5, 25] } },
      { event_id: "N2", title: "無定位消息", published_at: "2026-09-11T03:00:00Z", occurred_at: null, geometry: null },
    ], source: source("news-rpc", "2026-09-11:revision-7"), coverage: "selected publication day", exclusions: { omitted_from_map_no_geometry: 1 } });
    const statsRead = vi.fn(async (parameters: Record<string, unknown>) => {
      if (parameters.releaseId !== "release-2025") throw new Error("RELEASE_NOT_ALLOWED");
      return { rows: [
        { release_id: "release-2025", area_code: "A01", value: 0, status: "observed", source_token: null },
        { release_id: "release-2025", area_code: "A02", value: null, status: "suppressed", source_token: "X" },
      ], source: source("regional-statistics", "release-2025"), coverage: "2 administrative areas" };
    });
    const executor = new QueryExecutor([
      createPointDatasetAdapter(schools, pointRead), createNewsEventAdapter(news, newsRead), createAdminStatisticsAdapter(statistics, statsRead),
    ]);

    const pointResult = await executor.execute({ datasetId: "tw-schools", filters: [{ field: "city", op: "eq", value: "臺北市" }] });
    const newsResult = await executor.execute({ datasetId: "tw-news-events", parameters: { date: "2026-09-11", minRelevance: 0, eventsOnly: false, minSeverity: 0 } });
    const newsWindow = await executor.execute({ datasetId: "tw-news-events", time: { field: "published_at", start: "2026-09-11T02:30:00Z", end: "2026-09-11T04:00:00Z" }, parameters: { date: "2026-09-11", minRelevance: 0, eventsOnly: false, minSeverity: 0 } });
    const statsResult = await executor.execute({ datasetId: "agri-crop-production", parameters: { releaseId: "release-2025" } });

    expect([pointResult, newsResult, statsResult].every(result => result.schemaVersion === "pulse-query-result/0.1" && result.executionStatus === "complete")).toBe(true);
    expect(pointResult.excludedByReason.invalid_geometry).toBe(1);
    expect(newsResult.rows).toHaveLength(2);
    expect(newsWindow.rows).toHaveLength(1);
    expect(newsWindow.rows[0]?.event_id).toBe("N2");
    expect(newsResult.rows[1]?.geometry).toBeNull();
    expect(newsResult.excludedByReason.omitted_from_map_no_geometry).toBe(1);
    expect(statsResult.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ area_code: "A01", value: 0, status: "observed" }),
      expect.objectContaining({ area_code: "A02", value: null, status: "suppressed", source_token: "X" }),
    ]));
  });

  it("makes result ids reproducible from query plus source version and enforces allowlists and budgets", async () => {
    const reader = vi.fn().mockResolvedValue({ rows: [{ code: "A", name: "甲校", city: null, geometry: { type: "Point", coordinates: [121.5, 25] } }], source: source("schools", "v1"), coverage: "Taiwan" });
    const executor = new QueryExecutor([createPointDatasetAdapter(schools, reader), createAdminStatisticsAdapter(statistics, async () => ({ rows: [], source: source("statistics", "release-2025"), coverage: "fixture" }))]);
    const first = await executor.execute({ datasetId: "tw-schools", select: ["code", "city"] });
    const second = await executor.execute({ datasetId: "tw-schools", select: ["code", "city"] });
    expect(second.resultId).toBe(first.resultId);
    expect(first.rows[0]?.city).toBeNull();
    await expect(executor.execute({ datasetId: "tw-schools", select: ["secret"] })).rejects.toThrow("FIELD_NOT_ALLOWED");
    await expect(executor.execute({ datasetId: "tw-schools", parameters: { url: "file:///etc/passwd" } })).rejects.toThrow("PARAMETER_NOT_ALLOWED");
    await expect(executor.execute({ datasetId: "tw-schools", time: { field: "published_at", start: "2026-09-11T00:00:00Z" } })).rejects.toThrow("INVALID_TIME_WINDOW");

    const overBudget = new QueryExecutor([createPointDatasetAdapter(schools, async () => ({ rows: [], source: source("schools", "v1"), coverage: "unknown", rowsScanned: 101 }))]);
    await expect(overBudget.execute({ datasetId: "tw-schools" })).rejects.toThrow("SCAN_BUDGET_EXCEEDED");
  });

  it("uses version-bound cursors, bbox and projections while returning access and limit receipts", async () => {
    const reader = vi.fn().mockResolvedValue({ rows: [
      { code: "A", name: "甲校", city: "臺北市", geometry: { type: "Point", coordinates: [121.5, 25] } },
      { code: "B", name: "乙校", city: "臺北市", geometry: { type: "Point", coordinates: [121.6, 25.1] } },
      { code: "C", name: "界外校", city: "新北市", geometry: { type: "Point", coordinates: [122, 25] } },
    ], source: source("schools", "v1"), coverage: "Taiwan", bytesScanned: 300 });
    const executor = new QueryExecutor([createPointDatasetAdapter(schools, reader), createAdminStatisticsAdapter(statistics, async () => ({ rows: [], source: source("statistics", "release-2025"), coverage: "fixture" }))]);
    const first = await executor.execute({ datasetId: "tw-schools", select: ["code", "name"], bbox: [121.4, 24.9, 121.7, 25.2], limit: 1 });
    expect(first).toMatchObject({ totalMatched: 2, returned: 1, access: { mode: "public", method: "static_asset", authorized: true }, limits: { maxRows: 50, maxScanRows: 100, maxResponseBytes: 24576 } });
    expect(first.rows[0]).toEqual({ code: "A", name: "甲校" });
    const second = await executor.execute({ datasetId: "tw-schools", select: ["code", "name"], bbox: [121.4, 24.9, 121.7, 25.2], cursor: first.limits.nextCursor!, limit: 1 });
    expect(second.rows[0]).toEqual({ code: "B", name: "乙校" });
    expect(second.limits.nextCursor).toBeNull();
    await expect(executor.execute({ datasetId: "tw-schools", select: ["code"], cursor: first.limits.nextCursor!, limit: 1 })).rejects.toThrow("CURSOR_SOURCE_MISMATCH");
    await expect(executor.execute({ datasetId: "tw-schools", cursor: "not-a-cursor" })).rejects.toThrow("INVALID_CURSOR");
    await expect(executor.execute({ datasetId: "tw-schools", cursor: first.limits.nextCursor!, offset: 1 })).rejects.toThrow("INVALID_PAGINATION");
    await expect(executor.execute({ datasetId: "agri-crop-production", bbox: [121, 24, 122, 25], parameters: { releaseId: "release-2025" } })).rejects.toThrow("BBOX_NOT_SUPPORTED");
  });

  it("rejects adapter rows that violate required fields, geometry, or statistic null semantics", async () => {
    const missingId = new QueryExecutor([createPointDatasetAdapter(schools, async () => ({ rows: [{ name: "無代碼", city: null, geometry: { type: "Point", coordinates: [121, 25] } }], source: source("schools", "v1"), coverage: "unknown" }))]);
    await expect(missingId.execute({ datasetId: "tw-schools" })).rejects.toThrow("INVALID_ADAPTER_ROW");
    const badGeometry = new QueryExecutor([createPointDatasetAdapter(schools, async () => ({ rows: [{ code: "A", name: "甲校", city: null, geometry: { type: "Point", coordinates: [999, 25] } }], source: source("schools", "v1"), coverage: "unknown" }))]);
    await expect(badGeometry.execute({ datasetId: "tw-schools" })).rejects.toThrow("INVALID_ADAPTER_GEOMETRY");
    const suppressedAsZero = new QueryExecutor([createAdminStatisticsAdapter(statistics, async () => ({ rows: [{ release_id: "release-2025", area_code: "A", value: 0, status: "suppressed", source_token: "X" }], source: source("statistics", "release-2025"), coverage: "unknown" }))]);
    await expect(suppressedAsZero.execute({ datasetId: "agri-crop-production", parameters: { releaseId: "release-2025" } })).rejects.toThrow("INVALID_STATISTICS_VALUE");
  });
});

it("evicts only least-recent dynamic readers while stored snapshots remain independent", async () => {
  const adapterFor = (datasetId: string) => createPointDatasetAdapter(base({ datasetId }), async () => ({ rows: [{ id: "one" }], source: source(datasetId, "v1"), coverage: "fixture" }));
  const executor = new QueryExecutor(Array.from({ length: 6 }, (_, i) => adapterFor(`fixed-${i}`)));
  for (let i = 0; i < 8; i++) executor.register(adapterFor(`layer:source-${i}`));
  const captured = await executor.executeDetailed({ datasetId: "layer:source-0" });
  executor.describe("layer:source-0");
  executor.register(adapterFor("layer:source-8"));
  expect(executor.descriptors()).toHaveLength(14);
  expect(executor.describe("fixed-0")).not.toBeNull();
  expect(executor.describe("layer:source-0")).not.toBeNull();
  expect(executor.describe("layer:source-1")).toBeNull();
  expect(captured.materializedRows).toEqual([{ id: "one" }]);
  executor.register(adapterFor("layer:source-1"));
  await expect(executor.execute({ datasetId: "layer:source-1" })).resolves.toMatchObject({ totalMatched: 1 });
});
