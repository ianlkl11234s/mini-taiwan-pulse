import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937";
const MANIFEST_SHA256 = "5d403a5d36a57d1ef6b78976d0ce5072136559641c72993eaceabce86f7cce2b";
// Digest identity only. The 305 MB GeoJSONSeq is never fetched by the browser.
const SOURCE_REFERENCE = "/research/pollution-penalties/source-identity/sha256-247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937";
const MANIFEST_URL = "/__local-research-point-partitions/pollution-penalties/manifest.json";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: true, nullMeaning: "來源未提供縣市；不是未知事件日期或零罰鍰", unit: null },
  { name: "event_medium", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "transgress_type", type: "string", nullable: true, nullMeaning: "來源未提供違規類型", unit: null },
  { name: "penalty_date", type: "string", nullable: false, nullMeaning: null, unit: "date" },
  { name: "penalty_year", type: "number", nullable: false, nullMeaning: null, unit: "year" },
  { name: "penalty_money", type: "number", nullable: false, nullMeaning: "來源的 0 元不等於缺值，須按原始裁處記錄解讀", unit: "TWD" },
  { name: "severity_event", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "is_continuous", type: "number", nullable: false, nullMeaning: null, unit: "flag_0_or_1" },
  { name: "geocode_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const pollutionPenaltyEventsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-pollution-penalty-events-20260706", label: "污染裁處事件（2010–2026 固定快照）",
  description: "環境部 EMS_P_46 的 414,904 筆歷史裁處事件。每次必須提供 bbox，僅下載命中的 immutable 0.1 度／密集處 0.025 度 sidecar shards；不讀取 305 MB 全量 GeoJSONSeq。address_osm 座標的再散布權利仍待 review，這些 sidecars 只供已授權本地工作區使用。",
  layerRefs: ["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile", "noiseEnforcementEvents"],
  kind: "point", recordGrain: "event", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "Point 是來源既有 facility_join、address_exact、address_osm 或 parcel 地理編碼的參考位置；僅用於依該參考位置作 bbox 篩選，不能宣稱實際違規發生在點位、不能代表設施入口或道路可達性。address_osm 108,276 筆座標的再散布權利仍待 review。", spatialAnalysisEligible: false },
  timeFields: [{ name: "penalty_date", role: "occurred", timezone: "Asia/Taipei" }],
  coverage: "2010-01-08 至 2026-06-23 的 414,904 個 EMS_P_46 地理編碼裁處事件固定快照。圖層切分：pollutionPenaltyCritical=severity_event critical（55,281）；pollutionPenaltyGeneral=high 或 normal（248,556）；pollutionPenaltyMobile=mobile（111,067）；noiseEnforcementEvents=event_medium noise（29,661），其與前三個嚴重度群組交叉，不能相加或當成互斥分類。address_osm 108,276 個座標的再散布權利仍待 review；本地查詢可處理，但不能據此宣稱公開發布許可。這是歷史裁處紀錄，不是今日執法、改善或污染狀態。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）",
  valueSemantics: DEFAULT_VALUE_SEMANTICS,
  versions: [{ versionId: `20260706-geojsonseq-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-07T12:51:39+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "環境部環境資料開放平臺 EMS_P_46", reference: SOURCE_REFERENCE, lineage: "MOENV EMS_P_46 -> staged pollution_penalties_geocoded_20260706.geojson SHA 16bc3f0b3d82aac54f48d026da0c3df4721bae8db71a41a615d295f2d1d78597 -> frontend pollution_penalties_events_20260706.geojsonseq SHA 247d6a759942f37b17b12f12558b9d2fce2e9a80e73503b1cc52c1c9b251c937 -> SHA-bound local public-field-only gzip shards. address_osm 108,276 coordinate redistribution rights remain under review. Sidecars exclude violation_fact, full address, document_no, ems_no, fac_name, source_row_no and event_id." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), timeFields: ["penalty_date"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "pollution-penalty-point-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }

/** Bbox is required so the immutable full snapshot is never accidentally materialized. */
async function readPollutionPenaltyEvents(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({
    datasetId: pollutionPenaltyEventsDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "record_id",
    safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)),
    spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 },
  }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("POLLUTION_PENALTY_SOURCE_SHA_MISMATCH");
  const source: SourceReceipt = { sourceId: pollutionPenaltyEventsDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: pollutionPenaltyEventsDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const pollutionPenaltyEventsAdapter = createReferencePointDatasetAdapter(pollutionPenaltyEventsDescriptor, readPollutionPenaltyEvents);
