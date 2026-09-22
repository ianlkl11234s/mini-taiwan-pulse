import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clearPointDatasetCache } from "../pointDatasetAdapter";
import { exploreData, datasetRecovery } from "../dataExploration";
import { ResearchAnalysisSession } from "../researchAnalysisSession";
import { describeDataset } from "../researchDatasets";
const context = { locked: new Set<string>(), visible: new Set<string>() };
afterEach(() => { clearPointDatasetCache(); vi.unstubAllGlobals(); });
const body = (kind: string) => JSON.stringify({ type: "FeatureCollection", features: [
  { type: "Feature", properties: kind === "school" ? { code: "same", school_name: "甲校", city: "臺北市" } : { name: "甲館", county: "臺北市" }, geometry: { type: "Point", coordinates: [121.5, 25] } },
  { type: "Feature", properties: kind === "school" ? { code: "same", school_name: "乙校", city: "臺北市" } : { name: "乙館", county: null }, geometry: { type: "Point", coordinates: [121.6, 25] } },
] });
it("discovers point and regional-statistics capabilities, then composes a map result without full-page rows", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(body(url.includes("schools") ? "school" : "library"), { headers: { "content-type": "application/geo+json" } })));
  const session = new ResearchAnalysisSession();
  const discovery = await exploreData({ query: "教育資源", probe: true, limit: 2 }, context, datasetId => session.queryRecords({ datasetId, limit: 2 }));
  const readers = discovery.candidates.flatMap(candidate => candidate.readers);
  expect(readers.map(reader => reader.datasetId)).toContain("tw-schools");
  expect(readers.some(reader => reader.datasetId.startsWith("regional-statistics:"))).toBe(true);
  expect(discovery.probes).toBe(1);
  expect(readers.find(reader => reader.datasetId === "tw-schools")?.payload.status).toBe("readable");
  expect(readers.filter(reader => reader.datasetId.startsWith("regional-statistics:")).every(reader => reader.payload.status === "parameters_or_specialized_reader_required")).toBe(true);
  const candidates = await session.queryRecords({ datasetId: "tw-schools", filters: [{ field: "city", op: "eq", value: "台北市" }], limit: 1 });
  expect(candidates.totalMatched).toBe(2); // 臺/台 spelling is not a missing-data claim.
  const libraries = await session.queryRecords({ datasetId: "tw-public-libraries", limit: 1 });
  const result = session.execute("compare_neighborhoods", { candidateResultId: candidates.resultId, sourceResultIds: [candidates.resultId, libraries.resultId], radiusM: 1000, rankBySource: 1, limit: 1 });
  expect(result).toMatchObject({ totalRows: 2, returned: 1, freshness: "unknown", presentation: { kind: "neighborhood", countField: "source_1_count" } });
  expect(session.presentable([String(result.resultId)])[0]!.rows).toHaveLength(2);
  expect(new Set(session.presentable([String(candidates.resultId)])[0]!.rows.map(row => row.record_id)).size).toBe(2);
  expect(session.execute("get_analysis_result", { resultId: result.resultId, offset: 0, limit: 2 }).rows).toEqual(expect.arrayContaining([expect.objectContaining({ source_0_count: 1, source_1_count: 1 })]));
  expect(describeDataset("tw-public-libraries").license).toBe("unknown");
});
it("reports HTML fallback as missing asset, not zero; locks block probe and result reuse", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html><html></html>", { headers: { "content-type": "text/html" } })));
  const locked = new Set<string>(); const session = new ResearchAnalysisSession(() => locked);
  const discovery = await exploreData({ query: "tw-schools", probe: true, limit: 1 }, context, id => session.queryRecords({ datasetId: id, limit: 1 }));
  // Dataset IDs are also directly usable; raw HTML cannot become a successful empty collection.
  await expect(session.queryRecords({ datasetId: "tw-schools" })).rejects.toThrow("DATASET_ASSET_MISSING");
  expect(datasetRecovery("DATASET_ASSET_MISSING")).toContain("不是零筆");
  expect(discovery.probes).toBeLessThanOrEqual(3);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body("school"))));
  const result = await session.queryRecords({ datasetId: "tw-schools", limit: 1 });
  locked.add("eduSchoolElementary"); // shared source lock cannot be bypassed via another layer/dataset.
  await expect(session.queryRecords({ datasetId: "tw-schools" })).rejects.toThrow("LAYER_DENIED");
  expect(() => session.presentable([String(result.resultId)])).toThrow("LAYER_DENIED");
});
it.runIf(Boolean(process.env.PULSE_RESEARCH_REAL_ASSETS))("real local school+library exploratory analysis preserves versions and complete candidate scope", async () => {
  const assetRoot = process.env.PULSE_RESEARCH_REAL_ASSETS!;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(readFileSync(resolve(assetRoot, `.${url}`)), { headers: { "content-type": "application/geo+json" } })));
  const session = new ResearchAnalysisSession();
  const candidates = await session.queryRecords({ datasetId: "tw-schools", filters: [{ field: "city", op: "eq", value: "台北市" }], limit: 1 });
  const schools = await session.queryRecords({ datasetId: "tw-schools", limit: 1 });
  const libraries = await session.queryRecords({ datasetId: "tw-public-libraries", limit: 1 });
  const stores = await session.queryRecords({ datasetId: "tw-convenience-stores", limit: 1 });
  expect(schools.totalMatched).toBe(4315); expect(libraries.totalMatched).toBe(634); expect(stores.totalMatched).toBe(13223);
  const nearbyStores = session.execute("spatial_query", { resultId: stores.resultId, predicate: "within_distance", center: [121.56378381950438, 25.037523004565163], radiusM: 1000, limit: 5 });
  expect(nearbyStores).toMatchObject({ freshness: "unknown", method: { radiusM: 1000 }, summary: { radiusM: 1000 } });
  expect(Number(nearbyStores.totalRows)).toBeGreaterThan(0);
  const result = session.execute("compare_neighborhoods", { candidateResultId: candidates.resultId, sourceResultIds: [schools.resultId, libraries.resultId], radiusM: 1000, rankBySource: 0, limit: 5 });
  expect(result.totalRows).toBe(candidates.totalMatched);
  const full = session.presentable([String(result.resultId)])[0]!;
  expect(full.rows.length).toBeGreaterThan(100); expect(full.rows.length).toBeLessThan(500);
  expect(result.freshness).toBe("unknown");
  console.log(JSON.stringify({ acceptance: "real-neighborhood", candidateRecords: candidates.totalMatched, schoolRecords: schools.totalMatched, libraryRecords: libraries.totalMatched, convenienceStoreRecords: stores.totalMatched, nearbyConvenienceStores: nearbyStores.totalRows, method: result.method, sourceRefs: result.sourceRefs, top: result.rows }));
});
