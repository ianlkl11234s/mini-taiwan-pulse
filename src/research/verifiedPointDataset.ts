import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

type SelectionValue = Exclude<Scalar, null> | null;

/** Compiled source contract only; callers never supply a runtime URL or selector. */
export type VerifiedPointDatasetConfig = Readonly<{
  datasetId: string;
  label: string;
  description: string;
  sourceUrl: string;
  expectedSha256: string;
  expectedSourceRows: number;
  expectedSelectedRows: number;
  selection: Readonly<Record<string, SelectionValue>>;
  fields: readonly DatasetField[];
  publisher: string;
  license: string;
  precision: string;
}>;

function fail(code: string): never { throw new Error(code); }
function rootAssetUrl(value: string): boolean { return /^\/(?:[A-Za-z0-9_][A-Za-z0-9._-]*\/)*[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(value) && !value.includes("//"); }
function hash(value: string): boolean { return /^[a-f0-9]{64}$/.test(value); }
function positive(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }

function descriptor(config: VerifiedPointDatasetConfig): DatasetDescriptor {
  const fields = config.fields;
  const names = new Set(fields.map(field => field.name));
  if (!rootAssetUrl(config.sourceUrl) || !hash(config.expectedSha256) || !positive(config.expectedSourceRows) || !positive(config.expectedSelectedRows)
    || config.expectedSelectedRows > config.expectedSourceRows || !config.datasetId || !config.label || !config.description || !config.publisher || !config.license || !config.precision
    || !names.has("record_id") || !names.has("geometry") || fields.some(field => field.name === "record_id" && (field.type !== "string" || field.nullable) || field.name === "geometry" && (field.type !== "json" || field.nullable))
    || Object.keys(config.selection).length === 0 || Object.keys(config.selection).some(field => !names.has(field))) fail("INVALID_VERIFIED_POINT_CONFIG");
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: config.datasetId, label: config.label, description: config.description,
    layerRefs: [], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "actual", precision: config.precision, spatialAnalysisEligible: true }, timeFields: [],
    coverage: `${config.expectedSelectedRows} selected actual Point records from ${config.expectedSourceRows} verified source records; selection=${JSON.stringify(config.selection)}; observed period unknown.`,
    license: config.license, valueSemantics: DEFAULT_VALUE_SEMANTICS,
    versions: [{ versionId: `sha256:${config.expectedSha256}`, observedAt: null, availableAt: null, checksumSha256: config.expectedSha256, mutable: false }],
    source: { publisher: config.publisher, reference: config.sourceUrl, lineage: "fixed source bytes -> SHA/count validation -> fixed equality selection; excluded records remain outside actual-geometry scope" },
    access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: fields.filter(field => field.name !== "geometry").map(field => field.name), supportsBbox: true, maxRowsPerQuery: Math.min(100, config.expectedSourceRows), maxScanRows: config.expectedSourceRows, maxSourceBytes: 8 * 1024 * 1024 }),
    supportedOperations: ["query_records", "nearest", "aggregate"], adapterId: "verified-point-source-v1",
  };
}

function sameSelection(row: Record<string, unknown>, selection: Readonly<Record<string, SelectionValue>>): boolean {
  return Object.entries(selection).every(([field, value]) => row[field] === value);
}

/** Materializes a pre-verified actual-geometry subset without altering its source record IDs or loader receipts. */
export function createVerifiedPointDatasetAdapter(config: VerifiedPointDatasetConfig): QueryAdapter {
  const dataDescriptor = descriptor(config);
  const safeFields = config.fields.map(field => field.name).filter(name => name !== "record_id" && name !== "geometry");
  return createPointDatasetAdapter(dataDescriptor, async (_parameters, signal): Promise<AdapterSnapshot> => {
    const snapshot = await loadPointDataset({ datasetId: config.datasetId, url: config.sourceUrl, idField: "record_id", safeFields }, { signal });
    if (snapshot.checksumSha256 !== config.expectedSha256) fail("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
    const sourceRows = snapshot.rows.length + Object.values(snapshot.exclusions).reduce((total, count) => total + count, 0);
    if (sourceRows !== config.expectedSourceRows) fail("VERIFIED_POINT_SOURCE_COUNT_MISMATCH");
    const rows = snapshot.rows.filter(row => sameSelection(row, config.selection));
    if (rows.length !== config.expectedSelectedRows) fail("VERIFIED_POINT_SELECTION_COUNT_MISMATCH");
    const exclusions = { ...snapshot.exclusions, excluded_by_selection: snapshot.rows.length - rows.length };
    const source: SourceReceipt = { sourceId: config.datasetId, version: `sha256:${config.expectedSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: snapshot.checksumSha256, reference: config.sourceUrl };
    return { rows, source, coverage: dataDescriptor.coverage, freshness: "unknown", exclusions, rowsScanned: sourceRows, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  });
}
