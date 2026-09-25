import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b";
const MANIFEST_SHA256 = "f6ab0198f72617a33f923cc3228e237d2ebdf17b7934d8b40e281f061e4bfbba";
// Digest identity only. This path is never fetched: bbox reads use MANIFEST_URL.
const SOURCE_REFERENCE = "/research/company-points/source-identity/sha256-d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b";
const MANIFEST_URL = "/__local-research-point-partitions/company-points/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "company_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "capital_total", type: "number", nullable: true, nullMeaning: "202608 snapshot did not provide a capital amount; capital_q=0 represents this missing value and is not the lowest quantile.", unit: "TWD" },
  { name: "capital_q", type: "number", nullable: false, nullMeaning: null, unit: "quantile_category" },
  { name: "is_manufacturing", type: "number", nullable: false, nullMeaning: null, unit: "flag_0_or_1" },
  { name: "categories", type: "string", nullable: false, nullMeaning: null, unit: "semicolon_exact_tokens" },
  { name: "industry_mid", type: "string", nullable: false, nullMeaning: null, unit: "two_digit_code" },
  { name: "setup_year", type: "number", nullable: true, nullMeaning: "Source setup_date is missing; this is not an unknown spatial record.", unit: "year" },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "addr_mismatch", type: "number", nullable: false, nullMeaning: null, unit: "1_true_0_false_negative_1_unknown" },
  { name: "is_listed", type: "number", nullable: false, nullMeaning: null, unit: "flag_0_or_1" },
  { name: "has_trademark", type: "number", nullable: false, nullMeaning: null, unit: "flag_0_or_1" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const companyPointsDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-company-registration-points-202608", label: "公司登記點位（202608 快照）",
  description: "654,165 筆公司營業地址地理編碼 Point 的固定 202608 快照。結果只回傳安全欄位；不含統編、地址或負責人。座標可做直線 bbox／附近分析，但不是工廠、入口或道路可達性。118 原始來源家族的逐 dataset 授權收據尚未在此 worktree 重驗；只供 owner 本機查詢，不得公開發布。",
  layerRefs: ["companyPoints"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "營業地址（財政資訊中心）經 offline/TGOS 地理編碼為 WGS84 Point；既有 202608 母表有 2,586 筆無座標，已發布座標包含 cached、exact 與 interpolated 精度，並非工廠、入口或道路可達性。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "202608 的 118 個「區域×大類」company_stock 原始資料家族：657,882 列；母表有 2,586 筆無座標，發布 mask 先排 dead_or_abnormal 1,152 筆，再排其餘無效座標 2,565 筆，得到 654,165 個營業地址 Point。金門／馬祖約 1,868 家不在 118 家族範圍。每次必須提供 bbox，載入固定 SHA 的 0.1 度分片並在點座標上精確過濾；沒有 bbox 不讀取 214 MB 原始 NDJSON。",
  license: "RIGHTS_HOLD: analytics catalog documents OGDL-Taiwan-1.0 for the 118 data.gov.tw source matrix, but this P3 slice has not revalidated each raw dataset license receipt; dataset 166152 alone covers only the six-city manufacturing subset.", valueSemantics: DEFAULT_VALUE_SEMANTICS,
  versions: [{ versionId: "202608-geojsonseq-sha256:d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b", observedAt: null, availableAt: null, checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部商業發展署 GCIS（118 個區域×大類 data.gov.tw source matrix；營業地址由財政資訊中心匯入）", reference: SOURCE_REFERENCE, lineage: "118 raw source matrix (dataset IDs in analytics company_stock/config.yaml) -> company_stock 202608 SHA c3a191b2…e900c -> dead_or_abnormal exclusion -> invalid-coordinate exclusion -> public 11-field GeoJSON sequence SHA d099…5272b -> source-SHA-bound WGS84 business-address geocode shards. The client only fetches selected immutable shards; no tax ID, address, or responsible person is materialized." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "company-point-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }

/** Bbox is mandatory so an accidental query cannot request the 214 MB intermediate source. */
async function readCompanyPoints(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({
    datasetId: companyPointsDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "record_id",
    safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)),
    spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 },
  }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("COMPANY_POINT_SOURCE_SHA_MISMATCH");
  const source: SourceReceipt = { sourceId: companyPointsDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return {
    rows: snapshot.rows, source, coverage: companyPointsDescriptor.coverage, freshness: "unknown",
    exclusions: { dead_or_abnormal: 1_152, invalid_coordinate_after_status_exclusion: 2_565, ...snapshot.exclusions },
    rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit,
  };
}

export const companyPointsAdapter = createPointDatasetAdapter(companyPointsDescriptor, readCompanyPoints);
