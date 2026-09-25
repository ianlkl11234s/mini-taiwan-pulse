import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_uid", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "station_name_en", type: "string", nullable: true, nullMeaning: "TDX snapshot did not provide an English station name.", unit: null },
  { name: "city", type: "string", nullable: true, nullMeaning: "TDX City field was blank; LocationCityCode remains the source administrative hint and this is not a missing station geometry.", unit: null },
  { name: "city_code", type: "string", nullable: true, nullMeaning: "TDX snapshot did not provide CityCode.", unit: null },
  { name: "location_city_code", type: "string", nullable: true, nullMeaning: "TDX snapshot did not provide LocationCityCode.", unit: null },
  { name: "stops", type: "number", nullable: false, nullMeaning: null, unit: "count_of_source_linked_stop_records" },
  { name: "bus_type", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
type Family = Readonly<{ id: string; label: string; layerRef: "busStationsCity" | "busStationsIntercity"; sourceSha256: string; manifestSha256: string; rows: number; snapshot: string; product: string }>;
const families: readonly Family[] = [
  { id: "tw-bus-stations-city-20260228-owner-only", label: "市區公車站位（owner-only 固定快照）", layerRef: "busStationsCity", sourceSha256: "a585bab7d2fc98cb63e48eff461c43e5f16cf35b1fae9acd7845a5d4d7e7ac8b", manifestSha256: "d936b193c72bb2456e85535aa7569893e448aef3265075f7f949e72b72ee7471", rows: 49_830, snapshot: "2025-11 至 2026-02-28 合併快照", product: "TDX /v2/Bus/Station/City/{City}；北北基 2025-11、其他城市 2026-02-13/28 的 StationUID 去重組合" },
  { id: "tw-bus-stations-intercity-20260228-owner-only", label: "公路客運站位（owner-only 2026-02-28 快照）", layerRef: "busStationsIntercity", sourceSha256: "9012db171215104773a758c0a8c3d9ddba72f2e979f2195647721510ca7d558f", manifestSha256: "471b7bc5a1cdab3d1d7f99d5917dfa9e216a10b9b0d9c8855fe1e7481d46c1dc", rows: 15_383, snapshot: "2026-02-28", product: "TDX /v2/Bus/Station/InterCity 固定快照" },
];
function fail(code: string): never { throw new Error(code); }
function descriptor(family: Family): DatasetDescriptor {
  const reference = `/research/bus-stations/${family.layerRef === "busStationsCity" ? "city" : "intercity"}/source-identity/sha256-${family.sourceSha256}`;
  return { schemaVersion: "pulse-dataset/0.1", datasetId: family.id, label: family.label, description: `${family.rows.toLocaleString()} 筆 TDX Station（站位）固定處理快照。每次必須給 bbox，讀取命中的 immutable gzip 分片；這是站位位置，不能當成路邊 Stop 站牌、即時車輛、到站時間、班次、停駛或服務頻率。`, layerRefs: [family.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: "TDX StationPosition 的 WGS84 站位位置；一個 Station 可對應多個 Stop，Point 不是路邊各方向站牌、上車入口、路線、車輛位置或道路可達性。", spatialAnalysisEligible: true }, timeFields: [], coverage: `${family.product}。固定 ${family.snapshot} 處理快照，共 ${family.rows.toLocaleString()} 個唯一 StationUID Point，無 null 或非 Point geometry。City 與 InterCity 為不同 TDX 端點與不同來源快照，不能直接相加為同一時間的全台站位數。`, license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；本 reader 僅由 localhost owner-only sidecar 供目前工作區使用。", valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, stale: `固定 ${family.snapshot} 快照不代表目前站位、路線、班次、到站、停駛或車輛狀態。` }, versions: [{ versionId: `sha256:${family.sourceSha256}`, observedAt: null, availableAt: null, checksumSha256: family.sourceSha256, mutable: false }], source: { publisher: "交通部運輸資料流通服務平臺（TDX）整合縣市交通局與公路局", reference, lineage: `${family.product} -> taipei-gis-analytics processed bus_stations_${family.layerRef === "busStationsCity" ? "city" : "intercity"}.geojson SHA ${family.sourceSha256} -> safe-field, source-SHA-bound local gzip spatial partitions. Sidecar omits StationAddress and duplicate lon/lat attributes.` }, access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: fields.filter(field => !["record_id", "geometry"].includes(field.name)).map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: `bus-stations-${family.layerRef}-partitions-v1` };
}
function adapter(family: Family): QueryAdapter {
  const dataDescriptor = descriptor(family); const slug = family.layerRef === "busStationsCity" ? "city" : "intercity";
  async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
    if (!context?.bbox) fail("BBOX_REQUIRED");
    const snapshot = await loadPointDataset({ datasetId: family.id, url: `/research/bus-stations/${slug}/source-identity/sha256-${family.sourceSha256}`, idField: "station_uid", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: `/__local-research-owner-only/bus-stations/${slug}/manifest.json`, manifestSha256: family.manifestSha256, sourceSha256: family.sourceSha256 } }, { bbox: context.bbox, signal });
    if (snapshot.checksumSha256 !== family.sourceSha256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) fail("BUS_STATION_SOURCE_SEMANTICS_MISMATCH");
    const source: SourceReceipt = { sourceId: family.id, version: `sha256:${family.sourceSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sourceSha256, reference: `/research/bus-stations/${slug}/source-identity/sha256-${family.sourceSha256}` };
    return { rows: snapshot.rows, source, coverage: dataDescriptor.coverage, freshness: "unknown", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  }
  return createPointDatasetAdapter(dataDescriptor, read);
}
export const busStationsCityOwnerAdapter = adapter(families[0]!);
export const busStationsIntercityOwnerAdapter = adapter(families[1]!);
export const busStationsOwnerDescriptors = families.map(descriptor);
