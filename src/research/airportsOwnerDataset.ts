import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/airports/airports-owner-20260519.geojson";
const SOURCE_SHA256 = "44e9cec00cbf0ed86272409ac5a15bc24e63745936153bf47d69a9f9a18dd40f";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name_zh", type: "string", nullable: true, nullMeaning: "Merged source supplied an empty or absent Chinese name; it is not evidence that the airport has no Chinese name.", unit: null },
  { name: "icao", type: "string", nullable: true, nullMeaning: "Merged source supplied no ICAO code; it is not a claim that no code exists.", unit: null },
  { name: "iata", type: "string", nullable: true, nullMeaning: "Merged source supplied no IATA code; it is not a claim that no code exists.", unit: null },
  { name: "airport_type", type: "string", nullable: false, nullMeaning: null, unit: "ourairports_airport_type" },
  { name: "airport_type_zh", type: "string", nullable: false, nullMeaning: null, unit: "ourairports_airport_type_zh" },
  { name: "elevation_ft", type: "number", nullable: true, nullMeaning: "Merged source supplied no elevation; it is not sea level or zero feet.", unit: "ft" },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: "OurAirports_or_OurAirports_plus_TDX" },
  { name: "tdx_airport_id", type: "string", nullable: true, nullMeaning: "No TDX airport match was retained by the merge; it is not an absence or closure claim.", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const airportsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-airports-reference-owner-20260519", label: "機場參考點（owner-only 2026-05-19）",
  description: "OurAirports 與 TDX 合併的 125 筆固定 Point 快照。只保留名稱、代碼、類型、海拔、來源與 TDX 合併識別；bbox 與屬性查詢只定位這些參考 Point。",
  layerRefs: ["airports"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "來源 Point 是合併機場參考座標；未驗證為跑道、航廈、入口或機場邊界座標。只能作 bounded owner-only bbox／屬性查詢，不能主張最近機場、直線或道路距離、旅行時間、服務範圍、可達性、起降或目前營運。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "固定 2026-05-19 manifest 的 125 筆 Point：OurAirports 108、OurAirports+TDX 17；large 6、medium 15、small 36、heliport 56、closed 11、balloonport 1。bbox 無結果不代表沒有機場、跑道、航廈、航班或服務。closed 僅為此固定 OurAirports type，不能當作今日關閉狀態。",
  license: "analytics catalog 記錄 OurAirports 為 Public Domain、TDX 為 OGDL-Taiwan-1.0；原始下載 receipt、TDX 合併時間與現有 16 面機場展示檔的同版關係未驗證，因此只供 localhost owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 空結果只表示此固定 Point 快照的查詢結果，不能推論沒有機場、航班、服務或可達性。", stale: "固定合併快照不能表示今日機場存在、開放、起降、航班或營運狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-19", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "OurAirports 與交通部運輸資料流通服務平臺（TDX）", reference: SOURCE_URL, lineage: "analytics airports_merged_latest.geojson SHA-256 d82e9fff2cd6f7eb6417f22a2155cd9958815961731c1be073b4232f5629d6c2 (125 Point) -> safe-field owner-only sidecar SHA-256 " + SOURCE_SHA256 + ". Current airports display asset public/geo/airports.geojson is 16 Polygon/MultiPolygon SHA-256 3b68ec72035281856ece48f4e564a75c591e0275d3627fbbc7890485ab931524; its source/version relationship to this Point snapshot is unverified." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["name", "name_zh", "icao", "iata", "airport_type", "airport_type_zh", "source", "tdx_airport_id"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 125, maxSourceBytes: 128 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "airports-owner-reference-point-v1",
};

async function readAirports(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: airportsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "name", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 125 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("AIRPORTS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: airportsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: airportsOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const airportsOwnerAdapter = createReferencePointDatasetAdapter(airportsOwnerDescriptor, readAirports);
