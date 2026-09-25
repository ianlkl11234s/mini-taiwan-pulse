import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "95dd7c6e1cabfac3662cd3ada3a5880bd2e122208fd55224c1aaecd6ccf7d3ce";
const MANIFEST_SHA256 = "4d0cb1c23c040bb7b2cae3f3601d9d64e1a2f94a7cc85d431b39d6bcac792288";
const SOURCE_REFERENCE = `/research/street-trees-taipei-diff/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/street-trees-diff/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "status", type: "string", nullable: false, nullMeaning: null, unit: "inventory_diff_status" },
  { name: "renumber_suspect", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "survey_date", type: "string", nullable: false, nullMeaning: null, unit: "source_survey_date" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const streetTreesDiffOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-taipei-street-trees-diff-20260712-owner-only", label: "台北行道樹清冊變化（20260712 owner-only）",
  description: "99,527 個 2024-11-21 Wayback 基準與 2026-07-12 現行清冊的固定差異 Point；bbox 必填，讀取命中的 immutable gzip 分片。sidecar 以 record_id surrogate 取代 TreeID，且不含樹種、行政區、路名、胸徑與樹高。",
  layerRefs: ["streetTreesTaipeiDiff"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "行道樹清冊 WGS84 參考 Point，僅作 bbox 與屬性查詢；不得宣稱精確最近樹、樹木入口、步行可達性、服務範圍或 coverage。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "固定快照 99,527 Point：persisted 88,004、disappeared 7,494、appeared 4,029；447 筆 renumber_suspect 仍保留於查詢母體，非排除數。2024 基準為 2024-11-21 Wayback 非官方版本化快照，現行端為 2026-07-12 TaipeiTree.json。bbox 無結果不代表沒有樹或沒有清冊紀錄。",
  license: "OGDL-Taiwan-1.0；此 source-SHA-bound reader 只由 localhost owner-only sidecar 供目前工作區使用，未驗證為公開發行或正式前端資料版本。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果可能在範圍外、清冊外或分片讀取範圍外，不能推論當地無樹。", stale: "固定差異快照不代表今日存活、砍除、新植、清冊同步或現場狀態；disappeared 僅指 TreeID 不在目前清冊。" },
  versions: [{ versionId: `20260712-geojson-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-12", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "臺北市政府工務局公園路燈工程管理處行道樹清冊", reference: SOURCE_REFERENCE, lineage: "TaipeiTree.json current snapshot 92,033 + 2024-11-21 Wayback baseline 95,498 -> TreeID three-status diff 99,527 -> processed GeoJSON SHA-256 95dd…d3ce -> safe-field source-SHA-bound local gzip partitions. TreeID becomes a generated record_id surrogate; free-text Region and all other identifying/detail fields are excluded." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["status", "renumber_suspect", "survey_date"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "street-trees-taipei-diff-owner-reference-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }
async function readStreetTreesDiff(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: streetTreesDiffOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("STREET_TREES_DIFF_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: streetTreesDiffOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: streetTreesDiffOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const streetTreesDiffOwnerAdapter = createReferencePointDatasetAdapter(streetTreesDiffOwnerDescriptor, readStreetTreesDiff);
