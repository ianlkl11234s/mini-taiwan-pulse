import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "a9b2e18ec60e2444bc263bb0bf1c9ee804b66a7a62064a38affb6a7890f6de99";
const MANIFEST_SHA256 = "b1fc01a0908d8b18169b5cd774da4d1f3824d7f7c81671f09615108f3c1b99e3";
const REFERENCE = `/research/street-trees-national/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST = "/__local-research-owner-only/street-trees-national/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "tree_id", type: "string", nullable: false, nullMeaning: null, unit: "source_tree_identifier" },
  { name: "species", type: "string", nullable: false, nullMeaning: "來源空字串保留，未轉成未知或零。", unit: null }, { name: "dbh_cm", type: "number", nullable: false, nullMeaning: null, unit: "cm" }, { name: "height_m", type: "number", nullable: false, nullMeaning: null, unit: "m" },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "district", type: "string", nullable: false, nullMeaning: "來源空字串保留。", unit: null }, { name: "location_type", type: "string", nullable: false, nullMeaning: "來源空字串保留；臺中公園廣場不等於路旁行道樹。", unit: null },
  { name: "survey_date", type: "string", nullable: false, nullMeaning: "來源空字串保留；不可補為查詢時間。", unit: "source_date_string" }, { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
export const streetTreesNationalOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-street-trees-taipei-taichung-owner-20260714", label: "臺北與臺中樹籍點（2026-07 owner-only）", description: "210,436 個固定來源樹籍參考點；每次 bbox 必填，只讀 SHA-bound gzip 分片。", layerRefs: ["streetTreesNational"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "資料來源樹籍的參考 Point；不是樹冠、入口、最近樹、距離、可達性或服務範圍。", spatialAnalysisEligible: false }, timeFields: [],
  coverage: "僅臺北 92,033（2026-07-12 快照）與臺中 118,403（2016-2019 調查、2020 製圖）；非全國、非同時點。臺中含 61,321 公園廣場，不能全部稱為路旁行道樹。", license: "兩上游 catalog 記載 OGDL-Taiwan-1.0；固定本機 owner-only sidecar。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "此資料只含兩市；bbox 無結果不能推論沒有樹。來源空字串保留，未轉為零。", stale: "臺北是 2026-07-12 快照；臺中為 2016-2019 調查／2020 製圖，均不表示現況或可比較的同時點。" },
  versions: [{ versionId: `20260714-processed-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-14", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "臺北市政府／臺中市政府開放資料", reference: REFERENCE, lineage: "Taipei 2026-07-12 raw JSON SHA 80c8…494e + Taichung processed static GeoJSON SHA 7743…4ca3 -> 2026-07-14 merged 210,436 Point SHA a9b2…de99 -> safe-field partitions; address and raw lon/lat omitted." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["species", "city", "district", "location_type", "survey_date", "source"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: "street-trees-national-owner-reference-partitions-v1",
};
async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) throw new Error("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: streetTreesNationalOwnerDescriptor.datasetId, url: REFERENCE, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => name !== "record_id" && name !== "geometry"), spatialPartition: { manifestUrl: MANIFEST, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("STREET_TREES_NATIONAL_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: streetTreesNationalOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, checksumSha256: SOURCE_SHA256, reference: REFERENCE, acquiredAt: snapshot.acquiredAt };
  return { rows: snapshot.rows, source, coverage: streetTreesNationalOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const streetTreesNationalOwnerAdapter = createReferencePointDatasetAdapter(streetTreesNationalOwnerDescriptor, read);
