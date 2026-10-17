import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "88951e69b0f6a146c88fdee8392940fce515e36b3cbaeff6a5ce8527dc47a26f";
const MANIFEST_SHA256 = "6f1cff79722edfc4ec9a3d6c84bd01e727ed53972e3e4a6d13654e2e25cf2d16";
const SOURCE_REFERENCE = `/research/waste-stops/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/waste-stops/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "vehicle_type", type: "string", nullable: false, nullMeaning: null, unit: "source_category" },
  { name: "via", type: "string", nullable: false, nullMeaning: null, unit: "coordinate_provenance" },
  { name: "routes_count", type: "number", nullable: false, nullMeaning: null, unit: "source_linked_route_count" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const wasteStopsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-waste-stops-static-owner-only", label: "垃圾清運停靠參考點（owner-only 固定快照）",
  description: "73,060 個垃圾清運相關參考 Point。每次查詢必須給 bbox，僅下載命中 immutable gzip 分片；sidecar 移除站名、路線名稱與路線識別，保留座標來源方法。",
  layerRefs: ["wasteStopsStatic"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "38,312 點是政府開放資料座標；30,938 點由 TGOS；1,135 點為 POI fallback；2,675 點是 legacy。來源混合且原始授權與精度收據未逐家核對，Point 只能作 bbox／屬性參考。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "固定靜態 artifact 共 73,060 Point：government_open_data 38,312、TGOS 30,938、POI fallback 1,135、legacy 2,675。73,059 筆 vehicle_type=garbage，1 筆 kitchen。這是停靠或資料參考位置，不能推論垃圾車即時位置、停靠時間、收運排程、當前服務、可用性、入口或道路可達性。",
  license: "RIGHTS_HOLD：來源混合政府開放資料、TGOS、POI fallback 與 legacy 座標；個別原始來源版本與座標再散布授權未逐項核對，僅供 localhost owner-only 查詢。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果不代表該地沒有垃圾清運服務、停靠點或收運路線。", stale: "固定 artifact 不代表目前垃圾車位置、路線、班表、服務日或停收狀態。" },
  versions: [{ versionId: `static-geojson-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: null, checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "混合縣市政府開放資料、TGOS 與 POI/legacy 處理來源", reference: SOURCE_REFERENCE, lineage: "public/geo/waste_stops_static.geojson SHA 88951e…a26f (73,060 Point) -> address and route-identifier-free owner-only, source-SHA-bound gzip spatial partitions. The sidecar excludes id, stop_name, route_id and route_name." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "waste-stops-owner-reference-partitions-v1",
};

function fail(code: string): never { throw new Error(code); }
async function readWasteStops(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) fail("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: wasteStopsOwnerDescriptor.datasetId, url: SOURCE_REFERENCE, idField: "record_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("WASTE_STOP_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: wasteStopsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_REFERENCE };
  return { rows: snapshot.rows, source, coverage: wasteStopsOwnerDescriptor.coverage, freshness: "unknown", exclusions: { government_open_data: 38_312, tgos: 30_938, poi_fallback: 1_135, legacy: 2_675, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const wasteStopsOwnerAdapter = createReferencePointDatasetAdapter(wasteStopsOwnerDescriptor, readWasteStops);
