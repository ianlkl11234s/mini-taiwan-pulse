import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/__local-research-owner-only/agri-leisure-farm-zones/agri-leisure-farm-zones.geojson";
const RAW_SHA = "9b4d1f00952a0ba1b8f794203fdbb7e469eab30deb8dfb0ce1251f5627916172";
const PROCESSED_SHA = "e80031b5bc50644f9da5e41d388f1a67c2acb7d85b95370cf471ae96a57eb0d0";
const ASSET_SHA = "80f19d00ae63fe3b86544bb086a454730280ae33e9bb9672684e92f3baf1a02d";
const ASSET_BYTES = 9_855_193;
const MAX_ASSET_BYTES = 12 * 1024 * 1024;
const ROWS = 109;
const REPAIRED = ["A83", "E74", "G72", "K29", "K78", "M42", "U14"] as const;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "source_slug", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "row_id", type: "number", nullable: false, nullMeaning: null, unit: null },
  { name: "la_name", type: "string", nullable: false, nullMeaning: null, unit: "source:LANAME" },
  { name: "key_code", type: "string", nullable: false, nullMeaning: null, unit: "source:KeyCode" },
  { name: "zone_name", type: "string", nullable: false, nullMeaning: null, unit: "source:休區名" },
  { name: "area_source_ha", type: "number", nullable: false, nullMeaning: null, unit: "source:AREA_ha" },
  { name: "county_code", type: "string", nullable: false, nullMeaning: null, unit: "source:AA45" },
  { name: "township_code", type: "string", nullable: false, nullMeaning: null, unit: "source:AA46" },
  { name: "county_township_code", type: "string", nullable: false, nullMeaning: null, unit: "source:AA4546" },
  { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "ha_calculated_before_repair" },
  { name: "geometry_status", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "raw_geometry_valid", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const agriLeisureFarmZonesOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-agri-leisure-farm-zones-owner-fy114",
  label: "休閒農業區範圍（114 年 owner-only）", description: "農業部核定 109 個休閒農業區的固定 WGS84 完整面。7 筆原始自交面已由來源處理流程 make_valid；保留逐筆修復狀態，不表示農場點位、入口、營業、服務或道路可達性。",
  layerRefs: ["agriLeisureFarmZones"], kind: "polygon", recordGrain: "feature", primaryKey: ["record_id"], fields,
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "processed WGS84 法定區域完整面；原始 Polygon 以單部件 MultiPolygon 表示，保留洞與多部件。7 筆原始 self-intersection 已依上游 make_valid 修復；法定界線以官方原檔為準。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "農業部資料集 9809 FY114/2025 固定快照：109 個核定休閒農業區，102 筆原始 geometry valid，A83/E74/G72/K29/K78/M42/U14 七筆原始自交面經處理後有效並可空間查詢。bbox 無結果只表示此版未相交，不能推論沒有休閒農業、農場、服務或可達性。",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）；僅 localhost owner-only sidecar，未驗公開發布。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "本資料欄位無 null；bbox 無結果不是零個休閒農業區，也不是沒有農業或旅遊服務。", zero: "AREA 或 area_ha 若為 0 是來源或計算明示值，不可改寫為缺值。", stale: "FY114/2025 年度版本不是逐筆核定、生效、營業、開放或服務現況時間。" },
  versions: [{ versionId: `processed-parquet-sha256:${PROCESSED_SHA}`, observedAt: null, availableAt: "2026-05-23", checksumSha256: PROCESSED_SHA, mutable: false }],
  source: { publisher: "農業部農村發展及水土保持署", reference: `/research/agri-leisure-farm-zones/source-identity/sha256-${PROCESSED_SHA}`, lineage: `data.gov.tw 9809 raw SHP ZIP SHA-256 ${RAW_SHA} -> upstream 03_clean_all.py GeoSeries.make_valid for seven self-intersections -> WGS84 GeoParquet SHA-256 ${PROCESSED_SHA} (109 rows, 3,869,061 bytes) -> SHA-bound owner-only safe-field surface sidecar. 法定界線以官方原始檔為準。` },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: fields.filter(field => field.name !== "geometry").map(field => field.name), supportsBbox: true, maxRowsPerQuery: ROWS, maxScanRows: ROWS, maxSourceBytes: MAX_ASSET_BYTES }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "agri-leisure-farm-zones-owner-surfaces-v1",
};

function fail(code: string): never { throw new Error(code); }
async function sha256(bytes: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function multi(value: unknown): Record<string, unknown> { const geometry = parseSpatialGeometry(value); if (geometry.type !== "MultiPolygon") fail("AGRI_LEISURE_FARM_ZONES_GEOMETRY_INVALID"); return geometry; }

export const agriLeisureFarmZonesOwnerAdapter: QueryAdapter = {
  descriptor: agriLeisureFarmZonesOwnerDescriptor, allowedParameters: {},
  read: (_parameters: Readonly<Record<string, Scalar>>, signal): Promise<AdapterReadResult> => withLoading("research:agri-leisure-farm-zones-owner", "休閒農業區範圍", (async () => {
    const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body) fail("AGRI_LEISURE_FARM_ZONES_ASSET_UNAVAILABLE");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_ASSET_BYTES) fail("AGRI_LEISURE_FARM_ZONES_ASSET_TOO_LARGE");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== ASSET_BYTES || bytes.byteLength > MAX_ASSET_BYTES || await sha256(bytes) !== ASSET_SHA) fail("AGRI_LEISURE_FARM_ZONES_ASSET_MISMATCH");
    const collection = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown[] };
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("AGRI_LEISURE_FARM_ZONES_COLLECTION_INVALID");
    const ids = new Set<string>(), repaired = new Set<string>(), rows: Record<string, unknown>[] = [];
    for (const [ordinal, raw] of collection.features.entries()) {
      const feature = raw as { type?: unknown; sourceOrdinal?: unknown; properties?: Record<string, unknown>; geometry?: unknown }, p = feature.properties;
      if (feature.type !== "Feature" || feature.sourceOrdinal !== ordinal || !p || typeof p.record_id !== "string" || p.record_id !== p.KeyCode || !p.record_id || ids.has(p.record_id)
        || p.source_dataset_id !== "9809" || p.source_slug !== "leisure_farm_zones_2025" || p.row_id !== ordinal || typeof p.LANAME !== "string" || typeof p["休區名"] !== "string"
        || typeof p.AA45 !== "string" || typeof p.AA46 !== "string" || typeof p.AA4546 !== "string" || typeof p.AREA !== "number" || !Number.isFinite(p.AREA) || typeof p.area_ha !== "number" || !Number.isFinite(p.area_ha)
        || !["source_valid", "repaired_from_invalid_raw"].includes(p.geometry_status as string) || typeof p.raw_geometry_valid !== "boolean") fail("AGRI_LEISURE_FARM_ZONES_ROW_INVALID");
      const isRepaired = p.geometry_status === "repaired_from_invalid_raw";
      if (isRepaired === p.raw_geometry_valid || isRepaired !== REPAIRED.includes(p.record_id as typeof REPAIRED[number])) fail("AGRI_LEISURE_FARM_ZONES_REPAIR_STATUS_MISMATCH");
      ids.add(p.record_id); if (isRepaired) repaired.add(p.record_id);
      rows.push({ record_id: p.record_id, source_dataset_id: p.source_dataset_id, source_slug: p.source_slug, row_id: p.row_id, la_name: p.LANAME, key_code: p.KeyCode, zone_name: p["休區名"], area_source_ha: p.AREA, county_code: p.AA45, township_code: p.AA46, county_township_code: p.AA4546, area_ha: p.area_ha, geometry_status: p.geometry_status, raw_geometry_valid: p.raw_geometry_valid, geometry: multi(feature.geometry) });
    }
    if (ids.size !== ROWS || [...repaired].sort().join(",") !== REPAIRED.join(",")) fail("AGRI_LEISURE_FARM_ZONES_REPAIR_SET_MISMATCH");
    const source: SourceReceipt = { sourceId: agriLeisureFarmZonesOwnerDescriptor.datasetId, version: `owner-sidecar-sha256:${ASSET_SHA}`, checksumSha256: ASSET_SHA, reference: URL, acquiredAt: new Date().toISOString() };
    return { rows, sourceRefs: [source], coverage: agriLeisureFarmZonesOwnerDescriptor.coverage, freshness: "stale", exclusions: { raw_self_intersection_repaired: REPAIRED.length }, rowsScanned: ROWS, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
  })()),
};
