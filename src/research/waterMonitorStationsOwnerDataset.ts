import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/water-monitor-stations/water-monitor-stations-owner-20260519.geojson";
const SOURCE_SHA256 = "73a653674aeddeffd0f3ad697930ff65351fea861ce545f895547a4896a341b3";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: "來源未提供名稱時以 station_id 取代；不是目前站名驗證。", unit: null },
  { name: "station_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "reported_county", type: "string", nullable: false, nullMeaning: "WRA 原始縣市欄位可能與點落縣市不同，禁止作縣市篩選或統計。", unit: null },
  { name: "township", type: "string", nullable: true, nullMeaning: "來源的 null 或空字串表示未提供鄉鎮；不是可由座標補齊的行政區。", unit: null },
  { name: "elevation_m", type: "number", nullable: true, nullMeaning: "來源未提供高程；不是零公尺。", unit: "m" },
  { name: "is_active", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "county_spatial_check", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const waterMonitorStationsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-water-monitor-stations-owner-20260519", label: "水利監測站參考點（owner-only 2026-05-19）",
  description: "WRA 雨量站、河川水位站與地下水觀測井的 2026-05-19 固定名冊，共 2,032 Point。保留來源的 is_active 與站型，但不是即時雨量、水位、水質、地下水位或現在站況。",
  layerRefs: ["waterMonitorStations"], kind: "point", recordGrain: "place", primaryKey: ["station_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "三個 WRA 固定名冊的 EPSG:3826 座標轉為 WGS84。可作 bounded bbox 與屬性查詢；此 owner-only reader 不主張最近站、直線距離、服務範圍、站址入口、道路可達性或目前可量測性。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-05-19 固定快照 2,032 Point：雨量站 242（is_active=true）、河川水位站 831（active 370、已廢 461）、地下水觀測井 959（is_active=false 959）。county-reference-2025 檢核：match 1,647、mismatch 360、unknown 15、outside 10；reported_county 不能作縣市統計。",
  license: "WRA catalog 聲稱 OGDL-Taiwan-1.0，但三個 immutable raw API payload、下載時間與授權收據未在本機保存；僅限 localhost owner-only。公開再散布、最新資料與縣市比較皆 HOLD。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 無結果不是沒有監測、沒有雨量、水位、地下水位或服務。", null: "elevation_m=null 是來源未提供高程；reported_county/township 的空字串照來源保留，不能回填。", stale: "2026-05-19 固定名冊與 is_active 都不是目前站況、即時讀值、資料傳輸、量測品質或服務可用性。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-19T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部水利署", reference: SOURCE_URL, lineage: "WRA rain_gauge_stations SHA-256 5a4203f5914c1d325b5f5ccd89f2b953be279b88a40d50a397d3d3a4063eb34b (242) + river_level_stations_wra SHA-256 9698f7dbb4ef3d4b4831de5f23765c6f17d9102c0f25d334a644d9cdd1ac48bb (831) + groundwater_wells SHA-256 f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2 (959) -> Mini display SHA-256 4f6ab8edb69b68e17ea15be500b117581869d1af71a0196b4ee72870326a2baf semantic 2,032-point union -> fixed county-reference-2025 SHA-256 3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c QA -> safe-field owner-only sidecar SHA-256 " + SOURCE_SHA256 + "." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["station_id", "name", "station_type", "source", "township", "elevation_m", "is_active", "county_spatial_check"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 2032, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records"], adapterId: "water-monitor-stations-owner-reference-v1",
};

async function readWaterMonitorStations(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: waterMonitorStationsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "station_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 2032 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("WATER_MONITOR_STATIONS_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: waterMonitorStationsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: waterMonitorStationsOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const waterMonitorStationsOwnerAdapter = createReferencePointDatasetAdapter(waterMonitorStationsOwnerDescriptor, readWaterMonitorStations);
