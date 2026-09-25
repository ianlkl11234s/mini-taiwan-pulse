import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { clearPointPartitionCache } from "./pointDatasetPartitions";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "41c3244b7eff050697fd746282d79b5c75c688960fa38c3c644b80e241819e13";
const MANIFEST_SHA256 = "ce3d6fb33205cfc47da8fb8f0de30e2d48c650054b52fd96a6712d0dffab8b0a";
const SOURCE_COUNT = 13_087;
const REFERENCE = `/research/livestock-farms/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/livestock-farms/manifest.json";
const MAX_SELECTED_ROWS = 5_000;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "animal_category", type: "string", nullable: false, nullMeaning: null, unit: "fixed_layer_category" },
  { name: "coordinate_source", type: "string", nullable: false, nullMeaning: null, unit: "source_coordinate_lineage" },
  { name: "coordinate_precision", type: "string", nullable: false, nullMeaning: null, unit: "source_precision_class" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
const families = [
  ["cattle", "livestockFarmCattle", "畜禽飼養場·牛", 574], ["chicken", "livestockFarmChicken", "畜禽飼養場·雞", 5176], ["duck", "livestockFarmDuck", "畜禽飼養場·鴨", 1305], ["goose", "livestockFarmGoose", "畜禽飼養場·鵝", 531], ["other", "livestockFarmOther", "畜禽飼養場·其他", 273], ["pig", "livestockFarmPig", "畜禽飼養場·豬", 4584], ["sheep", "livestockFarmSheep", "畜禽飼養場·羊", 644],
] as const;
type Family = typeof families[number];
function descriptor([category, layerRef, label, expectedRows]: Family): DatasetDescriptor { return {
  schemaVersion: "pulse-dataset/0.1", datasetId: `tw-livestock-farms-${category}-owner-20260705`, label: `${label}（2026-07-05 owner-only）`, description: `${expectedRows.toLocaleString()} 筆固定 enriched-v3 ${category} 分類；bbox 必填，僅讀取相交 immutable 分片。不是所有畜禽場母體或 current RPC。`, layerRefs: [layerRef], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "Mixed NLSC/twland/EMS/Google coordinates including 769 low-precision segment-centroid references. No nearest, distance, access, coverage, county comparison, or precise-farm claim.", spatialAnalysisEligible: false }, timeFields: [],
  coverage: `2026-07-05 fixed local enriched-v3: ${expectedRows.toLocaleString()} ${category} records selected from 13,087 Point records. ARIS batch coverage is partial; 769 source points are low precision. Empty bbox results do not establish no farm, no livestock, no farm density, or animal-head totals.`,
  license: "RIGHTS_HOLD: catalog says OGDL-Taiwan-1.0, but Google-derived 857 coordinates and EMS/NLSC/twland coordinate terms lack per-record public redistribution receipts. localhost owner-only only.",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "The ARIS batch is partial; absence in this category/bbox is not absence of farms or animals.", stale: "Fixed 2026-07-05 records do not establish current registration, operation, animal count, capacity, location, permit, disease status, access, or the current get_livestock_farms RPC state." },
  versions: [{ versionId: `20260705-source-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-07-05", checksumSha256: SOURCE_SHA256, mutable: false }], source: { publisher: "農業部 ARIS + NLSC + 環境部 EMS", reference: REFERENCE, lineage: `13,087-point enriched-v3 source SHA 41c3244b…9e13 -> category=${category} fixed ${expectedRows} records. Safe sidecar excludes name, certificate, cadastral parcel, address-like fields, detail and animal total.` },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: MAX_SELECTED_ROWS, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records"], adapterId: `livestock-farms-${category}-owner-partitions-v1`,
}; }
function adapter(family: Family) { const [category, , , expectedRows] = family, dataDescriptor = descriptor(family); async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> { if (!context?.bbox) throw new Error("BBOX_REQUIRED"); const snapshot = await loadPointDataset({ datasetId: dataDescriptor.datasetId, url: REFERENCE, idField: "animal_category", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal }); if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("LIVESTOCK_FARMS_OWNER_SOURCE_SEMANTICS_MISMATCH"); if (snapshot.rows.length > MAX_SELECTED_ROWS) throw new Error("DATASET_TOO_LARGE"); const rows = snapshot.rows.filter(row => row.animal_category === category); const source: SourceReceipt = { sourceId: dataDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, checksumSha256: SOURCE_SHA256, reference: REFERENCE, acquiredAt: snapshot.acquiredAt }; return { rows, source, coverage: dataDescriptor.coverage, freshness: "stale", exclusions: { source_records_outside_category: SOURCE_COUNT - expectedRows, source_google_coordinates_rights_hold: 857, source_low_precision: 769, aris_partial_coverage: 1, excluded_name_certificate_parcel_detail_total: SOURCE_COUNT, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit }; } return createReferencePointDatasetAdapter(dataDescriptor, read); }
export const livestockFarmsOwnerAdapters = families.map(adapter);
export const livestockFarmsOwnerDescriptors = livestockFarmsOwnerAdapters.map(adapter => adapter.descriptor);
export { clearPointPartitionCache };
