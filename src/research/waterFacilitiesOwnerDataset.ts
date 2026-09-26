import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/water-facilities/water-facilities-owner-20260519.geojson";
const SOURCE_SHA256 = "f00e4e3288cac3bd55d921699083a0cabf61000a2070932602f7147d06768ca3";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "facility_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name", type: "string", nullable: false, nullMeaning: "空字串是來源未提供名稱；不是無設施或可補的名稱。", unit: null },
  { name: "facility_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "operator", type: "string", nullable: true, nullMeaning: "OSM 的空字串或 WRA GIC 的 null 都是來源未提供營運單位；不是沒有營運者。", unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: "空字串是來源未提供縣市；不可改以座標或行政區邊界回填。", unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const waterFacilitiesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-water-facilities-reference-owner-20260519", label: "水利設施參考點（owner-only 2026-05-19）",
  description: "固定合併 526 筆 OpenStreetMap 設施與 83 筆水利署 GIC 官方抽水站。這是與目前 Mini 609 點展示檔逐筆核對的 owner-only 安全欄位 reader；不代表目前營運、水量、供水、抽排能力或開放狀態。",
  layerRefs: ["waterFacilities"], kind: "point", recordGrain: "place", primaryKey: ["facility_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "OSM node 是標記位置，OSM way 採中心點；WRA GIC 是原始 EPSG:3826 TM2 轉為 WGS84 的站點 Point。兩者都只能作 bbox 與屬性參考，不能主張最近設施、入口、直線距離、服務範圍、道路可達性或精確現場位置。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-05-19 固定處理快照共 609 Point：OSM 526（抽水站 234、淨水場 170、水塔 122），WRA GIC 官方抽水站 83。name 空字串 172、county 空字串 490、operator 空字串 458 與 null 83；空 bbox 結果不是沒有設施、服務或供水。",
  license: "OSM 部分為 ODbL 1.0，須保留 © OpenStreetMap contributors 與衍生資料義務；WRA GIC 原始 SHP 的公開再散布授權未在本地取得獨立收據。混合側錄僅 localhost owner-only，公開使用維持 RIGHTS_HOLD。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "來源未收錄或 bbox 無結果不是零設施、零供水或無防洪能力。", null: "OSM 以空字串、WRA GIC 以 null 保留來源的 sparse operator；不得互轉、補零或以座標補全。", stale: "2026-05-19 固定快照並非目前設施存在、營運、開放、供水、抽排、水量或服務狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-19T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "OpenStreetMap contributors 與經濟部水利署水利地理資訊中心", reference: SOURCE_URL, lineage: "analytics water_facilities_osm.geojson SHA-256 a37739bb35a422f99169ba8fb3361508c782e9824d8128046e49b75d4527b742 (526 OSM Point) + pump_stations_wra.geojson SHA-256 edb65b22c115c303a4a4597faaa55212a77f7a4e8aedb97faada98a4c68bd99a (83 WRA GIC Point from EPSG:3826) -> Mini display water_facilities.geojson SHA-256 e8174fcc90650280842c8f8b550cfd59b5ed95c63db40fb7db3a8382e034fa97 (609 Point semantic union by id/type/source/rounded geometry) -> safe-field owner-only sidecar SHA-256 " + SOURCE_SHA256 + "." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["facility_id", "name", "facility_type", "source", "operator", "county"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 609, maxSourceBytes: 256 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "water-facilities-owner-reference-point-v1",
};

async function readWaterFacilities(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: waterFacilitiesOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "facility_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 609 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("WATER_FACILITIES_OWNER_SOURCE_MISMATCH");
  const source: SourceReceipt = { sourceId: waterFacilitiesOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: waterFacilitiesOwnerDescriptor.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const waterFacilitiesOwnerAdapter = createReferencePointDatasetAdapter(waterFacilitiesOwnerDescriptor, readWaterFacilities);
