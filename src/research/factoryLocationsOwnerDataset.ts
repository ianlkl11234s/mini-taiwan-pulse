import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "efea0882b55273f0ae8eb3a965a206a4e01a07d8ca9f219e78af1954794e6acc";
const MANIFEST_SHA256 = "77e3399bd1368671837e32c99c304c36dc1985b88409eb46fcb73515e8fd69fd";
const SOURCE_REFERENCE = `/research/factory-locations/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/factory-locations/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "factory_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "factory_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "org_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "registered_date", type: "string", nullable: false, nullMeaning: null, unit: "ISO-8601_date" },
  { name: "industry_categories", type: "string", nullable: false, nullMeaning: null, unit: "source_industry_text" },
  { name: "main_products", type: "string", nullable: false, nullMeaning: null, unit: "source_product_text" },
  { name: "geocode_precision", type: "string", nullable: false, nullMeaning: null, unit: "offline_geocode_precision_category" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const factoryLocationsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-factory-locations-202606-owner-only", label: "登記生產中工廠位置（202606 owner-only）",
  description: "90,652 筆 202606 已定位「生產中」工廠的固定快照。每次必須給 bbox，僅讀取命中的 immutable gzip 分片；安全欄位不含統編、工廠地址或負責人。Point 是工廠地址獨立 offline geocode 的參考位置，不能作最近工廠、距離、入口、邊界或道路可達性判讀。",
  layerRefs: ["factoryLocations"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "工廠地址經獨立 offline geocode 的 WGS84 參考 Point；90,652 筆已定位，9,972 筆 geocode miss 不在 Point 側載。此 reader 未驗證與正式前端圖層同版，Point 不代表工廠入口、廠區邊界、地址屋頂、道路可達性或最近距離。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "data.gov.tw:6569 經濟部產業發展署 202606 清冊：raw 100,634，exact dedupe 後 100,633；其中生產中 100,624，9,972 筆 geocode miss，發布 90,652 個 Point（active geocode coverage 90.09%）。未定位或未納入生產中者不是地區零工廠，也不以公司登記座標補點。",
  license: "政府資料開放授權條款第1版（OGDL-Taiwan-1.0）；本 reader 僅由 localhost owner-only sidecar 供目前工作區使用，尚未驗證與正式前端圖層同版。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "本 Point 側缺列可能是 9,972 個 active geocode miss 或 bbox 外；不能推論該地沒有工廠。", stale: "202606 固定快照不代表目前工廠登記、實際營運、產能、員工數、污染或停工狀態。" },
  versions: [{ versionId: `202606-geojson-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-16T15:01:14Z", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部產業發展署（data.gov.tw:6569）", reference: SOURCE_REFERENCE, lineage: "official 202606 production-factory roster raw 100,634 -> exact dedupe 100,633 -> active 100,624 -> factory-address independent offline geocode -> 9,972 miss excluded -> processed 90,652-point GeoJSON SHA efea…6acc -> safe-field source-SHA-bound local gzip partitions. Sidecar omits uniform_no and factory_address; no responsible-person field is materialized." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "factory-locations-owner-reference-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readFactoryLocations(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: factoryLocationsOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "factory_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("FACTORY_LOCATION_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: factoryLocationsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: factoryLocationsOwnerDescriptor.coverage, freshness: "unknown", exclusions: { geocode_miss_active: 9_972, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const factoryLocationsOwnerAdapter = createReferencePointDatasetAdapter(factoryLocationsOwnerDescriptor, readFactoryLocations);
