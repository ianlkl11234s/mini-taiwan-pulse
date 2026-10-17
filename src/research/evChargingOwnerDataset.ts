import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/ev-charging/ev-charging-owner-20260615.geojson";
const SOURCE_SHA256 = "151204d74b32e0e1a1dfa2c095fe1e806b86cae7eff7718d92964a9208a8f87f";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "operator_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "spaces", type: "number", nullable: false, nullMeaning: null, unit: "parking spaces as supplied" },
  { name: "charging_points", type: "number", nullable: false, nullMeaning: null, unit: "charging points as supplied" },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "scope", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const evChargingOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-ev-charging-stations-owner-20260615", label: "電動車充電站參考點（owner-only 2026-06-15）",
  description: "TDX EV/Station 固定快照的 3,060 個去重 Point。可查本機 bbox、站名、來源範圍與原表提供的格位數；不表示現在可用、開放、故障、費率、服務時段或即時充電狀態。",
  layerRefs: ["evChargingStations"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "TDX 出版的 WGS84 點位，但本機尚無座標精度與再散布權利收據；只供 owner-only bbox／屬性／加總參考，不可宣稱最近站、直線距離、路網可達性、入口或停車場內精確位置。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "2026-06-15 TDX 固定快照：原始 3,099、normalized 3,088、依 station_id 與座標站名去重後 3,060 Point。來源分布為 city 2,947、rail 44、tourism 40、freeway service area 23、ship terminal 4、airport 2；連江縣 TDX H400 回 0 且未納入。",
  license: "TDX 條款、坐標精度與公開再散布收據尚未在本工作區核對；TDX_RIGHTS_HOLD，僅 localhost owner-only 固定快照使用。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 未命中只表示此 2026-06-15 固定 TDX 選集內無站，不代表當地沒有充電服務。", stale: "這是固定月度快照，不能代表今日設備、開放、費率、可用格位或營運狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-07T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "交通部 TDX EV/Station API", reference: SOURCE_URL, lineage: "analytics processed ev_charging_stations_20260615.geojson SHA-256 fa5ee9640717cc0cac3ed60f00b2a244c41afa2523b27d1d0ebe9fb3f826c218（3060 Point；manifest 3,099 TDX raw -> 3,088 normalized -> 3,060 dedup，data.gov/CPC final contribution 0）-> safe-field owner-only sidecar SHA-256 151204d74b32e0e1a1dfa2c095fe1e806b86cae7eff7718d92964a9208a8f87f；移除地址、電話、服務時段、停車／充電費率、接頭細節、樓層、描述與重複 lat/lon。" },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 3_060, maxSourceBytes: 1024 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "ev-charging-owner-reference-v1",
};

async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: evChargingOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "station_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 3_060 || Object.values(snapshot.exclusions).some(Boolean)) throw new Error("EV_CHARGING_OWNER_SOURCE_MISMATCH");
  const stationIds = new Set(snapshot.rows.map(row => row.station_id));
  const sources = snapshot.rows.reduce<Record<string, number>>((counts, row) => { const key = String(row.source); counts[key] = (counts[key] ?? 0) + 1; return counts; }, {});
  if (stationIds.size !== 3_060 || JSON.stringify(Object.fromEntries(Object.entries(sources).sort())) !== JSON.stringify({ tdx_aircaa: 2, tdx_city: 2947, tdx_freewaysa: 23, tdx_railtra: 44, tdx_shiptipc: 4, tdx_tourism: 40 })) throw new Error("EV_CHARGING_OWNER_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: evChargingOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: evChargingOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const evChargingOwnerAdapter = createReferencePointDatasetAdapter(evChargingOwnerDescriptor, read);
