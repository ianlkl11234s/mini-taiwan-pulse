import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/common-registration-addresses/common-registration-addresses-owner-202608-r2.geojson";
const SOURCE_SHA256 = "bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1";
const SOURCE_ROWS = 11_121;

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "address", type: "string", nullable: false, nullMeaning: null, unit: "normalized_registration_address" },
  { name: "n_companies", type: "number", nullable: false, nullMeaning: null, unit: "companies" },
  { name: "capital_sum", type: "number", nullable: false, nullMeaning: null, unit: "TWD" },
  { name: "capital_median", type: "number", nullable: false, nullMeaning: null, unit: "TWD" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const commonRegistrationAddressesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1",
  datasetId: "tw-common-registration-addresses-202608-r2-owner-only",
  label: "共同登記地址（202608 r2 owner-only）",
  description: "202608 公司登記存量衍生的 11,121 個共同登記地址。每筆表示同一正規化門牌至少 5 家公司的聚合，並非公司名冊、借址、空殼、違法或風險判定。",
  layerRefs: ["commonRegistrationAddresses"],
  kind: "point",
  recordGrain: "place",
  primaryKey: ["address"],
  fields,
  geometry: {
    type: "Point",
    crs: "EPSG:4326",
    role: "proxy",
    precision: "每個共同門牌群組取成員有效座標眾數；平手依 longitude、latitude 升冪決定。可作 bbox 與屬性查詢，不能主張地址入口、最近點、直線距離、道路可達性或公司實際營運地。",
    spatialAnalysisEligible: false,
  },
  timeFields: [],
  coverage: "202608 固定快照：company_stock 657,882 列，排除 dead_or_abnormal 1,152 列與無效／超出台灣範圍座標 2,565 列後，654,165 列可聚合；發布 11,121 個至少 5 家公司的正規化門牌，合計 198,606 公司 membership。缺結果不代表當地沒有公司、登記、建物或營運活動。",
  license: "OGDL-Taiwan-1.0；本 reader 使用上游 r2 發布白名單四欄的本機不可變副本，僅供 owner-only 研究查詢。",
  valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    missing: "bbox 無結果不代表該地沒有公司、共同登記門牌或營運活動；此資料只含至少 5 家公司的門牌群組。",
    stale: "固定 202608 快照不代表目前公司登記、營運、資本額或地址狀態。",
  },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-18T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: {
    publisher: "經濟部商業發展署 GCIS（公司登記存量衍生聚合）",
    reference: SOURCE_URL,
    lineage: "company_stock_202608.csv SHA-256 c3a191b234e718dc7b5ca4a9b5c599c279b1fefc9e2d1d606e5722c3eb4e900c（657,882 rows）→ 排除 stale_verdict=dead_or_abnormal 1,152 與無效座標 2,565 → normalize_building_address_key 聚合 → ≥5 公司門牌 11,121 Point r2 GeoJSON SHA-256 bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1 → 等位元本機 owner-only sidecar。發布 properties 僅 address、n_companies、capital_sum、capital_median。",
  },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["address", "n_companies", "capital_sum", "capital_median"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: SOURCE_ROWS, maxSourceBytes: 4 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"],
  adapterId: "common-registration-addresses-owner-reference-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readCommonRegistrationAddresses(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({
    datasetId: commonRegistrationAddressesDescriptor.datasetId,
    url: SOURCE_URL,
    idField: "address",
    safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)),
  }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("COMMON_REGISTRATION_ADDRESSES_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== SOURCE_ROWS || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("COMMON_REGISTRATION_ADDRESSES_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = {
    sourceId: commonRegistrationAddressesDescriptor.datasetId,
    version: `sha256:${SOURCE_SHA256}`,
    acquiredAt: snapshot.acquiredAt,
    checksumSha256: SOURCE_SHA256,
    reference: SOURCE_URL,
  };
  return {
    rows: snapshot.rows,
    source,
    coverage: commonRegistrationAddressesDescriptor.coverage,
    freshness: "stale",
    exclusions: snapshot.exclusions,
    rowsScanned: snapshot.rows.length,
    bytesScanned: snapshot.bytes,
    downloadedBytes: snapshot.downloadedBytes,
    requests: snapshot.requests,
    cacheHit: snapshot.cacheHit,
  };
}

export const commonRegistrationAddressesAdapter = createReferencePointDatasetAdapter(commonRegistrationAddressesDescriptor, readCommonRegistrationAddresses);
