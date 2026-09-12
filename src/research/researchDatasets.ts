import { AGRI_STATISTICS_RECIPES_BY_KEY } from "../data/agriStatisticsRecipes";
import { fetchNewsEventsDayClustersStrict } from "../data/newsEventsLoader";
import { loadRegionalStatisticsValues } from "../data/regionalStatisticsLoader";
import type { DatasetDescriptor, Scalar, SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createAdminStatisticsAdapter, createNewsEventAdapter, createPointDatasetAdapter } from "./queryAdapters";
import { QueryExecutor, type QueryExecution, type QueryRecordsInput } from "./queryExecutor";

const PADDY = AGRI_STATISTICS_RECIPES_BY_KEY.statsPaddyLandAreaTownship;

const schoolsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-schools", label: "全國各級學校", description: "教育部學校校址點位；機構與校區語意沿用來源。",
  layerRefs: ["schools"], kind: "point", recordGrain: "place", primaryKey: ["record_id"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "code", type: "string", nullable: true, nullMeaning: "來源未提供學校代碼", unit: null },
    { name: "school_name", type: "string", nullable: true, nullMeaning: "來源未提供校名", unit: null },
    { name: "school_level", type: "string", nullable: true, nullMeaning: "來源未提供學制", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "district", type: "string", nullable: true, nullMeaning: "來源未提供行政區", unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址", unit: null },
    { name: "region_type", type: "string", nullable: true, nullMeaning: "未標示偏遠地區類別，不等於一般地區的權威判定", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source geocoded school coordinate", spatialAnalysisEligible: true }, timeFields: [],
  coverage: "全臺；實際完整度須由來源 receipt 驗證", license: "unknown",
  versions: [],
  source: { publisher: "教育部", reference: "/education/schools.geojson", lineage: "public GeoJSON -> validated Point records" },
  accessPolicy: { mode: "public", maxRowsPerQuery: 50, maxScanRows: 10_000 }, supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geojson-point-v1",
};

const medicalHospitalsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-medical-hospitals", label: "全國醫院", description: "健保特約醫院院區點位；設施數不代表醫療量能或服務覆蓋。",
  layerRefs: ["medHospitals"], kind: "point", recordGrain: "place", primaryKey: ["record_id"],
  fields: [
    { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "facility_id", type: "string", nullable: true, nullMeaning: "來源未提供院區識別碼", unit: null },
    { name: "name", type: "string", nullable: true, nullMeaning: "來源未提供院名", unit: null },
    { name: "facility_name", type: "string", nullable: true, nullMeaning: "來源未提供設施名稱", unit: null },
    { name: "hospital_name", type: "string", nullable: true, nullMeaning: "來源未提供醫院名稱", unit: null },
    { name: "county", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "city", type: "string", nullable: true, nullMeaning: "來源未提供縣市", unit: null },
    { name: "address", type: "string", nullable: true, nullMeaning: "來源未提供地址", unit: null },
    { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "source facility coordinate", spatialAnalysisEligible: true }, timeFields: [],
  coverage: "全臺健保特約醫院；實際完整度須由來源 receipt 驗證", license: "unknown", versions: [],
  source: { publisher: "衛生福利部中央健康保險署", reference: "/geo/medical_hospitals.geojson", lineage: "public GeoJSON -> validated Point records" },
  accessPolicy: { mode: "public", maxRowsPerQuery: 50, maxScanRows: 20_000 }, supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "geojson-point-v1",
};

const newsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-news-events", label: "國內新聞事件", description: "按發布日取得的 raw event records；報導、事件與地圖 cluster 不混為同一 grain。",
  layerRefs: ["newsEvents"], kind: "event", recordGrain: "event", primaryKey: ["event_id"],
  fields: [
    { name: "event_id", type: "number", nullable: false, nullMeaning: null, unit: null },
    { name: "title", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "summary", type: "string", nullable: true, nullMeaning: "來源未提供摘要", unit: null },
    { name: "category", type: "string", nullable: true, nullMeaning: "來源未分類", unit: null },
    { name: "source", type: "string", nullable: true, nullMeaning: "來源名稱未提供", unit: null },
    { name: "url", type: "string", nullable: true, nullMeaning: "來源連結未提供", unit: null },
    { name: "published_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "occurred_at", type: "datetime", nullable: true, nullMeaning: "來源未提供事件發生時間；不可用發布時間代填", unit: null },
    { name: "confidence", type: "number", nullable: true, nullMeaning: "尚未評估 confidence", unit: null },
    { name: "gis_relevance", type: "number", nullable: true, nullMeaning: "尚未評估 GIS relevance", unit: null },
    { name: "severity", type: "number", nullable: true, nullMeaning: "尚未評估 severity", unit: null },
    { name: "is_event", type: "boolean", nullable: true, nullMeaning: "尚未判定是否為事件", unit: null },
    { name: "geometry", type: "json", nullable: true, nullMeaning: "消息未定位", unit: null },
    { name: "geometry_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "township cluster proxy or none", spatialAnalysisEligible: false },
  timeFields: [{ name: "published_at", role: "published", timezone: "UTC" }, { name: "occurred_at", role: "occurred", timezone: "UTC" }],
  coverage: "selected publication day and explicit relevance/event/severity filters", license: "unknown",
  versions: [],
  source: { publisher: "registered news feeds", reference: "supabase:public.get_news_events_day_clustered_v2", lineage: "source articles -> classified events -> township clusters -> raw events extracted without display defaults" },
  accessPolicy: { mode: "authenticated", maxRowsPerQuery: 50, maxScanRows: 10_000 }, supportedOperations: ["query_records", "aggregate"], adapterId: "news-event-rpc-v1",
};

const statisticsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "land-use:paddy-area-township", label: PADDY.label, description: "固定 release 與 dimensions 的鄉鎮水田面積行政統計；數值需與 status 一起解讀。",
  layerRefs: [PADDY.layer_key], kind: "admin_statistic", recordGrain: "admin_statistic", primaryKey: ["release_id", "area_code"],
  fields: [
    { name: "release_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "value", type: "number", nullable: true, nullMeaning: "由 status/source_token 區分 suppressed、not_reported 或 missing，不得轉為零", unit: PADDY.unit },
    { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "source_status", type: "string", nullable: true, nullMeaning: "來源未另提供狀態", unit: null },
    { name: "source_token", type: "string", nullable: true, nullMeaning: "observed 數值通常沒有原始缺值符號", unit: null },
    { name: "period_start", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "period_end", type: "datetime", nullable: false, nullMeaning: null, unit: null },
    { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "none", crs: null, role: "none", precision: "records require an explicit version-matched boundary join", spatialAnalysisEligible: false },
  timeFields: [{ name: "period_start", role: "period_start", timezone: "Asia/Taipei" }, { name: "period_end", role: "period_end", timezone: "Asia/Taipei" }],
  coverage: JSON.stringify(PADDY.release_options[0]?.coverage ?? { status: "unknown" }), license: String(PADDY.source.license ?? "unknown"),
  versions: PADDY.release_options.map(option => ({ versionId: option.release_id, observedAt: option.period_end, availableAt: null, checksumSha256: null, mutable: false })),
  source: { publisher: String(PADDY.source.publisher ?? "unknown"), reference: String(PADDY.source.source_landing_url ?? "unknown"), lineage: "immutable current pointer -> hashed manifest -> exact release artifact; geometry is not returned by query_records" },
  accessPolicy: { mode: "public", maxRowsPerQuery: 50, maxScanRows: 1000 }, supportedOperations: ["query_records", "aggregate"], adapterId: "regional-statistics-v1",
};

function receipt(sourceId: string, version: string, reference: string, checksumSha256: string | null = null): SourceReceipt {
  return { sourceId, version, acquiredAt: new Date().toISOString(), checksumSha256, reference };
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

async function contentHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function requireDate(value: Scalar | undefined): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  return value;
}

const schoolsAdapter = createPointDatasetAdapter(schoolsDescriptor, async () => {
  const snapshot = await loadPointDataset({ datasetId: schoolsDescriptor.datasetId, url: schoolsDescriptor.source.reference, idField: "code", safeFields: schoolsDescriptor.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) });
  return {
    rows: snapshot.rows, source: receipt("tw-schools", snapshot.checksumSha256, schoolsDescriptor.source.reference, snapshot.checksumSha256),
    coverage: schoolsDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length + Object.values(snapshot.exclusions).reduce((sum, value) => sum + value, 0), bytesScanned: snapshot.bytes, downloadedBytes: snapshot.cacheHit ? 0 : snapshot.bytes, requests: snapshot.cacheHit ? 0 : 1, cacheHit: snapshot.cacheHit,
  };
});

const medicalHospitalsAdapter = createPointDatasetAdapter(medicalHospitalsDescriptor, async () => {
  const snapshot = await loadPointDataset({ datasetId: medicalHospitalsDescriptor.datasetId, url: medicalHospitalsDescriptor.source.reference, idField: "facility_id", safeFields: medicalHospitalsDescriptor.fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) });
  return {
    rows: snapshot.rows, source: receipt("tw-medical-hospitals", snapshot.checksumSha256, medicalHospitalsDescriptor.source.reference, snapshot.checksumSha256),
    coverage: medicalHospitalsDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length + Object.values(snapshot.exclusions).reduce((sum, value) => sum + value, 0), bytesScanned: snapshot.bytes, downloadedBytes: snapshot.cacheHit ? 0 : snapshot.bytes, requests: snapshot.cacheHit ? 0 : 1, cacheHit: snapshot.cacheHit,
  };
});

const newsAdapter = createNewsEventAdapter(newsDescriptor, async parameters => {
  const date = requireDate(parameters.date);
  const minRelevance = parameters.minRelevance;
  const eventsOnly = parameters.eventsOnly;
  const minSeverity = parameters.minSeverity;
  if (![0, 2, 3].includes(minRelevance as number) || typeof eventsOnly !== "boolean" || ![0, 1, 2].includes(minSeverity as number)) throw new Error("INVALID_NEWS_FILTER");
  const clusters = await fetchNewsEventsDayClustersStrict(date, { minRelevance: minRelevance as 0 | 2 | 3, eventsOnly, minSeverity: minSeverity as 0 | 1 | 2 });
  const rows = new Map<number, Record<string, unknown>>();
  let omittedFromMap = 0;
  let rowsScanned = 0;
  for (const cluster of clusters) {
    const validGeometry = typeof cluster.lon === "number" && Number.isFinite(cluster.lon) && typeof cluster.lat === "number" && Number.isFinite(cluster.lat);
    for (const event of cluster.events ?? []) {
      rowsScanned++;
      if (rows.has(event.id)) continue;
      if (!validGeometry) omittedFromMap++;
      rows.set(event.id, {
        event_id: event.id, title: event.title, summary: event.summary, category: event.category, source: event.source, url: event.url,
        published_at: new Date(event.published_ts * 1000).toISOString(), occurred_at: null,
        confidence: event.confidence, gis_relevance: event.gis_relevance, severity: event.severity, is_event: event.is_event,
        geometry: validGeometry ? { type: "Point", coordinates: [cluster.lon, cluster.lat] } : null,
        geometry_precision: validGeometry ? "township_cluster_proxy" : "none",
      });
    }
  }
  const normalizedRows = [...rows.values()];
  const snapshotHash = await contentHash(normalizedRows);
  return {
    rows: normalizedRows, source: receipt("tw-news-events-rpc", `${date}:${snapshotHash}`, newsDescriptor.source.reference, snapshotHash),
    coverage: newsDescriptor.coverage, freshness: "unknown", exclusions: { omitted_from_map_no_geometry: omittedFromMap }, rowsScanned,
  };
});

const statisticsAdapter = createAdminStatisticsAdapter(statisticsDescriptor, async parameters => {
  const release = PADDY.release_options.find(option => option.release_id === parameters.releaseId);
  if (!release) throw new Error("RELEASE_NOT_ALLOWED");
  const result = await loadRegionalStatisticsValues({ datasetId: PADDY.dataset_id, indicatorId: PADDY.indicator_id, level: PADDY.level, dimensions: release.dimensions, releaseId: release.release_id, layerKey: PADDY.layer_key, includeHealth: true, allowReleaseFallback: false });
  return {
    rows: result.values.observations.map(row => ({ ...row, release_id: result.values.release.release_id, period_start: result.values.release.period_start, period_end: result.values.release.period_end, boundary_version: result.values.release.boundary_version })),
    source: receipt("regional-statistics", release.release_id, statisticsDescriptor.source.reference, typeof result.sources.raw_sha256 === "string" ? result.sources.raw_sha256 : null),
    coverage: JSON.stringify(result.health?.coverage ?? release.coverage), freshness: release.health === "STALE" ? "stale" : "unknown", rowsScanned: result.values.total,
  };
});

export const RESEARCH_QUERY_EXECUTOR = new QueryExecutor([schoolsAdapter, medicalHospitalsAdapter, newsAdapter, statisticsAdapter]);

function normalize(value: string): string { return value.normalize("NFKC").toLocaleLowerCase().replace(/臺/g, "台").trim(); }

export function searchDatasets(query: string, offset = 0, limit = 20) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("INVALID_INPUT");
  const needle = normalize(query);
  const matched = RESEARCH_QUERY_EXECUTOR.descriptors().filter(descriptor => normalize(`${descriptor.datasetId} ${descriptor.label} ${descriptor.description} ${descriptor.kind}`).includes(needle));
  const datasets = matched.slice(offset, offset + limit);
  return { query, offset, limit, totalMatched: matched.length, returned: datasets.length, truncated: offset + datasets.length < matched.length, datasets };
}

export function describeDataset(datasetId: string): DatasetDescriptor {
  const descriptor = RESEARCH_QUERY_EXECUTOR.describe(datasetId);
  if (!descriptor) throw new Error("DATASET_NOT_FOUND");
  return descriptor;
}

export async function queryRecords(input: QueryRecordsInput): Promise<Record<string, unknown>> {
  return await RESEARCH_QUERY_EXECUTOR.execute(input) as unknown as Record<string, unknown>;
}

export async function queryRecordsDetailed(input: QueryRecordsInput): Promise<QueryExecution> {
  return await RESEARCH_QUERY_EXECUTOR.executeDetailed(input);
}
