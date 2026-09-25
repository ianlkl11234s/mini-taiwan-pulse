import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

type SourceFamily = { url: string; sidecarSha256: string; sourceRows: number; sourceSha256: string; sourceKind: "government" | "osm"; sourceReceiptId: string; sourceReference: string };
type Category = { datasetId: string; label: string; layerRef: string; facilityType: string; rows: number; family: SourceFamily };
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "record_ordinal", type: "number", nullable: false, nullMeaning: null, unit: "immutable-sidecar-row-ordinal" },
  { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "facility_name", type: "string", nullable: true, nullMeaning: "Source does not supply a facility name.", unit: null },
  { name: "facility_type", type: "string", nullable: false, nullMeaning: null, unit: "source_category" },
  { name: "operator", type: "string", nullable: true, nullMeaning: "Source does not supply an operator; an empty string is retained when the source explicitly has an empty operator.", unit: null },
  { name: "source_ref", type: "string", nullable: false, nullMeaning: null, unit: "source_reference" },
  { name: "ingested_at", type: "string", nullable: true, nullMeaning: "Processed artifact does not record ingestion time for this row.", unit: "datetime_text" },
  { name: "coordinate_method", type: "string", nullable: true, nullMeaning: "Processed artifact does not record coordinate method for this row; it does not establish native source geometry.", unit: "source_geocode_method" },
  { name: "status", type: "string", nullable: true, nullMeaning: "Government artifact has no OSM status field.", unit: "source_status" },
  { name: "source", type: "string", nullable: true, nullMeaning: "Government artifact has no OSM source field.", unit: "source_kind" },
  { name: "osm_type", type: "string", nullable: true, nullMeaning: "Government artifact has no OSM element type.", unit: "osm_element_type" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
const government: SourceFamily = { url: "/__local-research-owner-only/waste-facilities/waste-facilities-government-owner-20260519.geojson", sidecarSha256: "d15cba86ef1fc58c8a58553c24a22bf07327c96a481036c71d92a4ad83a7d3f9", sourceRows: 66, sourceSha256: "2d642d9986a4d0fc22012262a655b9b024804f2f0e4d9dac3f85394d7ad25ef2", sourceKind: "government", sourceReceiptId: "tw-waste-facilities-government-processed-20260519", sourceReference: "/research/waste-facilities/government-processed-20260519" };
const osm: SourceFamily = { url: "/__local-research-owner-only/waste-facilities/waste-facilities-osm-owner-20260519.geojson", sidecarSha256: "add89d5a1f0f1cdd1791c29e527726a6173ea3f77e887177cb006208e792edc3", sourceRows: 237, sourceSha256: "66bbb1f6a6fdde0a133c93905842665a5a1b55f776f7156b5f68a24b5c1a7e06", sourceKind: "osm", sourceReceiptId: "tw-waste-facilities-osm-processed-20260519", sourceReference: "/research/waste-facilities/osm-processed-20260519" };
const categories: readonly Category[] = [
  { datasetId: "tw-waste-facilities-incinerator-owner-20260519", label: "焚化爐參考點（owner-only）", layerRef: "wfIncinerator", facilityType: "incinerator", rows: 31, family: government },
  { datasetId: "tw-waste-facilities-landfill-owner-20260519", label: "衛生掩埋場參考點（owner-only）", layerRef: "wfLandfill", facilityType: "landfill", rows: 12, family: government },
  { datasetId: "tw-waste-facilities-monitoring-owner-20260519", label: "地下水監測井參考點（owner-only）", layerRef: "wfMonitoring", facilityType: "monitoring_well", rows: 17, family: government },
  { datasetId: "tw-waste-facilities-transfer-owner-20260519", label: "垃圾轉運站參考點（owner-only）", layerRef: "wfTransfer", facilityType: "transfer_station", rows: 38, family: osm },
  { datasetId: "tw-waste-facilities-recycling-owner-20260519", label: "資源回收廠參考點（owner-only）", layerRef: "wfRecycling", facilityType: "recycling_plant", rows: 184, family: osm },
  { datasetId: "tw-waste-facilities-scrap-yard-owner-20260519", label: "廢車／廢金屬場參考點（owner-only）", layerRef: "wfScrapYard", facilityType: "scrap_yard", rows: 15, family: osm },
];

function descriptor(category: Category): DatasetDescriptor {
  const { family } = category;
  return { schemaVersion: "pulse-dataset/0.1", datasetId: category.datasetId, label: category.label,
    description: `${category.rows} 筆 facility_type=${category.facilityType} 的 2026-05-19 fixed processed Point 本機安全欄位副本。這個快照不完整且不是目前營運或完整全國設施名冊。`,
    layerRefs: [category.layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: family.sourceKind === "government"
      ? "政府 processed Point 混有原始、NLSC 與 Google geocode；逐筆座標來源和可再散布權利未完整收據化，只可 bbox／屬性查詢。"
      : "OSM 快照 Point 是群眾編輯的設施參考位置；只能作 bbox／屬性查詢，不能當成入口、最近可用設施或可達性。", spatialAnalysisEligible: false },
    timeFields: [], coverage: family.sourceKind === "government"
      ? `${category.rows} 筆 facility_type=${category.facilityType}，從 66 筆政府來源 fixed processed artifact 篩選。catalog 記載後續 Supabase 曾有數百筆，故此快照不可宣稱完整、同步或現況。另有 6 筆 unknown 不對應 wfOther。`
      : `${category.rows} 筆 facility_type=${category.facilityType}，從 237 筆 OSM fixed processed artifact 篩選。這是 OSM 對照集合，非完整設施母體。`,
    license: family.sourceKind === "government"
      ? "RIGHTS_HOLD：原始政府來源標示 OGDL，但固定 Point 混有 NLSC／Google geocode，逐筆座標再散布權利及來源版本未完整核對；僅 localhost owner-only。"
      : "OSM ODbL 固定快照；來源涵蓋與更新狀態不完整，僅 localhost owner-only 查詢，仍不得宣稱全國完整或當前營運。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "bbox 或類別無結果不代表當地沒有設施、服務、監測井或廢棄物處理能力。", stale: "2026-05-19 fixed processed snapshot 不代表今日營運、許可、容量、接收條件、入口、服務範圍或可達性。" },
    versions: [{ versionId: `owner-sidecar-sha256:${family.sidecarSha256}`, observedAt: null, availableAt: "2026-05-19T00:00:00+08:00", checksumSha256: family.sidecarSha256, mutable: false }],
    source: { publisher: family.sourceKind === "government" ? "各縣市與環境部政府開放資料的固定 processed 副本" : "OpenStreetMap 固定 processed 對照副本", reference: family.url,
      lineage: `${family.sourceKind} processed GeoJSON SHA-256 ${family.sourceSha256} (${family.sourceRows} Point) -> safe-field owner-only sidecar SHA-256 ${family.sidecarSha256} -> facility_type=${category.facilityType} ${category.rows}-row reader; excludes address, phone, geocode_response_address, normalized_address, well_id, OSM id and duplicate raw longitude/latitude.` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["city", "facility_type", "status", "source", "osm_type"], supportsBbox: true, maxRowsPerQuery: category.rows, maxScanRows: family.sourceRows, maxSourceBytes: 512 * 1024 }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `waste-facilities-${category.facilityType}-owner-reference-v1` };
}
async function read(category: Category, dataset: DatasetDescriptor, _parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const { family } = category;
  const snapshot = await loadPointDataset({ datasetId: dataset.datasetId, url: family.url, idField: "record_ordinal", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== family.sidecarSha256 || snapshot.rows.length !== family.sourceRows || snapshot.exclusions.missing_geometry || snapshot.exclusions.invalid_geometry || snapshot.exclusions.non_point_geometry) throw new Error("WASTE_FACILITIES_OWNER_SIDECAR_MISMATCH");
  const rows = snapshot.rows.filter(row => row.facility_type === category.facilityType);
  if (rows.length !== category.rows || rows.some(row => row.facility_type !== category.facilityType)) throw new Error("WASTE_FACILITIES_CATEGORY_SELECTOR_MISMATCH");
  const source: SourceReceipt = { sourceId: dataset.datasetId, version: `sha256:${family.sidecarSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sidecarSha256, reference: family.url };
  const sourceRef: SourceReceipt = { sourceId: family.sourceReceiptId, version: `sha256:${family.sourceSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sourceSha256, reference: family.sourceReference };
  return { rows, source, sourceRefs: [sourceRef], coverage: dataset.coverage, freshness: "stale", exclusions: snapshot.exclusions, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
const byType = (facilityType: string): Category => {
  const category = categories.find(candidate => candidate.facilityType === facilityType);
  if (!category) throw new Error("WASTE_FACILITIES_CATEGORY_MISSING");
  return category;
};
function adapter(category: Category) {
  const dataset = descriptor(category);
  return { descriptor: dataset, adapter: createReferencePointDatasetAdapter(dataset, (parameters, signal) => read(category, dataset, parameters, signal)) };
}
const incinerator = adapter(byType("incinerator"));
const landfill = adapter(byType("landfill"));
const monitoring = adapter(byType("monitoring_well"));
const transfer = adapter(byType("transfer_station"));
const recycling = adapter(byType("recycling_plant"));
const scrapYard = adapter(byType("scrap_yard"));
export const wasteFacilitiesIncineratorOwnerDescriptor = incinerator.descriptor;
export const wasteFacilitiesIncineratorOwnerAdapter = incinerator.adapter;
export const wasteFacilitiesLandfillOwnerDescriptor = landfill.descriptor;
export const wasteFacilitiesLandfillOwnerAdapter = landfill.adapter;
export const wasteFacilitiesMonitoringOwnerDescriptor = monitoring.descriptor;
export const wasteFacilitiesMonitoringOwnerAdapter = monitoring.adapter;
export const wasteFacilitiesTransferOwnerDescriptor = transfer.descriptor;
export const wasteFacilitiesTransferOwnerAdapter = transfer.adapter;
export const wasteFacilitiesRecyclingOwnerDescriptor = recycling.descriptor;
export const wasteFacilitiesRecyclingOwnerAdapter = recycling.adapter;
export const wasteFacilitiesScrapYardOwnerDescriptor = scrapYard.descriptor;
export const wasteFacilitiesScrapYardOwnerAdapter = scrapYard.adapter;
