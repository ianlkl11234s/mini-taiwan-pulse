import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createPointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

type SelectionValue = Exclude<Scalar, null> | null;
type FixedSelection = Readonly<{ fullSource?: false; selection: Readonly<Record<string, SelectionValue>> }>;
type FullSourceSelection = Readonly<{ fullSource: true; selection: Readonly<Record<string, never>> }>;

/** Compiled source contract only; callers never supply a runtime URL or selector. */
export type VerifiedPointDatasetConfig = Readonly<{
  datasetId: string;
  label: string;
  description: string;
  sourceUrl: string;
  expectedSha256: string;
  expectedSourceRows: number;
  expectedSelectedRows: number;
  fields: readonly DatasetField[];
  publisher: string;
  license: string;
  precision: string;
  /** Coordinate meaning from the verified source; proxy points are display/query-only. Defaults to actual. */
  geometryRole?: "actual" | "proxy";
  layerRefs?: readonly string[];
  /** Maps a safe descriptor field to the immutable source property name. */
  sourceFieldMap?: Readonly<Record<string, string>>;
  coverageDescription?: string;
  sourceLineage?: string;
}> & (FixedSelection | FullSourceSelection);

function fail(code: string): never { throw new Error(code); }
function rootAssetUrl(value: string): boolean { return /^\/(?:[A-Za-z0-9_][A-Za-z0-9._-]*\/)*[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(value) && !value.includes("//"); }
function hash(value: string): boolean { return /^[a-f0-9]{64}$/.test(value); }
function positive(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }

function descriptor(config: VerifiedPointDatasetConfig): DatasetDescriptor {
  const fields = config.fields;
  const names = new Set(fields.map(field => field.name));
  const fullSource = config.fullSource === true;
  const geometryRole = config.geometryRole ?? "actual";
  const selectionKeys = Object.keys(config.selection);
  const sourceNames = Object.entries(config.sourceFieldMap ?? {});
  if (!rootAssetUrl(config.sourceUrl) || !hash(config.expectedSha256) || !positive(config.expectedSourceRows) || !positive(config.expectedSelectedRows)
    || config.expectedSelectedRows > config.expectedSourceRows || !config.datasetId || !config.label || !config.description || !config.publisher || !config.license || !config.precision
    || !names.has("record_id") || !names.has("geometry") || fields.some(field => field.name === "record_id" && (field.type !== "string" || field.nullable) || field.name === "geometry" && (field.type !== "json" || field.nullable))
    || (!fullSource && selectionKeys.length === 0) || (fullSource && (selectionKeys.length !== 0 || config.expectedSelectedRows !== config.expectedSourceRows))
    || selectionKeys.some(field => !names.has(field)) || sourceNames.some(([field, source]) => !names.has(field) || field === "record_id" || field === "geometry" || !source.trim())
    || new Set(sourceNames.map(([, source]) => source)).size !== sourceNames.length
    || !["actual", "proxy"].includes(geometryRole)
    || config.coverageDescription !== undefined && !config.coverageDescription.trim() || config.sourceLineage !== undefined && !config.sourceLineage.trim()) fail("INVALID_VERIFIED_POINT_CONFIG");
  const coverage = config.coverageDescription ?? (fullSource
    ? `${config.expectedSourceRows} verified source-coordinate ${geometryRole} Point records; fullSource=true; observed period unknown.`
    : `${config.expectedSelectedRows} selected ${geometryRole} Point records from ${config.expectedSourceRows} verified source records; selection=${JSON.stringify(config.selection)}; observed period unknown.`);
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: config.datasetId, label: config.label, description: config.description,
    layerRefs: config.layerRefs ?? [], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: geometryRole, precision: config.precision, spatialAnalysisEligible: geometryRole === "actual" }, timeFields: [],
    coverage,
    license: config.license, valueSemantics: DEFAULT_VALUE_SEMANTICS,
    versions: [{ versionId: `sha256:${config.expectedSha256}`, observedAt: null, availableAt: null, checksumSha256: config.expectedSha256, mutable: false }],
    source: { publisher: config.publisher, reference: config.sourceUrl, lineage: config.sourceLineage ?? (fullSource ? `fixed source bytes -> SHA/count validation -> all source-coordinate ${geometryRole} Point records${geometryRole === "proxy" ? "; proxy coordinates are ineligible for spatial filtering or nearest analysis" : ""}` : `fixed source bytes -> SHA/count validation -> fixed equality selection; excluded records remain outside ${geometryRole}-geometry scope${geometryRole === "proxy" ? "; proxy coordinates are ineligible for spatial filtering or nearest analysis" : ""}`) },
    access: boundedAccess({ mode: "public", method: "static_asset", fields: fields.map(field => field.name), filters: fields.filter(field => field.name !== "geometry").map(field => field.name), supportsBbox: geometryRole === "actual", maxRowsPerQuery: Math.min(100, config.expectedSourceRows), maxScanRows: config.expectedSourceRows, maxSourceBytes: 8 * 1024 * 1024 }),
    supportedOperations: geometryRole === "actual" ? ["query_records", "nearest", "aggregate"] : ["query_records", "aggregate"], adapterId: "verified-point-source-v1",
  };
}

function sameSelection(row: Record<string, unknown>, selection: Readonly<Record<string, SelectionValue>>): boolean {
  return Object.entries(selection).every(([field, value]) => row[field] === value);
}

/** Materializes a pre-verified Point subset with version-bound SHA/row-index record IDs and unchanged loader receipts. */
export function createVerifiedPointDatasetAdapter(config: VerifiedPointDatasetConfig): QueryAdapter {
  const dataDescriptor = descriptor(config);
  const sourceName = (field: string) => config.sourceFieldMap?.[field] ?? field;
  const safeFields = config.fields.map(field => field.name).filter(name => name !== "record_id" && name !== "geometry").map(sourceName);
  const readSnapshot = async (_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> => {
    const snapshot = await loadPointDataset({ datasetId: config.datasetId, url: config.sourceUrl, idField: "record_id", safeFields }, { signal });
    if (snapshot.checksumSha256 !== config.expectedSha256) fail("VERIFIED_POINT_SOURCE_SHA_MISMATCH");
    const sourceRows = snapshot.rows.length + Object.values(snapshot.exclusions).reduce((total, count) => total + count, 0);
    if (sourceRows !== config.expectedSourceRows) fail("VERIFIED_POINT_SOURCE_COUNT_MISMATCH");
    const mappedRows = snapshot.rows.map(row => Object.fromEntries(Object.entries(row).map(([field, value]) => [
      Object.entries(config.sourceFieldMap ?? {}).find(([, source]) => source === field)?.[0] ?? field,
      value,
    ])));
    const rows = config.fullSource === true ? mappedRows : mappedRows.filter(row => sameSelection(row, config.selection));
    if (rows.length !== config.expectedSelectedRows) fail("VERIFIED_POINT_SELECTION_COUNT_MISMATCH");
    const exclusions = config.fullSource === true ? snapshot.exclusions : { ...snapshot.exclusions, excluded_by_selection: snapshot.rows.length - rows.length };
    const source: SourceReceipt = { sourceId: config.datasetId, version: `sha256:${config.expectedSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: snapshot.checksumSha256, reference: config.sourceUrl };
    return { rows, source, coverage: dataDescriptor.coverage, freshness: "unknown", exclusions, rowsScanned: sourceRows, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
  };
  if (dataDescriptor.geometry.role === "actual") return createPointDatasetAdapter(dataDescriptor, readSnapshot);
  return {
    descriptor: dataDescriptor,
    allowedParameters: {},
    async read(parameters, signal) {
      const snapshot = await readSnapshot(parameters, signal);
      return {
        rows: snapshot.rows,
        sourceRefs: [snapshot.source, ...(snapshot.sourceRefs ?? [])],
        coverage: snapshot.coverage,
        freshness: snapshot.freshness ?? "unknown",
        exclusions: { ...(snapshot.exclusions ?? {}) },
        rowsScanned: snapshot.rowsScanned ?? snapshot.rows.length,
        bytesScanned: snapshot.bytesScanned ?? null,
        downloadedBytes: snapshot.downloadedBytes ?? null,
        requests: snapshot.requests ?? null,
        cacheHit: snapshot.cacheHit ?? null,
        expiresAt: snapshot.expiresAt ?? null,
      };
    },
  };
}
