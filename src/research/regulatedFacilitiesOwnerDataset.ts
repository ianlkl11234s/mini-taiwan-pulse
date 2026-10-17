import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "2cfa4bd59e050f7784d0dfcd1f571ca5d62c5cad78dd5073029363f31d45178f";
const MANIFEST_SHA256 = "82dda3a0e592e9a7ac087b9153ceaa2a7a61b651246e53f8564b289f460bd811";
const SOURCE_REFERENCE = `/research/regulated-facilities/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/regulated-facilities/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "township", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "industry_area_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "industry_group", type: "string", nullable: false, nullMeaning: null, unit: "EMS_industry_group_code" },
  { name: "industry_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "isair", type: "number", nullable: false, nullMeaning: null, unit: "EMS_regulation_flag_0_or_1" },
  { name: "iswater", type: "number", nullable: false, nullMeaning: null, unit: "EMS_regulation_flag_0_or_1" },
  { name: "iswaste", type: "number", nullable: false, nullMeaning: null, unit: "EMS_regulation_flag_0_or_1" },
  { name: "istoxic", type: "number", nullable: false, nullMeaning: null, unit: "EMS_regulation_flag_0_or_1" },
  { name: "issoil", type: "number", nullable: false, nullMeaning: null, unit: "EMS_regulation_flag_0_or_1" },
  { name: "coord_source", type: "string", nullable: false, nullMeaning: null, unit: "EMS_coordinate_method" },
  { name: "company_joined", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const regulatedFacilitiesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-regulated-facilities-20260818-owner-only", label: "環境部 active 列管設施（20260818 owner-only）",
  description: "80,732 個已定位 active EMS facility 固定快照。每次必須給 bbox，僅讀取命中的 immutable gzip 分片；sidecar 不含 EMS 編號、設施名稱、地址、統編與公司屬性。",
  layerRefs: ["regulatedFacilities"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "EMS WGS84 或 EMS TWD97 TM2 轉換的設施參考 Point；company join 不會改幾何。Point 不代表入口、地籍範圍、最近設施、道路可達性、目前營運、污染、排放、裁罰或環境風險。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "2026-08-18 固定快照：fresh raw 451,434 列；active facility 127,795；80,732 個 EMS 有效座標 Point（63.17%），47,063 個 active facility coordinate miss 不在 Point sidecar。50.01% 是 company join 覆蓋率，不能視為座標覆蓋率。bbox 無結果不代表沒有列管設施。",
  license: "政府資料開放授權條款第1版（OGDL-Taiwan-1.0）；此 source-SHA-bound reader 僅由 localhost owner-only sidecar 供目前工作區使用，未驗證為正式前端圖層或公開發行版本。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無 Point 可能是 47,063 個 active facility coordinate miss 或 bbox 外；不能推論該地沒有列管設施。", stale: "2026-08-18 固定快照不代表今日列管、營運、許可、排放、裁罰、污染或風險。" },
  versions: [{ versionId: `20260818-geojson-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-18T09:46:30Z", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "環境部環境資料開放平臺（EMS_S_01）", reference: SOURCE_REFERENCE, lineage: "EMS_S_01 raw 451,434 -> active facility 127,795 -> EMS WGS84 or TWD97 TM2 valid coordinate 80,732 -> processed GeoJSON SHA-256 2cfa…5178 -> safe-field source-SHA-bound local gzip partitions. Company exact join enriches attributes only and never changes geometry; 47,063 coordinate misses remain unlocated and are not replaced." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "regulated-facilities-owner-reference-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readRegulatedFacilities(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: regulatedFacilitiesOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("REGULATED_FACILITIES_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: regulatedFacilitiesOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: regulatedFacilitiesOwnerDescriptor.coverage, freshness: "unknown", exclusions: { active_facility_coordinate_miss: 47_063, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const regulatedFacilitiesOwnerAdapter = createReferencePointDatasetAdapter(regulatedFacilitiesOwnerDescriptor, readRegulatedFacilities);
