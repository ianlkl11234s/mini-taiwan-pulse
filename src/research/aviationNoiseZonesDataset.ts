import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry, type PolygonGeometry } from "./spatialKernel";

const ASSET_URL = "/environment/aviation_noise_zones.geojson";
const SHA256 = "d17515936bc357ce3602473c2768ebd2e1647d39f8660c8e32133dbbb661bb51";
const BYTES = 1_072_567;
const ROWS = 76;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const TYC_SOURCE_HASH = "28dbe5367c5fc456aa03bc033ad4fc8c83e0defdbee6ce47b597b623711d17fe";
const KCG_SOURCE_HASH = "fcadf3fbadcfac912ba96223a4140c085e134fd38fd66bd4bd6e3b3c7affb1ee";

type ObjectValue = Record<string, unknown>;
type Row = Record<string, unknown>;
export type AviationNoiseZonesFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const fields: readonly DatasetField[] = [
  { name: "zone_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "town", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "village", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "village_code", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "zone_levels", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "display_zone_level", type: "number", nullable: false, nullMeaning: null, unit: "legal zone level for display ordering" },
  { name: "membership_count", type: "number", nullable: false, nullMeaning: null, unit: "distinct source memberships" },
  { name: "legal_unit", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "legal_version", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "effective_date", type: "datetime", nullable: true, nullMeaning: "來源 metadata 未載明生效日；不可由 source_updated_at 或 built_at 推定。", unit: null },
  { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "spatial_precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "is_measured_contour", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "source_village_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "name_alias_applied", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "source_dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_org", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_url", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_updated_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
  { name: "source_license", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_hash", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "built_at", type: "datetime", nullable: false, nullMeaning: null, unit: null },
  { name: "area_km2", type: "number", nullable: false, nullMeaning: null, unit: "km² (projected boundary area)" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const aviationNoiseZonesDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-aviation-noise-legal-village-zones-20260827", label: "航空噪音法定里別（桃園／高雄 2026-08-27 快照）",
  description: "桃園與高雄官方航空噪音分級里別清單 join 至 NLSC 村里界的 76 個固定 Polygon。幾何代表整個列入名單的行政里；不是量測 DNL 等音線，也不能表示里內任一點的噪音暴露或音量。",
  layerRefs: ["aviationNoiseZones"], kind: "polygon", recordGrain: "feature", primaryKey: ["zone_id"], fields,
  geometry: { type: "Polygon", crs: "EPSG:4326", role: "proxy", precision: "NLSC village boundary 2026-06-26 joined by explicit legal village membership; spatial_precision=admin_join. This is an administrative-area proxy, not a measured contour.", spatialAnalysisEligible: false },
  timeFields: [], coverage: "76 village polygons from verified legal-membership lists only: Taoyuan 31 (58 memberships) and Kaohsiung 45 (45 memberships). An absent village is outside these two source snapshots, not evidence of no aircraft noise or no exposure.",
  license: "政府資料開放授權條款第1版（桃園 26115、高雄 107165 與 NLSC 村里界衍生快照）。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "effective_date=null means the corresponding source metadata does not state an effective date; source_updated_at and built_at are different dates and must not replace it.", missing: "A missing village means it is not present in the verified Taoyuan/Kaohsiung legal-membership source scope; it does not establish no aircraft noise, no regulatory status, or no point exposure.", stale: "The fixed 2026-08-27 build uses Taoyuan metadata 2026-05-07, Kaohsiung metadata 2025-09-24, and NLSC boundaries 2026-06-26. It is historical until the stated semi-annual review rebuilds it." },
  versions: [{ versionId: `processed-sha256:${SHA256}`, observedAt: null, availableAt: "2026-08-27", checksumSha256: SHA256, mutable: false }],
  source: { publisher: "桃園市政府環境保護局、高雄市政府民政局；boundary: NLSC", reference: ASSET_URL, lineage: `Taoyuan dataset 26115 source sha256:${TYC_SOURCE_HASH} (metadata 2026-05-07) + Kaohsiung dataset 107165 source sha256:${KCG_SOURCE_HASH} (metadata 2025-09-24) + NLSC village boundary 2026-06-26 sha256:4b5832c1fdf066945fa121c9a31c20e858d8deb4198dae2afab4db9889231d99 -> explicit membership join -> public/environment/aviation_noise_zones.geojson sha256:${SHA256}.` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["zone_id", "county", "town", "village", "village_code", "zone_levels", "display_zone_level", "source_dataset_id", "spatial_precision", "is_measured_contour"], supportsBbox: true, maxRowsPerQuery: 50, maxScanRows: ROWS, maxSourceBytes: MAX_BYTES, maxResponseBytes: 1024 * 1024, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records"], adapterId: "aviation-noise-legal-village-zones-fixed-v1",
};

function object(value: unknown): value is ObjectValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function fail(code: string): never { throw new Error(code); }
async function digest(bytes: Uint8Array): Promise<string> { const value = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }

function required(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function validDate(value: unknown): value is string { return required(value) && Number.isFinite(Date.parse(value)); }
function polygon(value: unknown): PolygonGeometry { const geometry = parseSpatialGeometry(value); if (geometry.type !== "Polygon") fail("AVIATION_NOISE_ZONES_GEOMETRY_INVALID"); return geometry; }

/** Validates the complete fixed source before exposing legal-membership proxy rows. */
export function validateAviationNoiseZonesSnapshot(source: unknown): Row[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("AVIATION_NOISE_ZONES_COLLECTION_INVALID");
  const ids = new Set<string>(); const sourceCounts = new Map<string, number>();
  return collection.features.map(raw => {
    const feature = raw as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (feature?.type !== "Feature" || !object(feature.properties) || Object.keys(feature.properties).length !== fields.length - 1) fail("AVIATION_NOISE_ZONES_ROW_INVALID");
    const p = feature.properties;
    const sourceDatasetId = p.source_dataset_id, displayZoneLevel = p.display_zone_level, membershipCount = p.membership_count;
    if (!required(p.zone_id) || !/^(26115|107165)-\d{11}$/.test(p.zone_id) || ids.has(p.zone_id) || !required(p.county) || !required(p.town) || !required(p.village)
      || !required(p.village_code) || !/^\d{11}$/.test(p.village_code) || !required(p.zone_levels) || !/^[1-3](,[1-3]){0,2}$/.test(p.zone_levels)
      || typeof displayZoneLevel !== "number" || !Number.isInteger(displayZoneLevel) || ![1, 2, 3].includes(displayZoneLevel) || typeof membershipCount !== "number" || !Number.isInteger(membershipCount) || membershipCount < 1 || membershipCount > 3
      || p.zone_levels.split(",").length !== membershipCount || Math.max(...p.zone_levels.split(",").map(Number)) !== displayZoneLevel
      || p.legal_unit !== "法定里別" || !required(p.legal_version) || p.effective_date !== null || p.boundary_version !== "NLSC village boundary 2026-06-26"
      || p.spatial_precision !== "admin_join" || p.is_measured_contour !== false || !required(p.source_village_name) || typeof p.name_alias_applied !== "boolean"
      || !(sourceDatasetId === "26115" || sourceDatasetId === "107165") || !required(p.source_org) || !required(p.source_url) || !validDate(p.source_updated_at)
      || p.source_license !== "政府資料開放授權條款第1版" || !(p.source_hash === TYC_SOURCE_HASH || p.source_hash === KCG_SOURCE_HASH)
      || p.built_at !== "2026-08-27" || typeof p.area_km2 !== "number" || !Number.isFinite(p.area_km2) || p.area_km2 <= 0) fail("AVIATION_NOISE_ZONES_ROW_INVALID");
    const expectedHash = sourceDatasetId === "26115" ? TYC_SOURCE_HASH : KCG_SOURCE_HASH;
    if (p.source_hash !== expectedHash || !p.zone_id.startsWith(`${sourceDatasetId}-`)) fail("AVIATION_NOISE_ZONES_PROVENANCE_INVALID");
    ids.add(p.zone_id); sourceCounts.set(sourceDatasetId, (sourceCounts.get(sourceDatasetId) ?? 0) + 1);
    return { ...p, geometry: polygon(feature.geometry) };
  }).map(row => {
    if (sourceCounts.get("26115") !== 31 || sourceCounts.get("107165") !== 45) fail("AVIATION_NOISE_ZONES_COVERAGE_INVALID");
    return row;
  });
}

export function createAviationNoiseZonesDatasetAdapter(fetcher: AviationNoiseZonesFetch = fetch): QueryAdapter {
  return {
    descriptor: aviationNoiseZonesDescriptor, allowedParameters: {},
    async read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterReadResult> {
      return withLoading("research:aviation-noise-zones", "讀取航空噪音法定里別", (async () => {
        const response = await fetcher(ASSET_URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok || !response.body) fail("AVIATION_NOISE_ZONES_ASSET_UNAVAILABLE");
        const contentLength = response.headers.get("content-length"); const declared = contentLength === null ? null : Number(contentLength);
        if (declared !== null && (!Number.isFinite(declared) || declared !== BYTES || declared > MAX_BYTES)) fail("AVIATION_NOISE_ZONES_ASSET_MISMATCH");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength !== BYTES || bytes.byteLength > MAX_BYTES || await digest(bytes) !== SHA256) fail("AVIATION_NOISE_ZONES_SOURCE_MISMATCH");
        let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("AVIATION_NOISE_ZONES_JSON_INVALID"); }
        const rows = validateAviationNoiseZonesSnapshot(source); const acquiredAt = new Date().toISOString();
        const sourceRefs: SourceReceipt[] = [
          { sourceId: "tycg:26115", version: "metadata-2026-05-07", checksumSha256: TYC_SOURCE_HASH, reference: "https://opendata.tycg.gov.tw/api/dataset/4eecbb62-3cf4-41dc-92af-0324c656425a/resource/1404c770-ac70-4dbc-aab3-f30093b2365c/download", acquiredAt },
          { sourceId: "kcg:107165", version: "metadata-2025-09-24", checksumSha256: KCG_SOURCE_HASH, reference: "https://openapi.kcg.gov.tw/Api/Service/Get/46c3b3c5-0189-4397-ade0-82c7e7605918", acquiredAt },
          { sourceId: aviationNoiseZonesDescriptor.datasetId, version: `processed-sha256:${SHA256}`, checksumSha256: SHA256, reference: ASSET_URL, acquiredAt },
        ];
        return { rows, sourceRefs, coverage: aviationNoiseZonesDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
      })());
    },
  };
}

export const aviationNoiseZonesAdapter = createAviationNoiseZonesDatasetAdapter();
