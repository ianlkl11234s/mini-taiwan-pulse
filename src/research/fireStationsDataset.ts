import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/fire-stations/fire-stations-source-20260710.geojson";
const SOURCE_SHA256 = "43ae4221396ef536cfe964183e5fdd4f0b577078296a494d04ecdf76aa09e8c6";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "type", type: "string", nullable: true, nullMeaning: "來源未標示分隊類型；不代表非消防據點或無編制", unit: null },
  { name: "district", type: "string", nullable: true, nullMeaning: "來源未提供行政區；不代表據點不在任何行政區", unit: null },
  { name: "data_source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geocoding_source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geocoding_precision", type: "string", nullable: true, nullMeaning: "7 都官方座標來源沒有 Google precision 欄位；不是低精度或無座標。FAIL_BBOX 等非空值照來源保留，不可推論其座標可用性。", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const fireStationsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-fire-stations-20260710-owner-only", label: "消防分隊名冊（owner-only 2026-07-10 快照）",
  description: "22 縣市 717 筆消防分隊與分駐所的固定處理快照。304 筆為 6 個 data.gov.tw 來源的官方座標；413 筆為 Google 地理編碼參考位置（含屏東 39 筆原始公開名冊僅有地址）。Google 座標再散布權利未完成審核，因此本 reader 只供本機 owner-only 參考。",
  layerRefs: ["fireStations"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "混合 304 筆官方來源座標與 413 筆 Google geocode。15 縣市 Google precision 為 ROOFTOP 269、APPROXIMATE 81、FAIL_BBOX 10、RANGE_INTERPOLATED 8、GEOMETRIC_CENTER 6；屏東 39 筆無 precision 欄。整體僅可按參考位置做 bbox 篩選，不可主張最近消防分隊、直線距離、入口、服務範圍、道路可達性或救援抵達時間。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "2026-07-10 固定快照 717 筆，22 縣市皆有列。現有 fireStations display asset 是另一份 716 Point 產物：缺少嘉義市蘭潭分隊 I_008，另有 38 筆屏東 T_* 座標與此新版處理來源不一致；display 計數或座標不能當作此名冊母體或完整性證據。臺東來源名冊僅鄉鎮級且可能不完整。這不是即時編制、值勤、開放、消防量能、服務範圍或救援時間資料。",
  license: "原始公開名冊／7 都資料宣稱 OGDL-Taiwan-1.0；413 筆 Google geocode 參考座標的公開再散布權利未完成審核，故整份 safe sidecar 為 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "type、district、geocoding_precision 的 null 依欄位定義保留來源缺值；不得補零或推論據點、編制、精度與服務狀態。", stale: "固定 2026-07-10 快照不是現行值勤、開放、量能或救援服務狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-10T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "各縣市消防局及內政部消防署名冊（data.gov.tw 128008、123899、128700、67693、174692、43828、146697）", reference: SOURCE_URL, lineage: "7 都 processed stations_7cities.csv SHA 1bb6ab0f12038757509e25db13d9c5dce980a0af1d610acace4423a1cf1bc981（343 rows；官方 304、Google 39）+ 15 縣市 stations_15counties_geocoded.csv SHA bc8b82b594ba5bfae9dc59108d1f22858288c7e9ac0a97a7635659cf971e3416（374 Google rows，precision 原樣保留）-> owner-only safe-field sidecar SHA/count/unique-id/coordinate/provenance validation。sidecar 移除完整地址與電話。既有 display 的 716 Point 缺 I_008，且 38 筆屏東座標與此來源不同，不能取代完整來源名冊。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 717, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "fire-stations-owner-reference-point-v1",
};

function fail(code: string): never { throw new Error(code); }

async function readFireStationsOwner(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: fireStationsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "station_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("FIRE_STATIONS_OWNER_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 717 || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("FIRE_STATIONS_OWNER_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: fireStationsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: fireStationsOwnerDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const fireStationsOwnerAdapter = createReferencePointDatasetAdapter(fireStationsOwnerDescriptor, readFireStationsOwner);
