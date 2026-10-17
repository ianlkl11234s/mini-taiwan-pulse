import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import type { AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

const SOURCE_URL = "/tourism/activities_national.geojson";
const SOURCE_SHA256 = "0e51aea0298b1eb60c60990f2ff326efa30e0367925e2405271ba94e7de1ea3c";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "event_class", type: "string", nullable: false, nullMeaning: "來源 EventClasses 以逗號串接的未對照分類代碼", unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: "來源以空字串表示未提供縣市；本版 828 筆均非空", unit: null },
  { name: "address", type: "string", nullable: false, nullMeaning: "來源以縣市、鄉鎮與街道組接地址；不是入口或可達性資訊", unit: null },
  { name: "description", type: "string", nullable: false, nullMeaning: "來源描述經上游截短至 300 字；不是完整活動內容", unit: null },
  { name: "phone", type: "string", nullable: false, nullMeaning: "來源第一支電話；本版 828 筆均非空", unit: null },
  { name: "start_time", type: "datetime", nullable: false, nullMeaning: null, unit: null },
  { name: "end_time", type: "datetime", nullable: false, nullMeaning: null, unit: null },
  { name: "event_status", type: "string", nullable: false, nullMeaning: "來源 EventStatus；EventCancelled 必須保留，不能改為不存在或自動排除", unit: null },
  { name: "is_free", type: "number", nullable: false, nullMeaning: null, unit: "source_boolean_0_or_1" },
  { name: "organizer", type: "string", nullable: false, nullMeaning: "空字串表示來源未提供主辦單位；本版有 685 筆，不能解讀為沒有主辦", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const tourEventsFixedDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-tour-events-fixed-20260722", label: "觀光活動・節慶（2026-07-22 固定快照）",
  description: "觀光署 V2.1 Event 固定快照的 828 個來源 WGS84 Point。起訖時間與來源狀態保留，用於有界位置、分類與時間欄位查詢；這份快照已過期，不能描述為目前活動清單。",
  layerRefs: ["tourEvents"], kind: "point", recordGrain: "event", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "觀光署 V2.1 PositionLon/PositionLat 來源 WGS84 Point；可作 bbox 與直線參考距離，非活動入口、範圍、道路距離、步行或 transit 可達性。", spatialAnalysisEligible: true },
  timeFields: [
    { name: "start_time", role: "period_start", timezone: "Asia/Taipei" },
    { name: "end_time", role: "period_end", timezone: "Asia/Taipei" },
  ],
  coverage: "2026-07-22 固定快照：raw EventList 830 筆中 828 個位於上游台灣範圍的 Point。2 筆座標落在該範圍外而排除，不表示活動不存在。828 筆均有 start_time、end_time、event_status 和 Point；827 EventScheduled、1 EventCancelled。快照當時的時間分組（過期 495、進行中 143、未來 190）只屬 2026-07-22，不能推為今日狀態。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "本版發布欄位沒有 null；organizer 的 685 筆空字串是來源未提供，不能補值或推論沒有主辦。", zero: "is_free=0 是上游轉換後的來源值，不能當成缺值、免費與否的重新判定，或目前售票狀態。", stale: "2026-07-22 固定快照不是目前活動、取消、延期、開放、售票或可達性狀態；不可宣稱 current events。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-22T14:31:16+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "交通部觀光署（data.gov.tw 7778）", reference: SOURCE_URL, lineage: "觀光署 V2.1 Event-json_v2.1.zip SHA-256 99791d95f089757dec509aa2a029cededc0625480567e55bb6a206aa82ec2bf6 (830 Events, UpdateTime 2026-07-22T14:31:16+08:00) -> taipei-gis-analytics activity_20260722.geojson SHA-256 a30dab62f49891cc31caa9d1eeb01653f677c1e4b06cbcb88f8ecf5f0d028ac4 (828 Taiwan-scope Point) -> Mini activities_national.geojson SHA-256 0e51aea0298b1eb60c60990f2ff326efa30e0367925e2405271ba94e7de1ea3c; Mini is identical ordered features after dropping redundant processed lat/lon properties." },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), timeFields: ["start_time", "end_time"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 828, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "tour-events-fixed-point-v1",
};

async function readTourEvents(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: tourEventsFixedDescriptor.datasetId, url: SOURCE_URL, idField: "id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 828 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("TOUR_EVENTS_FIXED_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: tourEventsFixedDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: tourEventsFixedDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const tourEventsFixedPointAdapter: QueryAdapter = {
  descriptor: tourEventsFixedDescriptor,
  allowedParameters: {},
  async read(parameters, signal) {
    const snapshot = await readTourEvents(parameters, signal);
    return {
      rows: snapshot.rows,
      sourceRefs: [snapshot.source],
      coverage: snapshot.coverage,
      freshness: snapshot.freshness ?? "unknown",
      exclusions: snapshot.exclusions ?? {},
      rowsScanned: snapshot.rowsScanned ?? snapshot.rows.length,
      bytesScanned: snapshot.bytesScanned ?? null,
      downloadedBytes: snapshot.downloadedBytes ?? null,
      requests: snapshot.requests ?? null,
      cacheHit: snapshot.cacheHit ?? null,
      expiresAt: snapshot.expiresAt ?? null,
    };
  },
};
