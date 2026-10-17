import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { withLoading } from "../lib/loadingRegistry";

const SOURCE_SHA256 = "ecf59329d4812d55bf3f8b1cc296ab94b3cfc994dcc9da5cea866f9af496d330";
const SIDECAR_SHA256 = "70b06d90b13bf46d35fa13864b1f5fa7ecc9e829cce5c6757929b35b0369320c";
const URL = "/__local-research-owner-only/company-capital-grid/company-capital-grid-1500m-owner-202608.geojson";
const MAX_BYTES = 8 * 1024 * 1024;
const SOURCE_COUNT = 5_745;
const COMPANY_COUNT_TOTAL = 654_165;
const CAPITAL_SUM_TOTAL = 40_627_610_824_468;
const fields: readonly DatasetField[] = [
  { name: "grid_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "capital_sum", type: "number", nullable: false, nullMeaning: null, unit: "TWD" },
  { name: "n_companies", type: "number", nullable: false, nullMeaning: null, unit: "companies" },
  { name: "capital_median", type: "number", nullable: true, nullMeaning: "All companies in this occupied grid have missing capital amounts; it is not zero capital.", unit: "TWD" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const companyCapitalGridOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-company-capital-grid-1500m-owner-202608", label: "公司資本額 1.5km 格網（202608 owner-only）",
  description: "5,745 個 occupied-only 1.5km 格網的公司登記資本額聚合。可用 bbox 查相交格網，或以 grid_id 查公司數、資本額總和與非空資本中位數；不是公司點位、店家、工廠、行政區統計、目前公司狀態或可達性。150m／450m 原檔分別 33MB／9.9MB，仍需安全分片，故本 reader 只提供完整且在 8MB 上限內的 1.5km 尺度。",
  layerRefs: ["companyCapitalGrid"], kind: "grid", recordGrain: "grid_cell", primaryKey: ["grid_id"], fields,
  geometry: { type: "Polygon", crs: "EPSG:4326", role: "generalized", precision: "EPSG:3826 canonical 1.5km (10×10 of 150m) occupied-only grid transformed to WGS84; boundaries are analytical cells, not company premises or administrative boundaries.", spatialAnalysisEligible: false },
  timeFields: [], coverage: "202608 657,882 source rows: excluded dead_or_abnormal 1,152 and invalid_coordinate 2,565, then 654,165 released companies aggregated into 5,745 nonempty 1.5km cells. Omitted cells are outside the occupied-only output and do not establish zero companies or zero capital.",
  license: "RIGHTS_HOLD for public redistribution: processed manifest records OGDL-Taiwan-1.0, but the 118-member upstream source-matrix receipts have not all been rechecked in this slice. Localhost owner-only only.",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "capital_median=null with capital_sum=0 occurs in three occupied cells where all capital values are missing; it is not a zero amount. A missing cell is not a zero-company observation.", stale: "202608 is a fixed monthly snapshot and does not prove a company is current, active at the address, or operating in the cell." },
  versions: [{ versionId: `202608-grid1500-source-sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-18", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "經濟部商業發展署 GCIS", reference: `/research/company-capital-grid/source-identity/sha256-${SOURCE_SHA256}`, lineage: `118 regional×industry company_stock source matrix -> 202608 company_stock SHA c3a191b2…e900c -> status/coordinate exclusions -> EPSG:3826 150m grid -> nested 1.5km aggregation -> source GeoJSON SHA ecf593…6d330 -> safe-field localhost owner-only sidecar SHA ${SIDECAR_SHA256}.` },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["grid_id"], supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: SOURCE_COUNT, maxSourceBytes: MAX_BYTES }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "company-capital-grid-owner-1500m-v1",
};

function fail(code: string): never { throw new Error(code); }
function validGeometry(value: unknown): value is Record<string, unknown> {
  const ring = (value as { coordinates?: unknown })?.coordinates as unknown[] | undefined;
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "Polygon" && Array.isArray(ring) && ring.length === 1 && Array.isArray(ring[0]) && ring[0].length === 5);
}
async function digest(bytes: Uint8Array): Promise<string> { const value = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }

async function read(): Promise<AdapterReadResult> {
  return withLoading("research:company-capital-grid-owner", "公司資本額 1.5km 格網", (async () => {
    const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body) fail("COMPANY_CAPITAL_GRID_OWNER_ASSET_UNAVAILABLE");
    const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.byteLength > MAX_BYTES || await digest(bytes) !== SIDECAR_SHA256) fail("COMPANY_CAPITAL_GRID_OWNER_ASSET_MISMATCH");
    const collection = JSON.parse(new TextDecoder().decode(bytes)) as { type?: unknown; features?: unknown };
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("COMPANY_CAPITAL_GRID_OWNER_COLLECTION_INVALID");
    const ids = new Set<string>(); let companies = 0, capital = 0, nullMedians = 0;
    const rows = collection.features.map((value, ordinal) => {
      const feature = value as { type?: unknown; sourceOrdinal?: unknown; properties?: Record<string, unknown>; geometry?: unknown }; const p = feature.properties;
      if (feature.type !== "Feature" || feature.sourceOrdinal !== ordinal || !p || typeof p.grid_id !== "string" || !/^G1500_-?\d+_-?\d+$/.test(p.grid_id) || ids.has(p.grid_id)
        || !Number.isSafeInteger(p.capital_sum) || (p.capital_sum as number) < 0 || !Number.isSafeInteger(p.n_companies) || (p.n_companies as number) < 1
        || !(p.capital_median === null || typeof p.capital_median === "number" && Number.isFinite(p.capital_median) && p.capital_median > 0) || !validGeometry(feature.geometry)) fail("COMPANY_CAPITAL_GRID_OWNER_ROW_INVALID");
      if ((p.capital_sum === 0) !== (p.capital_median === null)) fail("COMPANY_CAPITAL_GRID_OWNER_NULL_SEMANTICS_MISMATCH");
      ids.add(p.grid_id); companies += p.n_companies as number; capital += p.capital_sum as number; if (p.capital_median === null) nullMedians++;
      return { grid_id: p.grid_id, capital_sum: p.capital_sum, n_companies: p.n_companies, capital_median: p.capital_median, geometry: feature.geometry as Record<string, unknown> };
    });
    if (companies !== COMPANY_COUNT_TOTAL || capital !== CAPITAL_SUM_TOTAL || nullMedians !== 3) fail("COMPANY_CAPITAL_GRID_OWNER_CONSERVATION_MISMATCH");
    const source: SourceReceipt = { sourceId: companyCapitalGridOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, checksumSha256: SOURCE_SHA256, reference: companyCapitalGridOwnerDescriptor.source.reference, acquiredAt: new Date().toISOString() };
    return { rows, sourceRefs: [source], coverage: companyCapitalGridOwnerDescriptor.coverage, freshness: "stale", exclusions: { dead_or_abnormal: 1_152, invalid_coordinate: 2_565, capital_median_missing: 3 }, rowsScanned: rows.length, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
  })());
}

export const companyCapitalGridOwnerAdapter: QueryAdapter = { descriptor: companyCapitalGridOwnerDescriptor, allowedParameters: {}, read: () => read() };
