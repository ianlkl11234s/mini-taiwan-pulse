import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry, type MultiPolygonGeometry } from "./spatialKernel";

const ASSET_URL = "/__local-research-owner-only/school-district-k12/school_district_k12_20260809.geojson";
const PROCESSED_SHA256 = "b461e2ec305880a579874068ef955e11734acb4567718916e20be09c969584b4";
const BYTES = 21_710_315;
const ROWS = 860;
const MAX_BYTES = 24 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const RAW_RECEIPTS = [
  "taipei_elementary.csv:71ce3b938758e45f4026c2dfb09c2e48b7cf4527e335ecbcfe58ac584baf7be4",
  "taipei_junior.csv:56c2c48798336357a0c744bd67258cf175651c05a5ca51e8d3cdf33784ad9539",
  "newtaipei_elementary.csv:a65c421a48931d58b8beea8e27cd869a5416e21820bd723d73a4f27bd1a842aa",
  "newtaipei_junior.csv:67abfc0a57438cf9bcae51ad3561f6ebdbd151189d3c65c22200e96e1e64a3a0",
  "taichung_elementary.csv:9eb83ed1446c5e2a83f9432b01b8da6a387ffa098701e4afffc4e32418ad2311",
  "taichung_junior.csv:ee666d107b8229efc64c1b9f3a5711a3ba4f6fb657eede92a3c06b6391711108",
  "hsinchu_elementary.xlsx:60ddbb5b621fcfc72bbdbbf161629dc25291de676eeb3bddc5791dc74d5ccda4",
  "hsinchu_junior.xlsx:716fe6ce5dfe03dd12d97e8ef445577a640eed20e28acc9080b862ccb1b1c894",
] as const;

type Level = "elementary" | "junior";
type Row = Record<string, unknown>;
type ObjectValue = Record<string, unknown>;
export type SchoolDistrictK12Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const fields: readonly DatasetField[] = [
  { name: "district_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "level", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "school", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "precision", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "is_shared", type: "boolean", nullable: false, nullMeaning: null, unit: null },
  { name: "village_count", type: "number", nullable: false, nullMeaning: null, unit: "villages" },
  { name: "villages", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "n_full", type: "number", nullable: false, nullMeaning: null, unit: "villages" },
  { name: "n_partial", type: "number", nullable: false, nullMeaning: null, unit: "villages" },
  { name: "lin_specs", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "area_km2", type: "number", nullable: false, nullMeaning: null, unit: "km² (village-polygon proxy)" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

function descriptor(level: Level): DatasetDescriptor {
  const elementary = level === "elementary";
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: elementary ? "eduDistrictElementary" : "eduDistrictJunior",
    label: elementary ? "國小學區（四縣市村里代理面）" : "國中學區（四縣市村里代理面）",
    description: `${elementary ? "國小" : "國中"}固定 2026-08-09 處理版。面是公告文字的里名 join 村里界後 dissolve；可查詢相交面，不能以此決定特定地址的入學分發。`,
    layerRefs: [elementary ? "eduDistrictElementary" : "eduDistrictJunior"], kind: "polygon", recordGrain: "feature", primaryKey: ["district_id"], fields,
    geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "proxy", precision: "村里 polygon proxy：village_full 表示整里公告，village_partial 表示至少一里只有部分鄰屬該校卻以整里繪製；共同學區面可以重疊。bbox 僅為面相交，不能保證 point-in-district、地址分發、最近學校或可達性。", spatialAnalysisEligible: false },
    timeFields: [], coverage: `${elementary ? "621 所國小" : "239 所國中"}，僅臺北市、新北市、臺中市、新竹市。860 面共用來源中 village_full 206、village_partial 654；未涵蓋區域或無 bbox 命中不代表沒有學區、學校、招生資格或公告。`,
    license: "HOLD：七個上游資料集的公開再利用權與同版本 PMTiles 發布權尚未驗證；此 SHA-bound reader 僅 localhost owner-only，不能作公開權利主張。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "固定四縣市來源未涵蓋、未 join 的村里或 bbox 無相交，不能解釋為沒有學區或招生資格。", null: "此固定版所有安全欄位與幾何都必填；任何 null 或不合規列會被拒絕。", zero: "n_full 或 n_partial 為 0 表示來源明示該類里數為零，並非缺值；area_km2 不以零補值。", stale: "縣市公告學年度不一致（臺北 110、臺中 112、其餘 114）；2026-08-09 是處理版日期，不能主張目前招生、資格、地址分發或邊界。" },
    versions: [{ versionId: `processed-sha256:${PROCESSED_SHA256}`, observedAt: null, availableAt: "2026-08-09", checksumSha256: PROCESSED_SHA256, mutable: false }],
    source: { publisher: "臺北市、新北市、臺中市、新竹市教育資料來源", reference: ASSET_URL, lineage: `8 raw artifacts from 7 upstream datasets (${RAW_RECEIPTS.join("; ")}) -> village-name join and dissolve -> school_district_k12_20260809.geojson sha256:${PROCESSED_SHA256} (${BYTES} bytes, ${ROWS} features; raw geometry 779 Polygon / 81 MultiPolygon) -> localhost owner-only reader. Upstream license receipts and same-version PMTiles remain HOLD.` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["district_id", "county", "level", "school", "precision", "is_shared"], supportsBbox: true, maxRowsPerQuery: 25, maxScanRows: ROWS, maxResponseBytes: 1024 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `school-district-k12-${level}-owner-v1`,
  };
}

export const schoolDistrictElementaryOwnerDescriptor = descriptor("elementary");
export const schoolDistrictJuniorOwnerDescriptor = descriptor("junior");

let cachedSnapshot: { rows: Row[]; acquiredAt: string } | null = null;
function fail(code: string): never { throw new Error(code); }
function object(value: unknown): value is ObjectValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
async function digest(bytes: Uint8Array): Promise<string> { const value = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) !== BYTES || Number(declared) > MAX_BYTES)) fail("SCHOOL_DISTRICT_K12_ASSET_MISMATCH");
  if (!response.body) fail("SCHOOL_DISTRICT_K12_ASSET_UNAVAILABLE");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { if (signal.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError"); const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); fail("SCHOOL_DISTRICT_K12_TOO_LARGE"); } chunks.push(next.value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function multi(value: unknown): MultiPolygonGeometry {
  const geometry = parseSpatialGeometry(value);
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  if (geometry.type === "MultiPolygon") return geometry;
  return fail("SCHOOL_DISTRICT_K12_GEOMETRY_INVALID");
}

/** Validates the exact 2026-08-09 source before exposing either school level. */
export function validateSchoolDistrictK12Snapshot(source: unknown): Row[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("SCHOOL_DISTRICT_K12_COLLECTION_INVALID");
  const ids = new Set<string>(); let elementary = 0, junior = 0, full = 0, partial = 0, polygons = 0, multipolygons = 0;
  const expected = new Set(fields.slice(0, -1).map(field => field.name));
  const rows = collection.features.map(raw => {
    const feature = raw as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (feature?.type !== "Feature" || !object(feature.properties) || Object.keys(feature.properties).length !== expected.size || Object.keys(feature.properties).some(name => !expected.has(name))) fail("SCHOOL_DISTRICT_K12_ROW_INVALID");
    const p = feature.properties, id = p.district_id, county = p.county, level = p.level, school = p.school, precision = p.precision;
    const isShared = p.is_shared, villageCount = p.village_count, villages = p.villages, nFull = p.n_full, nPartial = p.n_partial, linSpecs = p.lin_specs, areaKm2 = p.area_km2;
    if (typeof id !== "string" || !id || ids.has(id) || typeof county !== "string" || !["臺北市", "新北市", "臺中市", "新竹市"].includes(county)
      || (level !== "elementary" && level !== "junior") || typeof school !== "string" || !school || precision !== "village_full" && precision !== "village_partial"
      || typeof isShared !== "boolean" || typeof villageCount !== "number" || !Number.isInteger(villageCount) || villageCount < 1 || typeof villages !== "string" || !villages
      || typeof nFull !== "number" || !Number.isInteger(nFull) || nFull < 0 || typeof nPartial !== "number" || !Number.isInteger(nPartial) || nPartial < 0 || typeof linSpecs !== "string"
      || typeof areaKm2 !== "number" || !Number.isFinite(areaKm2) || areaKm2 <= 0) fail("SCHOOL_DISTRICT_K12_ROW_INVALID");
    const original = parseSpatialGeometry(feature.geometry); if (original.type === "Polygon") polygons++; else multipolygons++;
    ids.add(id); if (level === "elementary") elementary++; else junior++; if (precision === "village_full") full++; else partial++;
    return { district_id: id, county, level, school, precision, is_shared: isShared, village_count: villageCount, villages, n_full: nFull, n_partial: nPartial, lin_specs: linSpecs, area_km2: areaKm2, geometry: multi(feature.geometry) };
  });
  if (ids.size !== ROWS || elementary !== 621 || junior !== 239 || full !== 206 || partial !== 654 || polygons !== 779 || multipolygons !== 81) fail("SCHOOL_DISTRICT_K12_COVERAGE_INVALID");
  return rows;
}

function adapter(level: Level, sourceDescriptor: DatasetDescriptor, fetcher: SchoolDistrictK12Fetch): QueryAdapter {
  return {
    descriptor: sourceDescriptor, allowedParameters: {},
    async read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterReadResult> {
      return withLoading(`research:school-district-k12-${level}`, `讀取${level === "elementary" ? "國小" : "國中"}學區村里代理面`, (async () => {
        const cacheHit = cachedSnapshot !== null;
        if (!cachedSnapshot) {
          const controller = new AbortController();
          const forwardAbort = () => controller.abort(signal?.reason);
          signal?.addEventListener("abort", forwardAbort, { once: true });
          const timeout = setTimeout(() => controller.abort(new Error("SCHOOL_DISTRICT_K12_TIMEOUT")), TIMEOUT_MS);
          try {
            if (signal?.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError");
            const response = await fetcher(ASSET_URL, { credentials: "same-origin", redirect: "error", signal: controller.signal });
            if (!response.ok) fail("SCHOOL_DISTRICT_K12_ASSET_UNAVAILABLE");
            const bytes = await boundedBytes(response, controller.signal);
            if (bytes.byteLength !== BYTES || await digest(bytes) !== PROCESSED_SHA256) fail("SCHOOL_DISTRICT_K12_SOURCE_MISMATCH");
            let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("SCHOOL_DISTRICT_K12_JSON_INVALID"); }
            cachedSnapshot = { rows: validateSchoolDistrictK12Snapshot(source), acquiredAt: new Date().toISOString() };
          } finally { clearTimeout(timeout); signal?.removeEventListener("abort", forwardAbort); }
        }
        const sourceRefs: SourceReceipt[] = [{ sourceId: sourceDescriptor.datasetId, version: `processed-sha256:${PROCESSED_SHA256}`, checksumSha256: PROCESSED_SHA256, reference: ASSET_URL, acquiredAt: cachedSnapshot.acquiredAt }];
        return { rows: cachedSnapshot.rows.filter(row => row.level === level), sourceRefs, coverage: sourceDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: BYTES, downloadedBytes: cacheHit ? 0 : BYTES, requests: cacheHit ? 0 : 1, cacheHit, expiresAt: null };
      })());
    },
  };
}

const defaultFetch: SchoolDistrictK12Fetch = (...args) => fetch(...args);
export function createSchoolDistrictElementaryOwnerAdapter(fetcher: SchoolDistrictK12Fetch = defaultFetch): QueryAdapter { return adapter("elementary", schoolDistrictElementaryOwnerDescriptor, fetcher); }
export function createSchoolDistrictJuniorOwnerAdapter(fetcher: SchoolDistrictK12Fetch = defaultFetch): QueryAdapter { return adapter("junior", schoolDistrictJuniorOwnerDescriptor, fetcher); }
export function clearSchoolDistrictK12SnapshotCache(): void { cachedSnapshot = null; }
export const schoolDistrictElementaryOwnerAdapter = createSchoolDistrictElementaryOwnerAdapter();
export const schoolDistrictJuniorOwnerAdapter = createSchoolDistrictJuniorOwnerAdapter();
