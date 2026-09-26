import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "adf0dddc81dc6ba30ff71c72242b4263b5a3896b7faffd40cead7ee24711af4e";
const MANIFEST_SHA256 = "0a419219ce202574d43048eb6cb5ca7acd802e4eac0aa399fc7c4c0b46bb53fa";
const SOURCE_REFERENCE = `/research/cram-schools/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/cram-schools/manifest.json";
const SOURCE_COUNT = 17_137;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: "source_normalized_county" },
  { name: "category", type: "string", nullable: false, nullMeaning: null, unit: "source_cram_school_category" },
  { name: "geocode_source", type: "string", nullable: false, nullMeaning: null, unit: "offline_geocoder_stage" },
  { name: "geocode_precision", type: "string", nullable: false, nullMeaning: null, unit: "exact_cached_tgos_or_interpolated" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const cramSchoolsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-cram-schools-owner-20260807", label: "全國短期補習班（owner-only 20260807 參考點）",
  description: "17,137 筆有地理編碼的固定名冊快照；bbox 必填，只讀取相交的 immutable gzip 分片。sidecar 僅保留縣市、類別與地理編碼來源／精度。",
  layerRefs: ["eduCramSchool"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "座標來自 offline、cache、TGOS 與同路段內插地理編碼，並非已驗證的原始機構座標；interpolated 77 筆為估計位置。僅供 bounded owner-only bbox／類別查詢，不能主張精確地點、最近補習班、距離、道路可達性、服務範圍、目前立案或營運。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-08-07 固定名冊：原始 17,772 筆，17,137 筆有 Point；635 筆未定位，沒有以行政區中心補點。定位精度：exact 10,100、cached 2,831、tgos 4,129、interpolated 77。bbox 無結果不代表沒有補習班、教育資源或服務。",
  license: "來源 catalog 記錄 data.gov.tw / 高雄市教育局系統為 OGDL-Taiwan-1.0；處理座標含 TGOS／cache／offline／interpolated 地理編碼，未有公開再散布的逐筆權利證據，限 localhost owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果可能是固定快照、635 筆未定位或查詢範圍造成，不能推論補習班或教育服務不存在。", stale: "每日更新來源的 2026-08-07 快照不代表今日立案、營業、招生、課程、容量、品質或可達性。" },
  versions: [{ versionId: `20260807-processed-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-07", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "高雄市教育局代管全國短期補習班系統", reference: SOURCE_REFERENCE, lineage: `bsb.kh.edu.tw city=2 raw SHA-256 dc74fd…3c73 (17,772 rows) -> analytics cram_schools_20260807.geojson SHA-256 ${SOURCE_SHA256} (${SOURCE_COUNT} Point) -> safe-field local gzip partitions；未收錄名稱、地址、email、機關代碼、日期或名冊全國總數欄位。` },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["county", "category", "geocode_source", "geocode_precision"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 10_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "cram-schools-owner-reference-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }
async function readCramSchools(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: cramSchoolsOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "category", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("CRAM_SCHOOL_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: cramSchoolsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: cramSchoolsOwnerDescriptor.coverage, freshness: "stale", exclusions: { raw_unlocated: 635, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const cramSchoolsOwnerAdapter = createReferencePointDatasetAdapter(cramSchoolsOwnerDescriptor, readCramSchools);
