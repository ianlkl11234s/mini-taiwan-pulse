import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_SHA256 = "61dc48810045e75de5d1097eb1fca541f20e526949284809131dea2cbae59455";
const SIDECAR_SHA256 = "2c2048f757e53df2ba2d0eacfe8e3645ad44c5806cddd7c596617c9e0e42074b";
const URL = "/__local-research-owner-only/wra-water-systems/wra-dam-weirs-owner-20260519.geojson";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_dam_id", type: "string", nullable: false, nullMeaning: "Source ID repeats `wra:0` for 25 records; record_id is the immutable sidecar ordinal identity.", unit: "WRA_SHP_ID" },
  { name: "name_en", type: "string", nullable: true, nullMeaning: "Source did not supply an English name; Chinese name is excluded because its SWRESOIR decoding is corrupted.", unit: null },
  { name: "dam_elev_m", type: "number", nullable: true, nullMeaning: "Source did not report dam elevation; this is not sea level or zero.", unit: "m" },
  { name: "dam_height_m", type: "number", nullable: true, nullMeaning: "Source did not report dam height; this is not zero height.", unit: "m" },
  { name: "dam_length_m", type: "number", nullable: true, nullMeaning: "Source did not report dam length; this is not zero length.", unit: "m" },
  { name: "capacity_m3", type: "number", nullable: true, nullMeaning: "Source did not report planned capacity; this is not zero capacity or current storage.", unit: "m3" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
export const wraDamWeirsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-wra-dam-weirs-owner-20260519", label: "WRA 水庫堰壩點（2026-05-19 owner-only）",
  description: "WRA GIC SWRESOIR 固定快照的 98 個 Point。保留英文名與原樣工程數值，bbox 可查這些工程點；不包含壩體邊界、水庫水面、集水區、即時蓄水量或 111 點水庫展示混合資料。",
  layerRefs: ["waterReservoirs"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "WRA GIC SWRESOIR official feature Point transformed from EPSG:3826. It identifies a mapped dam/weir feature but source material does not establish an entrance, traversable access point, water surface, facility boundary, positional accuracy for nearest analysis, safety claim, or current operational location.", spatialAnalysisEligible: false },
  timeFields: [], coverage: "2026-05-19 fixed WRA GIC SWRESOIR snapshot: 98 Point features. English name is absent for 36; each retained engineering measure is absent for 25. No result only concerns this fixed source and cannot establish that no dam, weir, reservoir, water resource, access route, or service exists.",
  license: "OGDL-Taiwan-1.0 is documented for WRA GIC SWRESOIR. The safe-field immutable artifact is localhost owner-only while the original download receipt is not retained; it makes no public release claim.",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "A null engineering field is source missing, not zero. A bbox with no result is not evidence of no water infrastructure or water storage.", stale: "The fixed 2026-05-19 source does not establish current operating, water level, capacity, safety, access, opening, or emergency conditions." },
  versions: [{ versionId: `20260519-source-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-05-19", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部水利署地理資訊中心 WRA GIC", reference: `/research/wra-dam-weirs/source-identity/sha256-${SOURCE_SHA256}`, lineage: "WRA GIC SWRESOIR -> analytics processed dam_weirs_wra GeoJSON SHA-256 61dc4881…9455 -> safe-field owner-only sidecar SHA-256 " + SIDECAR_SHA256 + ". Chinese source text is excluded because its stored SWRESOIR decode is corrupted. This source has 98 points and is not version-equivalent to water_dams.geojson's 111-point composite." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["record_id", "source_dam_id", "name_en"], supportsBbox: true, maxRowsPerQuery: 98, maxScanRows: 98, maxSourceBytes: 128 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: "wra-dam-weirs-owner-fixed-v1",
};
async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: wraDamWeirsOwnerDescriptor.datasetId, url: URL, idField: "source_dam_id", safeFields: fields.map(field => field.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SIDECAR_SHA256 || snapshot.rows.length !== 98 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error("WRA_DAM_WEIRS_OWNER_ASSET_MISMATCH");
  const receipt: SourceReceipt = { sourceId: wraDamWeirsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, checksumSha256: SOURCE_SHA256, reference: wraDamWeirsOwnerDescriptor.source.reference, acquiredAt: snapshot.acquiredAt };
  return { rows: snapshot.rows, source: receipt, coverage: wraDamWeirsOwnerDescriptor.coverage, freshness: "stale", exclusions: { source_name_en_missing: 36, source_dam_elev_m_missing: 25, source_dam_height_m_missing: 25, source_dam_length_m_missing: 25, source_capacity_m3_missing: 25, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}
export const wraDamWeirsOwnerAdapter = createReferencePointDatasetAdapter(wraDamWeirsOwnerDescriptor, read);
