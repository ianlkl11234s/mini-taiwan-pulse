import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "0640e94d1f16d857e502946e67eae2c7c40636ab160b7f8c9f433600cd206507";
const MANIFEST_SHA256 = "3e934509ba2ef24a07162955f580c9cf7502677fdad0a10f3af8e6cce4f94f3f";
const SOURCE_REFERENCE = `/research/accident-taipei/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/accident-taipei/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "case_class", type: "string", nullable: false, nullMeaning: null, unit: "source_reported_A1_or_A2_processing_class" },
  { name: "facility_subtype", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_tier", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "fetched_at", type: "string", nullable: false, nullMeaning: null, unit: "ISO-8601_date" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
const fail = (code: string): never => { throw new Error(code); };

export const accidentTaipeiOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-accident-taipei-owner-20260626", label: "臺北市道路交通事故參考點（owner-only）",
  description: "2019-01-01 至 2019-12-31 的固定事故處理快照。每次查詢必須給 bbox，僅讀不可變分片；sidecar 不含精確發生時間、地點文字或上游 entity_id。",
  layerRefs: ["accidentTaipei"], kind: "point", recordGrain: "event", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "來源事故坐標為敏感事件參考 Point。不可用於最近事故、距離、道路可達性、路口安全、事故熱點、現時風險或保險／執法判斷。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "臺北市 data.gov.tw 136123 固定快照；22,918 個有 Point 的來源列，資料發生時間覆蓋 2019-01-01 至 2019-12-31。bbox 無結果不代表該處沒有事故或目前安全。",
  license: "OGDL-Taiwan-1.0；精確事故坐標具敏感性，僅限 localhost owner-only sidecar，未建立公開再散布或正式圖層契約。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無列可能是固定快照未涵蓋、座標未納入或事件未記錄；不得解釋為零事故或安全。", stale: "2019 固定快照與 2026-06-26 處理日均不代表目前事故、事故率、風險、道路狀況、執法或安全。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-06-26T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "臺北市政府資料開放平台 data.gov.tw/dataset/136123", reference: SOURCE_REFERENCE, lineage: "accident_taipei_dots_20260626.geojson SHA-256 0640e94d1f16d857e502946e67eae2c7c40636ab160b7f8c9f433600cd206507 (22,918 Point) -> safe-field owner-only gzip partitions; excludes entity_id, occurred_at and location." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["case_class", "facility_subtype", "source", "source_tier", "fetched_at"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "accident-taipei-owner-reference-partitions-v1",
};

async function readAccidentTaipei(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  const bbox = context?.bbox;
  if (!bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: accidentTaipeiOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("ACCIDENT_TAIPEI_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: accidentTaipeiOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: accidentTaipeiOwnerDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const accidentTaipeiOwnerAdapter = createReferencePointDatasetAdapter(accidentTaipeiOwnerDescriptor, readAccidentTaipei);
