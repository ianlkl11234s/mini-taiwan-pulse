import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "a3a9ae3495c715e797ba04c09c73868b67503d22def8b4762c0aedcc02bcf097";
const SOURCE_REFERENCE = "/__local-research-owner-only/performing-venues/performing-venues-source-20260716.geojson";
const UPSTREAM_SHA256 = "546aee41200a5aa76eac3e6cf8f5faa3feba43f5fd2a02c34086a1ea67b403e2";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "venue_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "venue_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "coord_status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "event_count", type: "number", nullable: false, nullMeaning: null, unit: "distinct_events_in_rolling_source_window" },
  { name: "show_count", type: "number", nullable: false, nullMeaning: null, unit: "shows_in_rolling_source_window" },
  { name: "geometry", type: "json", nullable: true, nullMeaning: "來源本來沒有座標；不代表場館不存在、停業或不在來源範圍", unit: null },
];

export const performingVenuesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-performing-venues-20260716-owner-only", label: "表演場館來源快照（owner-only）",
  description: "文化部藝文活動 showInfo 反萃取的 861 筆表演場館快照。471 筆自行 geocode 含 Google 回補，逐筆座標再散布權利尚未重驗，因此此 reader 僅限 owner-only；場館粒度、活動名誤填與名稱變體均保留來源狀態。",
  layerRefs: ["performingVenues"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "386 筆 api_mode 來源活動座標與 471 筆 geocode（exact 270、approximate 124、interpolated 38、cached 39）混合；僅可依此參考位置做 bbox 篩選，不能主張最近場館、入口、場館邊界、道路可達性或服務範圍。4 筆 no_coord 保留 geometry=null。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "2026-07-16 固定快照共 861 筆：857 Point、4 筆 no_coord；api_mode 386、geocode 471。上游 arts_events_moc 是未結束活動的滾動窗，此為累積型場館名冊，不是全國表演場館全集；event_count/show_count 只計入當期來源窗，不能當歷史總量、人氣或目前營運。city 空字串 56 筆是來源未能萃取縣市，不是無縣市。",
  license: "RIGHTS_HOLD: 衍生文化部 datagov:6478 宣稱 OGDL-Taiwan-1.0；471 筆 geocode（含 Google 回補）未有逐筆座標再散布許可收據，故只限本機 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "geometry=null 與 coord_status=no_coord 表示此來源列未定位；不是零場館或停業。", zero: "event_count/show_count 的 0 僅在來源記錄明示時才有意義；本固定快照不以缺失補零。", stale: "此 2026-07-16 快照不是即時活動、開放或營運狀態。" },
  versions: [{ versionId: `20260716-safe-sidecar-sha256:${SOURCE_SHA256}`, observedAt: "2026-07-16T00:00:00+08:00", availableAt: null, checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "文化部藝文活動 doFindTypeJ（data.gov.tw/dataset/6478）", reference: SOURCE_REFERENCE, lineage: `6478 showInfo 滾動窗 -> venue name normalized aggregation -> api_mode/geocode coordinate enrichment -> upstream processed 861-row GeoJSON SHA ${UPSTREAM_SHA256} -> owner-only safe sidecar SHA ${SOURCE_SHA256}; full address, lon and lat properties are omitted, while geometry, coord_source, precision and coord_status remain for bounded local reference lookup.` },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 861, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "performing-venues-owner-only-reference-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readPerformingVenues(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: performingVenuesDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "venue_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), preserveUnlocatedRecords: true }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("PERFORMING_VENUES_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 861) fail("PERFORMING_VENUES_SOURCE_COUNT_MISMATCH");
  const source: SourceReceipt = { sourceId: performingVenuesDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: performingVenuesDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const performingVenuesAdapter = createReferencePointDatasetAdapter(performingVenuesDescriptor, readPerformingVenues);
