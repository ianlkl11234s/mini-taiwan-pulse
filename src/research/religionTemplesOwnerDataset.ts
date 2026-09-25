import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "ee6c5549b35bc76dbf4ac22ee0ce5dd6a4684b5269af416cf43cfc6736f2207e";
const MANIFEST_SHA256 = "c6eece8825ee30e241762dea9db2a662860e97f5e6201e98ed1791bf210451ac";
const SOURCE_REFERENCE = `/research/religion-temples/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/religion-temples/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "entity_id", type: "string", nullable: false, nullMeaning: null, unit: "snapshot_entity_identifier" },
  { name: "deity_family", type: "string", nullable: true, nullMeaning: "來源未分類或未提供；不以名稱重推。", unit: "source_normalized_category" },
  { name: "religion_type", type: "string", nullable: true, nullMeaning: "來源未提供教別；不是無宗教或零場所。", unit: "source_category" },
  { name: "registration_type", type: "string", nullable: true, nullMeaning: "來源未提供登記別；不推論目前登記狀態。", unit: "source_registration_category" },
  { name: "in_moi_registry", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "heritage_flag", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "is_top100", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: true, nullMeaning: "合併來源未在安全 sidecar 補寫。", unit: "source_code" },
  { name: "coord_source", type: "string", nullable: true, nullMeaning: "來源未提供座標來源；不以 geometry 推定。", unit: "coordinate_provenance" },
  { name: "geocode_precision", type: "string", nullable: true, nullMeaning: "來源未標示 geocode 精度；不表示 original。", unit: "source_precision_category" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const religionTemplesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-religion-temples-owner-20260801", label: "宗教寺廟合併快照（2026-08-01 owner-only）",
  description: "19,201 個混合來源寺廟實體固定快照。每次 bbox 必填，僅讀 immutable gzip 分片；安全 sidecar 不含名稱、地址、電話、負責人、MOI 編號、來源網址、巢狀 provenance 或原始座標欄。",
  layerRefs: ["religionTemples"], kind: "point", recordGrain: "place", primaryKey: ["entity_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "Point 混合 MOI 原始座標、文資、百景、OSM、offline/TGOS/Google 回填；geocode_precision 與 coord_source 只保留上游標記。它是 bbox 參考位置，不代表入口、屋頂、地籍、邊界、最近點、距離、道路可達性或服務範圍。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "2026-08-01 固定合併快照共 19,201 Point：MOI 系 12,499、OSM-only 新實體 6,702；heritage_flag 259、is_top100 49。MOI XML 507 筆原無有效座標，其中 503 回填；最終仍有 2 筆未入 Point artifact。bbox 無結果不代表當地沒有寺廟、未立案場所或宗教服務。",
  license: "RIGHTS_HOLD：MOI、文化資產與宗教百景標示 OGDL-Taiwan-1.0；OSM ODbL attribution/derivative conditions 與 Google geocode 補點再散布權利尚未逐筆釐清。本 reader 僅 localhost owner-only，不建立公開散布主張。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "2 筆未解決原座標缺失未入 GeoJSON；另 bbox 無結果也可能是 OSM 標註、登記或合併覆蓋缺口，不能當作零。", null: "nullable 分類欄位照來源保留；null 不等於零、否定或可由名稱推導。", stale: "2026-08-01 快照不是目前寺廟登記、存續、開放、祭典、服務或 OSM 完整性。" },
  versions: [{ versionId: `20260801-processed-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-21", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "內政部宗教及禮制司、文化部文化資產局、內政部宗教百景、OpenStreetMap contributors", reference: SOURCE_REFERENCE, lineage: "MOI temple XML + BOCH heritage temple subset + Top 100 match-only + OSM place_of_worship integration -> 19,201 Point processed GeoJSON SHA ee6c…2207e -> safe-field source-SHA-bound local gzip partitions. OSM contribution requires attribution; Google-geocode redistribution status remains HOLD." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "religion-temples-owner-reference-partitions-v1",
};
function fail(code: string): never { throw new Error(code); }
async function readReligionTemples(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: religionTemplesOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "entity_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("RELIGION_TEMPLES_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: religionTemplesOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: religionTemplesOwnerDescriptor.coverage, freshness: "stale", exclusions: { unresolved_source_coordinate: 2, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const religionTemplesOwnerAdapter = createReferencePointDatasetAdapter(religionTemplesOwnerDescriptor, readReligionTemples);
