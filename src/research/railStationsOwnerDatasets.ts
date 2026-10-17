import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/rail-stations/rail-stations-owner-20260529.geojson";
const SOURCE_SHA256 = "6192eb7b1f5e570a298f438f5bec09a316d39e321cde688805c587fd777b0bf8";
const sourceCounts = { thsr: 12, tra: 244, trtc: 139, krtc: 39, klrt: 38, tymc: 22, tmrt: 18, dlrt: 14, aklrt: 9 } as const;
const metroSystems = ["trtc", "krtc", "klrt", "tymc", "tmrt", "dlrt", "aklrt"] as const;

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "system_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county_id", type: "string", nullable: true, nullMeaning: "2026-05-29 處理層未能由縣市界配對；不代表車站不在縣市內", unit: null },
  { name: "county_name", type: "string", nullable: true, nullMeaning: "2026-05-29 處理層未能由縣市界配對；不代表車站不在縣市內", unit: null },
  { name: "station_class", type: "string", nullable: true, nullMeaning: "來源只為部分 TRA／THSR 站提供站等；不是非車站、停用或不存在", unit: null },
  { name: "color", type: "string", nullable: true, nullMeaning: "來源未給系統代表色；不是系統未知", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

function descriptor(datasetId: string, label: string, layerRefs: readonly string[], systemIds: readonly string[], count: number): DatasetDescriptor {
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId, label,
    description: "由 rail_stations_20260529 535 筆固定處理產物切出的本機車站點位。它保留 Point 幾何與系統分類，但不含台鐵地址與英文名。",
    layerRefs, kind: "point", recordGrain: "place", primaryKey: ["system_id", "station_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "來源處理層明示 WGS84 Point。此 reader 可做車站點位 bbox、屬性篩選與聚合；不能從固定站位推論列車即時營運、班次、進出站量、站內入口、轉乘步行或道路可達性。", spatialAnalysisEligible: true },
    timeFields: [],
    coverage: `2026-05-29 固定處理快照：${count} 筆 ${systemIds.join("/")} 車站。全來源共 535 筆（THSR 12、TRA 244、7 個捷運／輕軌系統 279）。上游 catalog 與 manifest 仍登記 2026-05-27 的 503 筆版本；本快照比它多 32 個 TRA 站，且 TRA:7120 一筆內容不同。現行 Pulse display 的 station_points.geojson SHA a705b1…802 也不是此 535 筆快照，不能用於本 reader 的完整性或同版地圖宣稱。`,
    license: "2026-05-27 catalog 對舊 503 筆處理版宣稱 OGDL-Taiwan-1.0、來源為 TDX／各營運單位，但 2026-05-29 535 筆檔未納入 manifest，也沒有逐來源下載收據。因此本 reader 僅供 owner-only 本機使用；公開再散布與正式版次接線 HOLD。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "county_id、county_name、station_class、color 的 null 依上游欄位缺值保留，不能補零或推論站體、營運、行政區與站等狀態。", stale: "固定 2026-05-29 快照不表示現時營運、施工、停駛、無障礙、班次或服務狀態。" },
    versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-29T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
    source: { publisher: "taipei-gis-analytics rail_stations 處理產物；其 2026-05-27 catalog 記錄為 mini-taiwan-pulse 既有資產彙整自 TDX／各軌道營運單位", reference: SOURCE_URL, lineage: "taipei-gis-analytics/data/processed/transportation/rail_stations/rail_stations_20260529.geojson SHA 2e334441261600b2b5541982705f9cdf11182f94df5a507f45572441b8a33637（535 Point；原檔地址不帶入）-> safe-field owner-only sidecar SHA/count/system/unique-key/coordinate validation。503 正式 manifest 未更新到這個檔案。" },
    // All three readers verify and scan one immutable 535-row sidecar before slicing their system.
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 535, maxSourceBytes: 1024 * 1024 }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `${datasetId}-v1`,
  };
}

export const railStationsTHSROwnerDescriptor = descriptor("tw-rail-stations-thsr-owner-20260529", "高鐵站點（owner-only 2026-05-29 快照）", ["stationsTHSR"], ["thsr"], sourceCounts.thsr);
export const railStationsTRAOwnerDescriptor = descriptor("tw-rail-stations-tra-owner-20260529", "台鐵站點（owner-only 2026-05-29 快照）", ["stationsTRA"], ["tra"], sourceCounts.tra);
export const railStationsMetroOwnerDescriptor = descriptor("tw-rail-stations-metro-owner-20260529", "捷運與輕軌站點（owner-only 2026-05-29 快照）", ["stationsMetro"], metroSystems, 279);

function fail(code: string): never { throw new Error(code); }

async function readSystems(systemIds: readonly string[], expectedCount: number, _parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: "tw-rail-stations-owner-20260529-source", url: SOURCE_URL, idField: "station_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256) fail("RAIL_STATIONS_OWNER_SOURCE_SHA_MISMATCH");
  if (snapshot.rows.length !== 535 || snapshot.exclusions.missing_geometry !== 0 || snapshot.exclusions.non_point_geometry !== 0 || snapshot.exclusions.invalid_geometry !== 0) fail("RAIL_STATIONS_OWNER_SOURCE_SEMANTICS_MISMATCH");
  const rows = snapshot.rows.filter(row => typeof row.system_id === "string" && systemIds.includes(row.system_id));
  if (rows.length !== expectedCount || new Set(rows.map(row => `${row.system_id}:${row.station_id}`)).size !== expectedCount) fail("RAIL_STATIONS_OWNER_SUBSET_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: "tw-rail-stations-owner-20260529-source", version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows, source, coverage: `owner-only 2026-05-29 ${systemIds.join("/")} fixed station snapshot`, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const railStationsTHSROwnerAdapter = createPointDatasetAdapter(railStationsTHSROwnerDescriptor, (parameters, signal) => readSystems(["thsr"], sourceCounts.thsr, parameters, signal));
export const railStationsTRAOwnerAdapter = createPointDatasetAdapter(railStationsTRAOwnerDescriptor, (parameters, signal) => readSystems(["tra"], sourceCounts.tra, parameters, signal));
export const railStationsMetroOwnerAdapter = createPointDatasetAdapter(railStationsMetroOwnerDescriptor, (parameters, signal) => readSystems(metroSystems, 279, parameters, signal));
