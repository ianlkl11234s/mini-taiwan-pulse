export type DatasetKind = "point" | "event" | "admin_statistic" | "grid" | "polygon";
export type RecordGrain = "place" | "event" | "admin_statistic" | "grid_cell" | "feature";
export type ResultGrain = RecordGrain | "aggregate" | "joined" | "metric" | "series";
export type GeometryRole = "actual" | "proxy" | "centroid" | "generalized" | "none";
export type FieldType = "string" | "number" | "boolean" | "datetime" | "json";
export type Scalar = string | number | boolean | null;

export interface DatasetField {
  name: string;
  type: FieldType;
  nullable: boolean;
  nullMeaning: string | null;
  unit: string | null;
}

export interface ValueSemantics {
  missing: string;
  null: string;
  suppressed: string;
  zero: string;
  stale: string;
  closed: string;
}

export const DEFAULT_VALUE_SEMANTICS: ValueSemantics = {
  missing: "Record or field is absent from the declared source scope; not zero.",
  null: "Source explicitly provides null or no value; interpret using the field nullMeaning.",
  suppressed: "Source withheld the value; never convert to zero.",
  zero: "Observed numeric zero is a valid value only when source status says observed.",
  stale: "Known snapshot is older than its declared freshness contract; values remain historical, not current.",
  closed: "Source or authorization is closed; absence of a response is not absence of data.",
};

export interface AccessDescriptor {
  mode: "public" | "owner_only";
  method: "static_asset" | "pmtiles_sidecar" | "rpc" | "statistics_snapshot" | "owner_range" | "local_asset";
  discovery: { search: boolean; describe: boolean };
  query: {
    enabled: boolean;
    fields: readonly string[];
    filters: readonly string[];
    supportsCursor: boolean;
    supportsBbox: boolean;
    timeFields: readonly string[];
  };
  limits: {
    maxRowsPerQuery: number;
    maxScanRows: number;
    maxResponseBytes: number;
    maxSourceBytes: number | null;
    timeoutMs: number;
  };
  authorization: { recheckOnEachOperation: true; revokeImmediately: true };
}

export function boundedAccess(input: {
  mode: AccessDescriptor["mode"];
  method: AccessDescriptor["method"];
  fields: readonly string[];
  filters?: readonly string[];
  timeFields?: readonly string[];
  supportsBbox?: boolean;
  maxRowsPerQuery: number;
  maxScanRows: number;
  maxResponseBytes?: number;
  maxSourceBytes?: number | null;
  timeoutMs?: number;
  queryEnabled?: boolean;
}): AccessDescriptor {
  const queryEnabled = input.queryEnabled ?? true;
  return {
    mode: input.mode,
    method: input.method,
    discovery: { search: true, describe: true },
    query: {
      enabled: queryEnabled,
      fields: queryEnabled ? input.fields : [],
      filters: queryEnabled ? input.filters ?? [] : [],
      supportsCursor: queryEnabled,
      supportsBbox: queryEnabled && (input.supportsBbox ?? false),
      timeFields: queryEnabled ? input.timeFields ?? [] : [],
    },
    limits: {
      maxRowsPerQuery: input.maxRowsPerQuery,
      maxScanRows: input.maxScanRows,
      maxResponseBytes: input.maxResponseBytes ?? 24 * 1024,
      maxSourceBytes: input.maxSourceBytes ?? null,
      timeoutMs: input.timeoutMs ?? 15_000,
    },
    authorization: { recheckOnEachOperation: true, revokeImmediately: true },
  };
}

export interface DatasetDescriptor {
  schemaVersion: "pulse-dataset/0.1";
  datasetId: string;
  label: string;
  description: string;
  layerRefs: readonly string[];
  kind: DatasetKind;
  recordGrain: RecordGrain;
  primaryKey: readonly string[];
  fields: readonly DatasetField[];
  geometry: {
    type: "Point" | "Polygon" | "MultiPolygon" | "none";
    crs: "EPSG:4326" | null;
    role: GeometryRole;
    precision: string;
    spatialAnalysisEligible: boolean;
  };
  timeFields: readonly { name: string; role: "occurred" | "published" | "observed" | "available" | "period_start" | "period_end"; timezone: string }[];
  coverage: string;
  license: string;
  valueSemantics: ValueSemantics;
  versions: readonly { versionId: string; observedAt: string | null; availableAt: string | null; checksumSha256: string | null; mutable: boolean }[];
  source: { publisher: string; reference: string; lineage: string };
  access: AccessDescriptor;
  supportedOperations: readonly ("query_records" | "nearest" | "aggregate")[];
  adapterId: string;
}

export interface SourceReceipt {
  sourceId: string;
  version: string;
  acquiredAt: string;
  checksumSha256: string | null;
  reference: string;
}

export interface ResultEnvelope<Row extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: "pulse-query-result/0.1";
  resultId: string;
  queryHash: string;
  datasetId: string;
  executionStatus: "complete";
  method: { operation: "query_records" | "spatial_query" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series"; version: "0.1"; parameters: Record<string, unknown> };
  sourceRefs: readonly SourceReceipt[];
  lineage?: Readonly<Record<string, unknown>>;
  recordGrain: ResultGrain;
  countGrain: RecordGrain;
  units: Record<string, string | null>;
  coverage: string;
  freshness: "current" | "stale" | "unknown";
  semantics: ValueSemantics;
  totalMatched: number;
  returned: number;
  displayTruncated: boolean;
  analysisComplete: boolean;
  excludedByReason: Record<string, number>;
  rows: readonly Row[];
  cost: { rowsScanned: number; bytesScanned: number | null; downloadedBytes: number | null; requests: number | null; cacheHit: boolean | null };
  access: { mode: AccessDescriptor["mode"]; method: AccessDescriptor["method"]; authorized: true };
  limits: { maxRows: number; maxScanRows: number; maxResponseBytes: number; nextCursor: string | null };
  expiresAt: string | null;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

export function assertDatasetDescriptor(value: DatasetDescriptor): void {
  if (!SAFE_ID.test(value.datasetId) || !SAFE_ID.test(value.adapterId)) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!value.label || !value.description || !value.source.publisher || !value.source.reference || !value.source.lineage) throw new Error("INVALID_DATASET_DESCRIPTOR");
  const { access } = value;
  if (!access || !["public", "owner_only"].includes(access.mode) || !access.authorization.recheckOnEachOperation || !access.authorization.revokeImmediately) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!Number.isInteger(access.limits.maxRowsPerQuery) || access.limits.maxRowsPerQuery < 1 || access.limits.maxRowsPerQuery > 1000) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!Number.isInteger(access.limits.maxScanRows) || access.limits.maxScanRows < access.limits.maxRowsPerQuery || access.limits.maxScanRows > 100_000) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!Number.isInteger(access.limits.maxResponseBytes) || access.limits.maxResponseBytes < 1 || access.limits.maxResponseBytes > 1024 * 1024) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!Number.isInteger(access.limits.timeoutMs) || access.limits.timeoutMs < 100 || access.limits.timeoutMs > 60_000) throw new Error("INVALID_DATASET_DESCRIPTOR");
  const names = new Set<string>();
  for (const field of value.fields) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field.name) || names.has(field.name)) throw new Error("INVALID_DATASET_DESCRIPTOR");
    if (field.nullable && !field.nullMeaning) throw new Error("INVALID_DATASET_DESCRIPTOR");
    names.add(field.name);
  }
  if ((value.access.query.enabled && !value.primaryKey.length) || value.primaryKey.some(key => !names.has(key))) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.versions.length > 100 || value.versions.some(version => !SAFE_ID.test(version.versionId)
    || version.observedAt !== null && !Number.isFinite(Date.parse(version.observedAt))
    || version.availableAt !== null && !Number.isFinite(Date.parse(version.availableAt))
    || version.checksumSha256 !== null && !/^[0-9a-f]{64}$/.test(version.checksumSha256))) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.geometry.type === "none" && (value.geometry.crs !== null || value.geometry.role !== "none" || value.geometry.spatialAnalysisEligible)) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.geometry.role !== "actual" && value.geometry.spatialAnalysisEligible) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.timeFields.some(field => !names.has(field.name))) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if ([...access.query.fields, ...access.query.filters, ...access.query.timeFields].some(field => !names.has(field))) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (access.query.supportsBbox && !(value.geometry.type === "Point" && value.geometry.role === "actual" && value.geometry.spatialAnalysisEligible)) throw new Error("INVALID_DATASET_DESCRIPTOR");
}
