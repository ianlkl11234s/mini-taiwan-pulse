import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "95891f3dfef06431bdb49b04e72503c1de865ffb5704da50179bad6564e25008";
const MANIFEST_SHA256 = "357a881d906ea0c8f734677117e1fc007d1bb4b98cccd1039fa73948f577cb89";
const REFERENCE = `/research/agri-produce-wholesale/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST = "/__local-research-owner-only/agri-produce-wholesale/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "business_type", type: "string", nullable: false, nullMeaning: null, unit: "source_business_category" },
  { name: "company_status", type: "string", nullable: false, nullMeaning: null, unit: "source_registration_status" },
  { name: "produced_at", type: "string", nullable: false, nullMeaning: "來源產製時間字串；不可當作目前營業狀態。", unit: "YYYYMMDDHHMMSS_source_string" },
  { name: "source_dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_slug", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const agriProduceWholesaleOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-agri-produce-wholesale-companies-owner-20260525", label: "農產品批發業公司（2026-05 owner-only）",
  description: "22,843 個已定位農產品批發業公司固定快照；每次 bbox 必填，只讀 SHA-bound gzip 分片。", layerRefs: ["agriProduceWholesale"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "公司登記地址經 TGOS geocode 的 WGS84 參考 Point；不是營業場所、入口、最近店家、距離、服務範圍或道路可達性。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "data.gov.tw:45655 2026-05 快照：raw 35,218；核准設立 23,046；203 地址無 TGOS 座標，發布 22,843 Point。bbox 無結果不可推論該地沒有批發業者。",
  license: "OGDL-Taiwan-1.0；TGOS 衍生座標再散布權未逐筆核對，僅 localhost owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "203 筆核准設立地址未定位且未入 Point sidecar；bbox 無結果不是零批發業者。", stale: "2026-05 公司登記快照不代表目前營業、地址、供貨、商品或服務。" },
  versions: [{ versionId: `20260525-processed-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-25", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部商業發展署 data.gov.tw:45655", reference: REFERENCE, lineage: "raw 35,218 CSV SHA 4aba…eebe2 -> approved 23,046 -> TGOS geocode 203 miss -> processed/Mini 22,843 Point SHA 9589…5008 -> safe-field partitions; uniform number, name, person, address, capital and raw lon/lat omitted." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["business_type", "company_status", "produced_at", "source_dataset_id", "source_slug"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "agri-produce-wholesale-owner-reference-partitions-v1",
};

async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) throw new Error("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: agriProduceWholesaleOwnerDescriptor.datasetId, url: REFERENCE, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => name !== "record_id" && name !== "geometry"), spatialPartition: { manifestUrl: MANIFEST, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("AGRI_PRODUCE_WHOLESALE_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: agriProduceWholesaleOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, checksumSha256: SOURCE_SHA256, reference: REFERENCE, acquiredAt: snapshot.acquiredAt };
  return { rows: snapshot.rows, source, coverage: agriProduceWholesaleOwnerDescriptor.coverage, freshness: "stale", exclusions: { approved_tgos_geocode_miss: 203, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const agriProduceWholesaleOwnerAdapter = createReferencePointDatasetAdapter(agriProduceWholesaleOwnerDescriptor, read);
