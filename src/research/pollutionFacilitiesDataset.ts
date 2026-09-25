import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9";
const MANIFEST_SHA256 = "1c97e6d93c03fdddead91963f5a6a688ebd2368ec2029688d0e23b19ddf94a88";
const SOURCE_REFERENCE = "/research/pollution-facilities/source-identity/sha256-7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9";
const MANIFEST_URL = "/research/pollution-facilities/manifest.json";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "emsno", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "industry_group", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "industry_macro", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "mediums", type: "string", nullable: false, nullMeaning: null, unit: "comma_separated_exact_tokens" },
  { name: "max_sev", type: "number", nullable: false, nullMeaning: null, unit: "severity_0_to_3" },
  { name: "sev_air", type: "number", nullable: true, nullMeaning: "該設施沒有 air 介質旗標；不是嚴重度零。", unit: "severity_0_to_3" },
  { name: "sev_water", type: "number", nullable: true, nullMeaning: "該設施沒有 water 介質旗標；不是嚴重度零。", unit: "severity_0_to_3" },
  { name: "sev_waste", type: "number", nullable: true, nullMeaning: "該設施沒有 waste 介質旗標；不是嚴重度零。", unit: "severity_0_to_3" },
  { name: "sev_toxic", type: "number", nullable: true, nullMeaning: "該設施沒有 toxic 介質旗標；不是嚴重度零。", unit: "severity_0_to_3" },
  { name: "sev_soil", type: "number", nullable: true, nullMeaning: "該設施沒有 soil 介質旗標；不是嚴重度零。", unit: "severity_0_to_3" },
  { name: "source_kind", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const pollutionFacilitiesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-pollution-facilities-20260706", label: "污染潛勢設施（20260706 快照）",
  description: "152,246 筆環境部 EMS_S_01 列管設施的固定 20260706 快照。列管設施是污染潛勢，不等於已確認污染或今日仍違規；各介質的 null 表示沒有該介質旗標，與 severity 0 分開。",
  layerRefs: ["pollutionFacility"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "來源 EMS regulated-facility WGS84 參考 Point；原始來源與 frontend contract 均未提供逐筆 geocode precision。僅能依參考位置做 bbox 篩選，不能保證精確最近距離；Point 不是設施邊界、入口、排放量測或道路可達性。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-07-06 固定 EMS_S_01 列管設施快照 152,246 點。2026-07-05 staged 前身有 143,743 點，全部可對照本快照；另有 8,503 個 frontend-only emsno，故 staged 不是本查詢的完整母體。缺席不證明未列管、已停業或無污染。",
  license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；來源為環境部環境資料開放平臺 EMS_S_01。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "sev_* = null 表示來源沒有該介質旗標；不是 severity=0，也不是未觀測的排放量。", zero: "max_sev 或適用的 sev_* = 0 是快照分類中的潛勢列管，並不表示零污染或零排放。", stale: "此固定 2026-07-06 快照不是即時列管或裁處狀態。" },
  versions: [{ versionId: "20260706-geojsonseq-sha256:7aa3c25b9907bf2e557116af8a60fcce3c1e7ecac20ea6898b81e7309f4985f9", observedAt: null, availableAt: "2026-07-07T12:51:39+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "環境部環境資料開放平臺", reference: SOURCE_REFERENCE, lineage: "MOENV EMS_S_01 -> staged pollution_potential_20260705.geojson SHA 0121…684a (143,743) -> frontend pollution_facilities_20260706.geojsonseq SHA 7aa3…85f9 (152,246) -> immutable public-field-only WGS84 partitions. The client reads only bbox-selected shards and never materializes facility_address or industry_name." },
  access: boundedAccess({ mode: "public", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "pollution-facility-point-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }

/** A bbox is mandatory because the immutable source is 49 MB and never fetched by this reader. */
async function readPollutionFacilities(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({
    datasetId: pollutionFacilitiesDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "emsno",
    safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)),
    spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 },
  }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("POLLUTION_FACILITY_SOURCE_SHA_MISMATCH");
  const source: SourceReceipt = { sourceId: pollutionFacilitiesDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return {
    rows: snapshot.rows, source, coverage: pollutionFacilitiesDescriptor.coverage, freshness: "unknown",
    exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit,
  };
}

export const pollutionFacilitiesAdapter = createReferencePointDatasetAdapter(pollutionFacilitiesDescriptor, readPollutionFacilities);
