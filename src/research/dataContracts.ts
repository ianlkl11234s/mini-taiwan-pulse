export type DatasetKind = "point" | "event" | "admin_statistic" | "grid";
export type RecordGrain = "place" | "event" | "admin_statistic" | "grid_cell";
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
  versions: readonly { versionId: string; observedAt: string | null; availableAt: string | null; checksumSha256: string | null; mutable: boolean }[];
  source: { publisher: string; reference: string; lineage: string };
  accessPolicy: { mode: "public" | "authenticated"; maxRowsPerQuery: number; maxScanRows: number };
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
  totalMatched: number;
  returned: number;
  displayTruncated: boolean;
  analysisComplete: boolean;
  excludedByReason: Record<string, number>;
  rows: readonly Row[];
  cost: { rowsScanned: number; bytesScanned: number | null; downloadedBytes: number | null; requests: number | null; cacheHit: boolean | null };
  expiresAt: string | null;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

export function assertDatasetDescriptor(value: DatasetDescriptor): void {
  if (!SAFE_ID.test(value.datasetId) || !SAFE_ID.test(value.adapterId)) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!value.label || !value.description || !value.source.publisher || !value.source.reference || !value.source.lineage) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!Number.isInteger(value.accessPolicy.maxRowsPerQuery) || value.accessPolicy.maxRowsPerQuery < 1 || value.accessPolicy.maxRowsPerQuery > 1000) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (!Number.isInteger(value.accessPolicy.maxScanRows) || value.accessPolicy.maxScanRows < value.accessPolicy.maxRowsPerQuery || value.accessPolicy.maxScanRows > 100_000) throw new Error("INVALID_DATASET_DESCRIPTOR");
  const names = new Set<string>();
  for (const field of value.fields) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field.name) || names.has(field.name)) throw new Error("INVALID_DATASET_DESCRIPTOR");
    if (field.nullable && !field.nullMeaning) throw new Error("INVALID_DATASET_DESCRIPTOR");
    names.add(field.name);
  }
  if (!value.primaryKey.length || value.primaryKey.some(key => !names.has(key))) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.versions.length > 100 || value.versions.some(version => !SAFE_ID.test(version.versionId)
    || version.observedAt !== null && !Number.isFinite(Date.parse(version.observedAt))
    || version.availableAt !== null && !Number.isFinite(Date.parse(version.availableAt))
    || version.checksumSha256 !== null && !/^[0-9a-f]{64}$/.test(version.checksumSha256))) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.geometry.type === "none" && (value.geometry.crs !== null || value.geometry.role !== "none" || value.geometry.spatialAnalysisEligible)) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.geometry.role !== "actual" && value.geometry.spatialAnalysisEligible) throw new Error("INVALID_DATASET_DESCRIPTOR");
  if (value.timeFields.some(field => !names.has(field.name))) throw new Error("INVALID_DATASET_DESCRIPTOR");
}
