import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/arts-events/arts-events-owner-20260716.geojson";
const SOURCE_SHA256 = "58519dc08d834f9b7b8a8463ddb826dd4456d6346853b105a5eb13dd5e1b5836";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "uid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "title", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "category", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "start_date", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "end_date", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "show_time", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "show_end_time", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "location_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "coord_status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: true, nullMeaning: "1,361 個場次沒有有效位置；不是零座標，也不是該地沒有藝文活動", unit: null },
];

export const artsEventsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-arts-events-owner-20260716", label: "藝文活動場次（2026-07-16 本機快照）",
  description: "文化部 doFindTypeJ 滾動窗的 7,482 個場次，6,121 有 Point、1,361 無座標。這是抓取當時尚未結束活動的快照，不是歷史全集或今日活動清單。",
  layerRefs: ["artsEvents"], kind: "point", recordGrain: "event", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "來源場次經緯度，沒有逐筆入口或測量精度收據；只作參考位置 bbox/屬性查詢。1,361 筆 geometry=null 保留於名冊但不進 bbox。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-07-16 抓取的未結束活動滾動窗。7,482 場次來自 2,836 個原始活動；同 uid 可有多場次，不能按 uid 去重後當場次數。來源處理檔只有 2,793 個 distinct uid；1,361 筆無座標不是地區零活動。category 為未對照的來源代碼。",
  license: "文化部 data.gov.tw 6478 原始活動資料標示 OGDL-Taiwan-1.0；本輪僅提供 owner-only 本機查詢，未核公開展示與既有圖層同版。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "geometry=null 代表 1,361 個場次缺有效座標，不能補為零或任意場館位置。", stale: "2026-07-16 滾動窗快照無法代表今日活動，也無法重建此日以前的完整歷史。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-16T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "文化部 cloud.culture.tw doFindTypeJ / data.gov.tw 6478", reference: SOURCE_URL, lineage: "raw arts_events_20260716.json SHA-256 7a9c2e98244c0f8e3350be575c686a16d3a49c1cfec1236e14e4ee7bc4dce2f9 (2,836 events) -> processed arts_events_moc_20260716.geojson SHA-256 75187ca4101ecd378c338f826b0c1c608a20b9f3d441486e4ce75b25ecb316a3 (7,482 showInfo records) -> owner-only safe-field sidecar。地址、銷售 URL、電話及完整描述未收錄。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 7482, maxSourceBytes: 4 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "arts-events-owner-reference-v1",
};

async function readArtsEvents(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: artsEventsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "uid", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), preserveUnlocatedRecords: true }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 7482 || snapshot.exclusions.missing_geometry !== 1361 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) throw new Error("ARTS_EVENTS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: artsEventsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: artsEventsOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const artsEventsOwnerAdapter = createReferencePointDatasetAdapter(artsEventsOwnerDescriptor, readArtsEvents);
