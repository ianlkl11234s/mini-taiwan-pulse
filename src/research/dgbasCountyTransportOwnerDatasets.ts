import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { createAdminStatisticsAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

const URL = "/__local-research-owner-only/dgbas-county-transport/dgbas-county-transport-owner-only.json";
const ASSET_SHA256 = "e3bcddc88329b59f65f90e76d6a3e0416f92986f4bdc16601fc8deb6f659c4bc";
const ASSET_BYTES = 545_750;
const BOUNDARY_SHA256 = "3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c";
const DATASET_ID = "dgbas_county_transport_supply_10935";
const BOUNDARY_VERSION = "COUNTY_MOI_1140318";
const releaseReceipts: Readonly<Record<string, { bytes: number; sha256: string }>> = {
  "2023-automobile_license_holders_count-0c793677c581": { bytes: 6849, sha256: "7c54c4949270aa4c40789832320ee8052a4db4247b7de5df7bfd802e0f7ae518" },
  "2023-automobile_registered_count-9424c364db39": { bytes: 6760, sha256: "25eaafb6329702d36e47ae5c1c24ab023dee7a349f02046edecc3848f04677ca" },
  "2023-motorcycle_license_holders_count-9cb31eb37a44": { bytes: 6849, sha256: "c4a023e2e715632cc49b6d4028fc49d43ae2f0d740df932cdad34d3f630246f1" },
  "2023-motorcycle_registered_count-bad4618a5ea4": { bytes: 6766, sha256: "57f3537e59881558323573f44e8f739ac449b5021c4a30b5c7a8a1ef95dbc0f6" },
  "2023-offstreet_small_car_parking_spaces_count-9776007d1222": { bytes: 6924, sha256: "47e26126dc4688e11062719c8e6e3ea6cb8efe1ad98079d6c3f4e6c5542e7733" },
  "2023-onstreet_small_car_parking_spaces_count-ed49f8d5232e": { bytes: 6792, sha256: "b8d39057692d72ce0c682579d70d12839c7f496d24d73c7513bcd7230cb8c148" },
  "2024-automobile_license_holders_count-086aa2d30e2e": { bytes: 6849, sha256: "e9dfd57e1b00b86e6943e63599edbc5e46f85ba60f4e725588f1c1237129abc1" },
  "2024-automobile_registered_count-7e0f2b27211e": { bytes: 6760, sha256: "fbfb6b7e6e1e771cf5b7431067fa3b03e83b160987f8af8a6af8b4ffd20b9600" },
  "2024-motorcycle_license_holders_count-232ed00ada32": { bytes: 6849, sha256: "7d48b81efb4699c92dcf1fbf0b4e09b5002407fc835bdd660843dedd13b41a21" },
  "2024-motorcycle_registered_count-1c4533c06350": { bytes: 6766, sha256: "94cd08408138b3eabc141925252ffd75649cf4f3c7776b6c7cb7019d17dd03a9" },
  "2024-offstreet_small_car_parking_spaces_count-530cb5ca2fe3": { bytes: 6924, sha256: "b658d9d3eadbe36237322194ee59bda1c64f5752bec8bc7548e403fde5e20053" },
  "2024-onstreet_small_car_parking_spaces_count-eb02ac90e651": { bytes: 6793, sha256: "589a28c689b07f2083873ab3ba49aa82c1f1153e48a4ae6c9a59d8f9a15b37e5" },
};

type Indicator = { layerRef: string; indicatorId: string; label: string; unit: string; releases: readonly [string, string] };
const indicators: readonly Indicator[] = [
  { layerRef: "statsOffstreetSmallCarParkingSpacesCount", indicatorId: "offstreet_small_car_parking_spaces_count", label: "小型汽車路外停車位", unit: "個", releases: ["2023-offstreet_small_car_parking_spaces_count-9776007d1222", "2024-offstreet_small_car_parking_spaces_count-530cb5ca2fe3"] },
  { layerRef: "statsOnstreetSmallCarParkingSpacesCount", indicatorId: "onstreet_small_car_parking_spaces_count", label: "小型汽車路邊停車位", unit: "個", releases: ["2023-onstreet_small_car_parking_spaces_count-ed49f8d5232e", "2024-onstreet_small_car_parking_spaces_count-eb02ac90e651"] },
  { layerRef: "statsMotorcycleRegisteredCount", indicatorId: "motorcycle_registered_count", label: "機車登記數", unit: "輛", releases: ["2023-motorcycle_registered_count-bad4618a5ea4", "2024-motorcycle_registered_count-1c4533c06350"] },
  { layerRef: "statsAutomobileRegisteredCount", indicatorId: "automobile_registered_count", label: "汽車登記數", unit: "輛", releases: ["2023-automobile_registered_count-9424c364db39", "2024-automobile_registered_count-7e0f2b27211e"] },
  { layerRef: "statsAutomobileLicenseHoldersCount", indicatorId: "automobile_license_holders_count", label: "汽車駕照持有人數", unit: "人", releases: ["2023-automobile_license_holders_count-0c793677c581", "2024-automobile_license_holders_count-086aa2d30e2e"] },
  { layerRef: "statsMotorcycleLicenseHoldersCount", indicatorId: "motorcycle_license_holders_count", label: "機車駕照持有人數", unit: "人", releases: ["2023-motorcycle_license_holders_count-9cb31eb37a44", "2024-motorcycle_license_holders_count-232ed00ada32"] },
];

const fields: readonly DatasetField[] = [
  { name: "release_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "indicator_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "layer_ref", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "level", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "indicator_name", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "unit", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "value", type: "number", nullable: true, nullMeaning: "僅非 observed status 可為 null；null 不等於零。", unit: null }, { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "period_start", type: "datetime", nullable: false, nullMeaning: null, unit: null }, { name: "period_end", type: "datetime", nullable: false, nullMeaning: null, unit: null },
  { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "boundary_sha256", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "dimensions", type: "json", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

type Row = Record<string, unknown>;
type Release = { release_id: string; file_sha256: string; file_bytes: number; dataset_id: string; indicator_id: string; indicator_name: string; unit: string; period_start: string; period_end: string; boundary_version: string; raw_sha256: string; publisher: string; license: string; source_landing_url: string; source_download_url: string; health: string; observations: { area_code: string; dimensions: { roc_year: string }; value: number | null; status: string }[] };
type Boundary = { area_name: string; geometry: { type: "MultiPolygon"; coordinates: unknown[] } };
type Asset = { schema_version: string; source_manifest: { dataset_id: string }; releases: Release[]; boundary: { version: string; sha256: string; role: string; features_by_code: Record<string, Boundary> } };
export type DgbasCountyTransportAssetReader = (signal?: AbortSignal) => Promise<Uint8Array>;

function fail(code: string): never { throw new Error(code); }
function object(value: unknown): value is Row { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function sha(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
async function digest(bytes: Uint8Array): Promise<string> { const output = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(output)].map(value => value.toString(16).padStart(2, "0")).join(""); }

async function readDefault(signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
  if (!response.ok) fail("DGBAS_TRANSPORT_OWNER_ASSET_UNAVAILABLE");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared !== ASSET_BYTES) fail("DGBAS_TRANSPORT_OWNER_ASSET_MISMATCH");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== ASSET_BYTES || await digest(bytes) !== ASSET_SHA256) fail("DGBAS_TRANSPORT_OWNER_ASSET_MISMATCH");
  return bytes;
}

function descriptor(indicator: Indicator): DatasetDescriptor {
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: `dgbas-county-transport-owner:${indicator.indicatorId}`, label: indicator.label,
    description: `主計總處原生縣市交通統計的 2023/2024 固定 release。附 ${BOUNDARY_VERSION} 的廣義縣市參考面供地圖呈現與縣市值比較；邊界不是原始精度分析面，點落界／精確相交 HOLD。`,
    layerRefs: [indicator.layerRef], kind: "admin_statistic", recordGrain: "admin_statistic", primaryKey: ["release_id", "area_code"], fields,
    geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "generalized", precision: "Fixed published county-reference-2025 SHA-256 3feeca87…f6c, keyed by exact area_code and COUNTY_MOI_1140318. Generalized display/reference geometry only, not raw-precision analytical boundary.", spatialAnalysisEligible: false },
    timeFields: [{ name: "period_start", role: "period_start", timezone: "Asia/Taipei" }, { name: "period_end", role: "period_end", timezone: "Asia/Taipei" }],
    coverage: "Each release contains exactly 22 native county observations. Absence outside these 22 records is not a geographic zero or a spatial exclusion.", license: "政府資料開放授權條款-第1版（OGDL-Taiwan-1.0）；本副本僅 localhost owner-only。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "Source null remains null and requires a non-observed status; never convert it to zero.", suppressed: "Source suppressed values remain null; never convert them to zero.", stale: "All 2023/2024 releases are source-marked STALE historical snapshots, not current transport availability, traffic, resident ownership, or parking vacancy." },
    versions: indicator.releases.map(versionId => ({ versionId, observedAt: versionId.slice(0, 4) === "2023" ? "2023-12-31" : "2024-12-31", availableAt: null, checksumSha256: releaseReceipts[versionId]!.sha256, mutable: false })),
    source: { publisher: "行政院主計總處（data.gov.tw 10935）", reference: URL, lineage: "analytics immutable release manifest whitelist (12 files) -> SHA/byte verified safe local owner-only reader; release retains raw source SHA, 22 county coverage, status, ROC year, unit and boundary_version. Published generalized county-reference-2025 SHA is separately pinned and joined by exact area_code." },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["release_id", "area_code", "status", "indicator_id"], timeFields: ["period_start", "period_end"], maxRowsPerQuery: 22, maxScanRows: 22, maxSourceBytes: ASSET_BYTES }),
    parameters: [{ name: "releaseId", type: "string", required: true, options: indicator.releases }], supportedOperations: ["query_records", "aggregate", "compare_regions"], adapterId: "dgbas-county-transport-owner-only-v1",
  };
}

function parse(bytes: Uint8Array): Asset {
  let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("DGBAS_TRANSPORT_OWNER_ASSET_INVALID"); }
  if (!object(value) || value.schema_version !== "pulse-dgbas-county-transport-owner-only/1" || !object(value.source_manifest) || value.source_manifest.dataset_id !== DATASET_ID || !Array.isArray(value.releases) || value.releases.length !== 12 || !object(value.boundary) || value.boundary.version !== BOUNDARY_VERSION || value.boundary.sha256 !== BOUNDARY_SHA256 || value.boundary.role !== "generalized_display_reference" || !object(value.boundary.features_by_code) || Object.keys(value.boundary.features_by_code).length !== 22) fail("DGBAS_TRANSPORT_OWNER_ASSET_INVALID");
  return value as Asset;
}

function checkedRelease(asset: Asset, indicator: Indicator, releaseId: Scalar): Release {
  if (typeof releaseId !== "string" || !indicator.releases.includes(releaseId)) fail("RELEASE_NOT_ALLOWED");
  const release = asset.releases.find(item => object(item) && item.release_id === releaseId);
  const receipt = releaseReceipts[releaseId];
  if (!release || !receipt || asset.releases.filter(item => item.release_id === releaseId).length !== 1 || release.dataset_id !== DATASET_ID || release.indicator_id !== indicator.indicatorId || !release.indicator_name || release.unit !== indicator.unit || release.boundary_version !== BOUNDARY_VERSION || release.file_sha256 !== receipt.sha256 || release.file_bytes !== receipt.bytes || !sha(release.raw_sha256) || !Array.isArray(release.observations) || release.observations.length !== 22 || release.health !== "STALE" || typeof release.publisher !== "string" || typeof release.license !== "string" || typeof release.source_landing_url !== "string" || typeof release.source_download_url !== "string") fail("DGBAS_TRANSPORT_RELEASE_CONTRACT_MISMATCH");
  const expectedYear = releaseId.slice(0, 4), expectedRocYear = expectedYear === "2023" ? "112" : expectedYear === "2024" ? "113" : null;
  if (!expectedRocYear || release.period_start !== `${expectedYear}-01-01` || release.period_end !== `${expectedYear}-12-31`) fail("DGBAS_TRANSPORT_RELEASE_CONTRACT_MISMATCH");
  const codes = new Set<string>();
  for (const observation of release.observations) {
    if (!object(observation) || typeof observation.area_code !== "string" || !observation.area_code || codes.has(observation.area_code) || !object(observation.dimensions) || observation.dimensions.roc_year !== expectedRocYear || typeof observation.status !== "string") fail("DGBAS_TRANSPORT_OBSERVATION_INVALID");
    codes.add(observation.area_code);
    if (observation.status === "observed" ? typeof observation.value !== "number" || !Number.isFinite(observation.value) : observation.value !== null) fail("DGBAS_TRANSPORT_OBSERVATION_INVALID");
  }
  if (codes.size !== 22) fail("DGBAS_TRANSPORT_COUNTY_COVERAGE_MISMATCH");
  return release;
}

function source(release: Release): SourceReceipt {
  return { sourceId: `dgbas-10935:${release.indicator_id}`, version: release.release_id, acquiredAt: new Date().toISOString(), checksumSha256: release.file_sha256, reference: `analytics/data/processed/transportation/dgbas_county_transport_supply/releases/${release.release_id}.json` };
}

export function createDgbasCountyTransportOwnerAdapters(readAsset: DgbasCountyTransportAssetReader = readDefault): QueryAdapter[] {
  return indicators.map(indicator => {
    const dataDescriptor = descriptor(indicator);
    return createAdminStatisticsAdapter(dataDescriptor, async (parameters, signal): Promise<AdapterSnapshot> => withLoading(`research:dgbas-county-transport:${indicator.indicatorId}`, indicator.label, (async () => {
      const bytes = await readAsset(signal);
      if (bytes.byteLength !== ASSET_BYTES || await digest(bytes) !== ASSET_SHA256) fail("DGBAS_TRANSPORT_OWNER_ASSET_MISMATCH");
      const asset = parse(bytes);
      const release = checkedRelease(asset, indicator, parameters.releaseId ?? null);
      const rows = release.observations.map(observation => {
        const boundary = asset.boundary.features_by_code[observation.area_code];
        if (!boundary || typeof boundary.area_name !== "string" || boundary.geometry?.type !== "MultiPolygon" || !Array.isArray(boundary.geometry.coordinates)) fail("DGBAS_TRANSPORT_BOUNDARY_CONTRACT_MISMATCH");
        return { release_id: release.release_id, dataset_id: DATASET_ID, indicator_id: indicator.indicatorId, layer_ref: indicator.layerRef, level: "county", area_code: observation.area_code, area_name: boundary.area_name, indicator_name: release.indicator_name, unit: indicator.unit, value: observation.value, status: observation.status, period_start: release.period_start, period_end: release.period_end, boundary_version: release.boundary_version, boundary_sha256: BOUNDARY_SHA256, dimensions: observation.dimensions, geometry: boundary.geometry };
      });
      return { rows, source: source(release), sourceRefs: [{ sourceId: "dgbas-county-transport-boundary", version: BOUNDARY_VERSION, acquiredAt: new Date().toISOString(), checksumSha256: BOUNDARY_SHA256, reference: "public/statistics/county-reference-2025.geojson" }, { sourceId: "dgbas-county-transport-owner-only", version: "v1", acquiredAt: new Date().toISOString(), checksumSha256: ASSET_SHA256, reference: URL }], coverage: dataDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: 22, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
    })()));
  });
}

export const dgbasCountyTransportOwnerAdapters = createDgbasCountyTransportOwnerAdapters();
