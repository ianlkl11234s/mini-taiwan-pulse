import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry, type MultiPolygonGeometry } from "./spatialKernel";

const ASSET_URL = "/research/education/school_district_senior_full.geojson";
const RAW_SHA256 = "c8d541dc97d294717ae4d82dd29f5329e5e47fc975908f443499d6b5fdf84449";
const PROCESSED_SHA256 = "c3b4df7dee7639dfe18e89134e2dd418b1a552639e0cad51b2579071c996e339";
const DISPLAY_SHA256 = "8df98c6b47f9cc93c677e63d05e87edc506305bc5ac77d18e3eef9a83b61d287";
const BYTES = 12_238_327;
const ROWS = 15;
const MAX_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

type Row = Record<string, unknown>;
type ObjectValue = Record<string, unknown>;
export type SeniorSchoolDistrictFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let cachedSnapshot: { rows: Row[]; acquiredAt: string } | null = null;

const fields: readonly DatasetField[] = [
  { name: "district", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "district_no", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "counties", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "county_count", type: "number", nullable: false, nullMeaning: null, unit: "counties" },
  { name: "cross_district_rules", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "rule_row_count", type: "number", nullable: false, nullMeaning: null, unit: "raw CSV rows" },
  { name: "area_km2", type: "number", nullable: false, nullMeaning: null, unit: "km² (dissolved county-boundary proxy)" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const seniorSchoolDistrictDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "eduDistrictSenior", label: "高中就學區（115 學年度縣市級）",
  description: "115 學年度高中就學區原始名冊的 15 個就學區，依涵蓋縣市 dissolve 為完整 Polygon/MultiPolygon。面界是縣市邊界代理；跨區就讀規則保留為文字，未被解析為空間範圍。",
  layerRefs: ["eduDistrictSenior"], kind: "polygon", recordGrain: "feature", primaryKey: ["district"], fields,
  geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "proxy", precision: "完整處理後縣市界 dissolve 面；Polygon 以單部 MultiPolygon 表示。這是就學區的縣市級範圍代理，不能表示實際招生邊界、跨區條款範圍、學校服務範圍、最近學校、距離或可達性。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "115 學年度原始 CSV 34 列，彙整為 15 個就學區並涵蓋 22 縣市。缺少區域僅表示不在此固定學年度名冊，不能推定沒有就學區、跨區規則或招生資格。",
  license: "政府資料開放授權條款第1版（OGDL-Taiwan-1.0）。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "所有公開欄位與幾何均為必填；null 會被拒絕，不會以推定值補齊。", missing: "本來源只涵蓋 115 學年度的 15 個縣市級就學區；缺少面或規則不代表沒有就學區、招生資格或跨區安排。", stale: "固定 2026-08-07 處理快照。每學年度可能變動，不能主張目前招生名額、資格、開放狀態或後續規則。" },
  versions: [{ versionId: `processed-sha256:${PROCESSED_SHA256}`, observedAt: null, availableAt: "2026-08-07", checksumSha256: PROCESSED_SHA256, mutable: false }],
  source: { publisher: "教育部國民及學前教育署", reference: "https://www.k12ea.gov.tw/files/common_unit/bb55e4c6-ed86-4860-b740-30eb8e57c3bb/doc/115學年度各直轄市、縣（市）就學區及共同就學區劃定範圍.csv", lineage: `115.csv sha256:${RAW_SHA256} (34 rows) -> county-boundary dissolve -> analytics processed full GeoJSON sha256:${PROCESSED_SHA256} (${BYTES} bytes, 15 features) -> byte-identical Mini full reader asset. The frontend display simplification is a separate web asset sha256:${DISPLAY_SHA256}; it is not used for this reader.` },
  access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: ["district", "district_no", "counties", "county_count"], supportsBbox: true, maxRowsPerQuery: ROWS, maxScanRows: ROWS, maxResponseBytes: 1024 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
  supportedOperations: ["query_records"], adapterId: "senior-school-district-full-proxy-v1",
};

function fail(code: string): never { throw new Error(code); }
function object(value: unknown): value is ObjectValue { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
async function digest(bytes: Uint8Array): Promise<string> { const value = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function multi(value: unknown): MultiPolygonGeometry {
  const geometry = parseSpatialGeometry(value);
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  if (geometry.type === "MultiPolygon") return geometry;
  return fail("SENIOR_SCHOOL_DISTRICT_GEOMETRY_INVALID");
}

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) !== BYTES || Number(declared) > MAX_BYTES)) fail("SENIOR_SCHOOL_DISTRICT_ASSET_MISMATCH");
  if (!response.body) fail("SENIOR_SCHOOL_DISTRICT_ASSET_UNAVAILABLE");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); fail("SENIOR_SCHOOL_DISTRICT_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Validates the unsimplified 115-school-year county-boundary proxy before exposing any row. */
export function validateSeniorSchoolDistrictSnapshot(source: unknown): Row[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== ROWS) fail("SENIOR_SCHOOL_DISTRICT_COLLECTION_INVALID");
  const districts = new Set<string>(), numbers = new Set<string>(); let counties = 0, rules = 0, area = 0;
  const rows = collection.features.map(raw => {
    const feature = raw as { type?: unknown; properties?: unknown; geometry?: unknown };
    if (feature?.type !== "Feature" || !object(feature.properties) || Object.keys(feature.properties).length !== fields.length - 1) fail("SENIOR_SCHOOL_DISTRICT_ROW_INVALID");
    const p = feature.properties, district = p.district, districtNo = p.district_no, countyList = p.counties;
    const countyCount = p.county_count, crossRules = p.cross_district_rules, ruleRows = p.rule_row_count, areaKm2 = p.area_km2;
    if (typeof district !== "string" || !district || districts.has(district) || typeof districtNo !== "string" || !/^(?:[1-9]|1[0-5])$/.test(districtNo) || numbers.has(districtNo)
      || typeof countyList !== "string" || !countyList || typeof countyCount !== "number" || !Number.isInteger(countyCount) || countyCount < 1 || countyCount > 3 || countyList.split("、").length !== countyCount
      || typeof crossRules !== "string" || !crossRules || typeof ruleRows !== "number" || !Number.isInteger(ruleRows) || ruleRows < 1 || ruleRows > 6
      || typeof areaKm2 !== "number" || !Number.isFinite(areaKm2) || areaKm2 <= 0) fail("SENIOR_SCHOOL_DISTRICT_ROW_INVALID");
    districts.add(district); numbers.add(districtNo); counties += countyCount; rules += ruleRows; area += areaKm2;
    return { district, district_no: districtNo, counties: countyList, county_count: countyCount, cross_district_rules: crossRules, rule_row_count: ruleRows, area_km2: areaKm2, geometry: multi(feature.geometry) };
  });
  if (districts.size !== ROWS || numbers.size !== ROWS || counties !== 22 || rules !== 34 || Math.abs(area - 36_848.86) > 0.001 || !districts.has("基北區") || !districts.has("中投區")) fail("SENIOR_SCHOOL_DISTRICT_COVERAGE_INVALID");
  return rows;
}

export function createSeniorSchoolDistrictDatasetAdapter(fetcher: SeniorSchoolDistrictFetch = fetch): QueryAdapter {
  return {
    descriptor: seniorSchoolDistrictDescriptor, allowedParameters: {},
    async read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterReadResult> {
      return withLoading("research:senior-school-district", "讀取高中就學區完整縣市級範圍", (async () => {
        const cacheHit = cachedSnapshot !== null;
        if (!cachedSnapshot) {
          const activeSignal = signal ?? AbortSignal.timeout(TIMEOUT_MS);
          const response = await fetcher(ASSET_URL, { credentials: "same-origin", redirect: "error", signal: activeSignal });
          if (!response.ok) fail("SENIOR_SCHOOL_DISTRICT_ASSET_UNAVAILABLE");
          const bytes = await boundedBytes(response, activeSignal);
          if (bytes.byteLength !== BYTES || await digest(bytes) !== PROCESSED_SHA256) fail("SENIOR_SCHOOL_DISTRICT_SOURCE_MISMATCH");
          let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("SENIOR_SCHOOL_DISTRICT_JSON_INVALID"); }
          cachedSnapshot = { rows: validateSeniorSchoolDistrictSnapshot(source), acquiredAt: new Date().toISOString() };
        }
        const { rows, acquiredAt } = cachedSnapshot;
        const sourceRefs: SourceReceipt[] = [
          { sourceId: seniorSchoolDistrictDescriptor.datasetId, version: `processed-sha256:${PROCESSED_SHA256}`, checksumSha256: PROCESSED_SHA256, reference: ASSET_URL, acquiredAt },
        ];
        return { rows, sourceRefs, coverage: seniorSchoolDistrictDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: ROWS, bytesScanned: BYTES, downloadedBytes: cacheHit ? 0 : BYTES, requests: cacheHit ? 0 : 1, cacheHit, expiresAt: null };
      })());
    },
  };
}

export function clearSeniorSchoolDistrictSnapshotCache(): void { cachedSnapshot = null; }

export const seniorSchoolDistrictAdapter = createSeniorSchoolDistrictDatasetAdapter();
