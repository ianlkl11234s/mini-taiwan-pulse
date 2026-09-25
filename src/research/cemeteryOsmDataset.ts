import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter, QueryReadContext } from "./queryExecutor";
import { parseSpatialGeometry } from "./spatialKernel";

const URL = "/__local-research-owner-only/cemetery-osm/cemetery-osm.geojson";
const RAW_SHA256 = "98a6871dc7efb4c3445be2453d46240dc9aeb9963a25337d7bd5c00ead5ceffa";
const PROCESSED_SHA256 = "615a9adc23ac112aa56e0cc84bf106556f8acea13fadbe2436218ea530a58b23";
const PROCESSED_BYTES = 3_602_036;
const ROWS = 3_229;
const MAX_BYTES = 4 * 1024 * 1024;

const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "osm_id", type: "string", nullable: false, nullMeaning: null, unit: "openstreetmap_element_id" },
  { name: "osm_type", type: "string", nullable: false, nullMeaning: null, unit: "openstreetmap_element_type" },
  { name: "name", type: "string", nullable: true, nullMeaning: "OpenStreetMap feature has no name tag; it does not establish that the area has no local name or is not a cemetery.", unit: null },
  { name: "landuse", type: "string", nullable: true, nullMeaning: "OpenStreetMap feature has no landuse tag; it is not a land-use or legal-status finding.", unit: null },
  { name: "amenity", type: "string", nullable: true, nullMeaning: "OpenStreetMap feature has no amenity tag; it is not a statement about facilities or services.", unit: null },
  { name: "religion", type: "string", nullable: true, nullMeaning: "OpenStreetMap feature has no religion tag; it is not a finding about affiliation.", unit: null },
  { name: "denomination", type: "string", nullable: true, nullMeaning: "OpenStreetMap feature has no denomination tag; it is not a finding about affiliation.", unit: null },
  { name: "area_ha", type: "number", nullable: false, nullMeaning: null, unit: "ha" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const cemeteryOsmDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-osm-cemetery-surfaces-owner-20260805", label: "OpenStreetMap 墓地範圍（2026-08-05 owner-only）",
  description: "Overpass 固定快照的 3,229 個 OpenStreetMap cemetery / grave_yard Polygon 或 MultiPolygon。每次查詢必須提供 bbox，並以完整面界相交；這是社群繪製位置參考，不是官方法定墓地、墓政名冊、目前營運、開放、埋葬或服務狀態。",
  layerRefs: ["cemeteryOsm"], kind: "polygon", recordGrain: "feature", primaryKey: ["record_id"], fields,
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "Processed source retains actual OSM Polygon/MultiPolygon coordinates, rings and holes. Polygon records are represented as one-part MultiPolygon only to make one full-surface reader; no centroid, bbox or generalized boundary replaces the source surface.", spatialAnalysisEligible: true },
  timeFields: [],
  coverage: "Overpass API snapshot: 3,229 source features (3,008 way and 221 relation) at timestamp_osm_base=2026-08-04T17:36:31Z, processed 2026-08-05. It covers only OSM features returned by that snapshot; a bbox with no result does not show that there is no cemetery, burial site, legal designation, access or current activity.",
  license: "ODbL; processed features declare license=ODbL and attribution=© OpenStreetMap contributors. Localhost owner-only reader; public redistribution and display release are outside this reader's evidence.",
  valueSemantics: {
    ...DEFAULT_VALUE_SEMANTICS,
    missing: "A missing OSM feature or empty bbox result is not evidence of no cemetery, legal designation, burial activity, access or service.",
    null: "name, landuse, amenity, religion and denomination preserve an absent OSM tag as null; null is not zero, false, inactive or unknown current status.",
    zero: "area_ha=0 only if the processed source explicitly calculates zero; it is never substituted for a null tag or missing geometry.",
    stale: "The 2026-08-04/05 OSM snapshot does not establish current land use, legal status, operation, opening, access, burials or available services.",
  },
  versions: [{ versionId: `processed-sha256:${PROCESSED_SHA256}`, observedAt: "2026-08-04T17:36:31Z", availableAt: "2026-08-05T00:00:00+08:00", checksumSha256: PROCESSED_SHA256, mutable: false }],
  source: { publisher: "OpenStreetMap contributors via Overpass API", reference: URL, lineage: `Overpass raw osm_cemetery_raw_20260805.json SHA-256 ${RAW_SHA256} (3,229: 3,008 way, 221 relation; ODbL declaration) -> processed cemetery_osm_20260805.geojson SHA-256 ${PROCESSED_SHA256} (${ROWS} features, ${PROCESSED_BYTES} bytes; 3,099 Polygon, 130 MultiPolygon) -> localhost owner-only reader. Only safe public OSM ID/type, selected classification tags, calculated area and source surface are returned; operator, description and wikidata are not exposed.` },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["record_id", "osm_id", "osm_type", "name", "landuse", "amenity", "religion", "denomination"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: ROWS, maxResponseBytes: 256 * 1024, maxSourceBytes: MAX_BYTES }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "osm-cemetery-owner-surfaces-v1",
};

function fail(code: string): never { throw new Error(code); }
async function sha256(bytes: Uint8Array): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function nullableString(value: unknown): string | null { if (value === null) return null; if (typeof value === "string") return value; fail("CEMETERY_OSM_ROW_INVALID"); }

/** Convert only the GeoJSON container type; all source rings, holes and vertices remain unchanged. */
function multi(geometry: unknown): Record<string, unknown> {
  const parsed = parseSpatialGeometry(geometry);
  if (parsed.type === "Polygon") return { type: "MultiPolygon", coordinates: [parsed.coordinates] };
  if (parsed.type === "MultiPolygon") return parsed;
  fail("CEMETERY_OSM_GEOMETRY_INVALID");
}

function parseRows(source: unknown): Record<string, unknown>[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("CEMETERY_OSM_COLLECTION_INVALID");
  const ids = new Set<string>();
  return collection.features.map(raw => {
    const feature = raw as { type?: unknown; properties?: Record<string, unknown>; geometry?: unknown }, properties = feature?.properties;
    if (feature?.type !== "Feature" || !properties || typeof properties.osm_id !== "string" || !/^[wr]\d+$/.test(properties.osm_id)
      || !["way", "relation"].includes(properties.osm_type as string) || properties.osm_id[0] !== (properties.osm_type === "way" ? "w" : "r")
      || ids.has(properties.osm_id) || typeof properties.area_ha !== "number" || !Number.isFinite(properties.area_ha) || properties.area_ha < 0
      || properties.license !== "ODbL" || properties.attribution !== "© OpenStreetMap contributors") fail("CEMETERY_OSM_ROW_INVALID");
    ids.add(properties.osm_id);
    return {
      record_id: properties.osm_id, osm_id: properties.osm_id, osm_type: properties.osm_type,
      name: nullableString(properties.name), landuse: nullableString(properties.landuse), amenity: nullableString(properties.amenity),
      religion: nullableString(properties.religion), denomination: nullableString(properties.denomination), area_ha: properties.area_ha,
      geometry: multi(feature.geometry),
    };
  });
}

export const cemeteryOsmAdapter: QueryAdapter = {
  descriptor: cemeteryOsmDescriptor, allowedParameters: {},
  read: (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: QueryReadContext): Promise<AdapterReadResult> => {
    if (!context?.bbox) fail("BBOX_REQUIRED");
    return withLoading("research:cemetery-osm-owner", "讀取 OpenStreetMap 墓地範圍", (async () => {
      const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: signal ?? AbortSignal.timeout(15_000) });
      if (!response.ok || !response.body) fail("CEMETERY_OSM_ASSET_UNAVAILABLE");
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_BYTES) fail("CEMETERY_OSM_ASSET_TOO_LARGE");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== PROCESSED_BYTES || bytes.byteLength > MAX_BYTES || await sha256(bytes) !== PROCESSED_SHA256) fail("CEMETERY_OSM_ASSET_MISMATCH");
      let source: unknown;
      try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("CEMETERY_OSM_COLLECTION_INVALID"); }
      const rows = parseRows(source);
      const receipt: SourceReceipt = { sourceId: cemeteryOsmDescriptor.datasetId, version: `processed-sha256:${PROCESSED_SHA256}`, checksumSha256: PROCESSED_SHA256, reference: URL, acquiredAt: new Date().toISOString() };
      return { rows, sourceRefs: [receipt], coverage: cemeteryOsmDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
    })());
  },
};
