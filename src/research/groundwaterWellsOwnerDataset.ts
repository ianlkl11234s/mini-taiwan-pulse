import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { clearPointPartitionCache } from "./pointDatasetPartitions";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2";
const MANIFEST_SHA256 = "2cd44a610c1c284d9de2fee054c95bb26a8eeba5bac3757af0754f6f3a0b3967";
const REFERENCE = `/research/groundwater-wells/source-identity/sha256-${SOURCE_SHA256}`;
const MANIFEST_URL = "/__local-research-owner-only/groundwater-wells/manifest.json";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "well_id", type: "string", nullable: false, nullMeaning: null, unit: "WRA_wellidentifier" },
  { name: "well_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "reported_county", type: "string", nullable: false, nullMeaning: null, unit: "source_reported_county_unverified_for_geography" },
  { name: "is_active", type: "boolean", nullable: false, nullMeaning: null, unit: "source_flag_all_false" },
  { name: "elevation_m", type: "number", nullable: true, nullMeaning: "All 959 source values are null; do not infer zero or filter on this field.", unit: "m" },
  { name: "well_depth_m", type: "number", nullable: true, nullMeaning: "Source metadata omits depth for one well.", unit: "m" },
  { name: "aquifer_type", type: "string", nullable: false, nullMeaning: null, unit: "source_layer_attribute" },
  { name: "groundwater_zone", type: "string", nullable: false, nullMeaning: null, unit: "source_groundwater_zone" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const groundwaterWellsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-groundwater-wells-owner-20260519", label: "地下水觀測井靜態站位（2026-05-19 owner-only）",
  description: "959 筆 WRA 固定靜態觀測井 metadata；bbox 必填，僅讀取相交 immutable 分片。此資料只對應 groundwaterWells，不能回答即時地下水位。",
  layerRefs: ["groundwaterWells"], kind: "point", recordGrain: "place", primaryKey: ["well_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "WRA processed station coordinates. Location precision, entrance/access, nearest distance, coverage, containment, and current operational status are not verified for spatial analysis.", spatialAnalysisEligible: false },
  timeFields: [], coverage: "Fixed WRA processed snapshot dated 2026-05-19: 959 Point station metadata records. No empty bbox result establishes no groundwater, no nearby well, no current monitoring, or water-level condition. It excludes live water-level readings and does not claim equivalence with the dynamic groundwater layer.",
  license: "OGDL-Taiwan-1.0. Source-SHA-bound safe-field partitions are localhost owner-only; public redistribution and a display release are not claimed.",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "An empty bbox only concerns this fixed static station snapshot.", null: "elevation_m is null for all 959 source records and well_depth_m is null for one; neither is zero.", stale: "The 2026-05-19 station snapshot does not establish current activity, water level, observation time, equipment state, access, or availability." },
  versions: [{ versionId: `20260519-processed-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-19", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部水利署 WRA OpenData", reference: REFERENCE, lineage: "WRA processed groundwater_wells.geojson SHA f15549…68db2 -> source-SHA-bound safe-field partitions; address and township excluded. reported_county is retained as unverified source provenance and cannot support geographic comparison." },
  access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: fields.map(field => field.name), filters: ["well_id"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 959, maxSourceBytes: 8 * 1024 * 1024 }),
  supportedOperations: ["query_records"], adapterId: "groundwater-wells-owner-partitions-v1",
};

async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) throw new Error("BBOX_REQUIRED");
  const snapshot = await loadPointDataset({ datasetId: groundwaterWellsOwnerDescriptor.datasetId, url: REFERENCE, idField: "well_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)), spatialPartition: { manifestUrl: MANIFEST_URL, manifestSha256: MANIFEST_SHA256, sourceSha256: SOURCE_SHA256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.some(row => row.elevation_m !== null || row.is_active !== false) || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("GROUNDWATER_WELLS_OWNER_SOURCE_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: groundwaterWellsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, checksumSha256: SOURCE_SHA256, reference: REFERENCE, acquiredAt: snapshot.acquiredAt };
  return { rows: snapshot.rows, source, coverage: groundwaterWellsOwnerDescriptor.coverage, freshness: "stale", exclusions: { source_elevation_m_null: 959, source_is_active_false: 959, reported_county_geography_unverified: 959, source_address_excluded: 959, source_township_excluded: 959, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const groundwaterWellsOwnerAdapter = createReferencePointDatasetAdapter(groundwaterWellsOwnerDescriptor, read);
export { clearPointPartitionCache };
