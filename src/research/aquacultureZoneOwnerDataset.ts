import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/__local-research-owner-only/aquaculture-zone/aquaculture-zone.geojson";
const SOURCE_SHA = "3096bf94ac94a98b642bd011e846ab7b886807b0bfe8c01fd8cb4aae05fcdb8e";
const ASSET_SHA = "6290797c86b1403334e6a3bcc8ae01dce7337e5706135178636cbd01eae9a42a";
const BYTES = 522_406;
const MAX_BYTES = 8 * 1024 * 1024;
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "zone_name", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "township", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "ha" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const aquacultureZoneOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-aquaculture-production-zone-owner-20260519",
  label: "養殖漁業生產區（2026-05-19 owner-only）",
  description: "62 筆法定陸上養殖生產區 Polygon/MultiPolygon 固定快照，查詢採完整面與 bbox 真實相交；不是魚塭現況、產量或營運狀態。",
  layerRefs: ["aquacultureZone"], kind: "polygon", recordGrain: "feature", primaryKey: ["record_id"], fields,
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "來源 WGS84 完整面；單一 Polygon 轉為一部件 MultiPolygon 以統一查詢，保留洞與多部件。", spatialAnalysisEligible: true },
  timeFields: [], coverage: "2026-05-19 本地固定處理快照：11 縣市、62 筆、來源面積合計 18,676.7 ha。查無相交只代表此版未收錄，不代表沒有養殖。",
  license: "OGDL-Taiwan-1.0；本地 owner-only 安全欄位副本，未驗公開部署。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "查無面範圍不等於養殖面積零，也不是沒有養殖活動。", stale: "處理快照日期不是各生產區法定生效或現況日期。" },
  versions: [{ versionId: `processed-sha256:${SOURCE_SHA}`, observedAt: null, availableAt: "2026-05-19", checksumSha256: SOURCE_SHA, mutable: false }],
  source: { publisher: "農業部漁業署", reference: `/research/aquaculture-zone/source-identity/sha256-${SOURCE_SHA}`, lineage: "analytics processed aquaculture_production_zone.geojson -> SHA-bound owner-only safe-field sidecar; original SHP uses EPSG:3826, processed source and query geometry use EPSG:4326." },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["record_id", "zone_name", "county", "township"], supportsBbox: true, maxRowsPerQuery: 62, maxScanRows: 62, maxSourceBytes: MAX_BYTES }),
  supportedOperations: ["query_records"], adapterId: "aquaculture-zone-owner-surfaces-v1",
};

function fail(code: string): never { throw new Error(code); }
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function multi(value: unknown): Record<string, unknown> {
  const geometry = parseSpatialGeometry(value);
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  if (geometry.type === "MultiPolygon") return geometry;
  return fail("AQUACULTURE_ZONE_GEOMETRY_INVALID");
}

export const aquacultureZoneOwnerAdapter: QueryAdapter = {
  descriptor: aquacultureZoneOwnerDescriptor, allowedParameters: {},
  read: (_parameters, signal, context): Promise<AdapterReadResult> => {
    if (!context?.bbox) fail("BBOX_REQUIRED");
    return withLoading("research:aquaculture-zone-owner", "養殖漁業生產區範圍", (async () => {
      const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
      if (!response.ok || !response.body) fail("AQUACULTURE_ZONE_ASSET_UNAVAILABLE");
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_BYTES) fail("AQUACULTURE_ZONE_ASSET_TOO_LARGE");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== BYTES || bytes.byteLength > MAX_BYTES || await sha256(bytes) !== ASSET_SHA) fail("AQUACULTURE_ZONE_ASSET_MISMATCH");
      const collection = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown[] };
      if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 62) fail("AQUACULTURE_ZONE_COLLECTION_INVALID");
      const ids = new Set<string>();
      const rows = collection.features.map((raw, ordinal) => {
        const feature = raw as { type?: unknown; sourceOrdinal?: unknown; properties?: Record<string, unknown>; geometry?: unknown };
        const p = feature.properties;
        if (feature.type !== "Feature" || feature.sourceOrdinal !== ordinal || !p || typeof p.record_id !== "string" || !p.record_id || typeof p.zone_name !== "string" || !p.zone_name || typeof p.county !== "string" || !p.county || typeof p.township !== "string" || !p.township || typeof p.area_ha !== "number" || !Number.isFinite(p.area_ha) || p.area_ha < 0) fail("AQUACULTURE_ZONE_ROW_INVALID");
        if (ids.has(p.record_id)) fail("AQUACULTURE_ZONE_DUPLICATE_ID");
        ids.add(p.record_id);
        return { record_id: p.record_id, zone_name: p.zone_name, county: p.county, township: p.township, area_ha: p.area_ha, geometry: multi(feature.geometry) };
      });
      const sourceRefs: SourceReceipt[] = [{ sourceId: aquacultureZoneOwnerDescriptor.datasetId, version: `processed-sha256:${SOURCE_SHA}`, checksumSha256: SOURCE_SHA, reference: aquacultureZoneOwnerDescriptor.source.reference, acquiredAt: new Date().toISOString() }];
      return { rows, sourceRefs, coverage: aquacultureZoneOwnerDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: 62, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
    })());
  },
};
