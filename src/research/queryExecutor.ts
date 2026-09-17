import { assertDatasetDescriptor, type DatasetDescriptor, type ResultEnvelope, type Scalar, type SourceReceipt } from "./dataContracts";

export type QueryFilter =
  | { field: string; op: "eq"; value: Scalar }
  | { field: string; op: "contains"; value: string };

export interface QueryRecordsInput {
  datasetId: string;
  select?: readonly string[];
  filters?: readonly QueryFilter[];
  time?: { field: string; start?: string; end?: string };
  offset?: number;
  limit?: number;
  parameters?: Readonly<Record<string, Scalar>>;
}

export interface AdapterReadResult {
  rows: readonly Record<string, unknown>[];
  sourceRefs: readonly SourceReceipt[];
  lineage?: Readonly<Record<string, unknown>>;
  coverage: string;
  freshness: "current" | "stale" | "unknown";
  exclusions: Record<string, number>;
  rowsScanned: number;
  bytesScanned: number | null;
  downloadedBytes: number | null;
  requests: number | null;
  cacheHit: boolean | null;
  expiresAt: string | null;
}

export interface QueryAdapter {
  descriptor: DatasetDescriptor;
  allowedParameters: Readonly<Record<string, "string" | "number" | "boolean">>;
  read(parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterReadResult>;
}

export interface QueryExecution {
  envelope: ResultEnvelope;
  materializedRows: readonly Record<string, unknown>[];
  descriptor: DatasetDescriptor;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stable(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function integer(value: number | undefined, fallback: number, min: number, max: number, code: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < min || resolved > max) throw new Error(code);
  return resolved;
}

function scalarMatches(actual: unknown, expected: Scalar): boolean {
  return typeof actual === "string" && typeof expected === "string"
    ? actual.normalize("NFKC").replace(/臺/g, "台") === expected.normalize("NFKC").replace(/臺/g, "台")
    : actual === expected;
}

function applyFilter(row: Record<string, unknown>, filter: QueryFilter): boolean {
  const actual = row[filter.field];
  if (filter.op === "eq") return scalarMatches(actual, filter.value);
  return typeof actual === "string" && actual.normalize("NFKC").replace(/臺/g, "台").toLocaleLowerCase().includes(filter.value.normalize("NFKC").replace(/臺/g, "台").toLocaleLowerCase());
}

function applyTime(row: Record<string, unknown>, time: NonNullable<QueryRecordsInput["time"]>): boolean {
  const value = row[time.field];
  if (typeof value !== "string") return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && (time.start === undefined || instant >= Date.parse(time.start)) && (time.end === undefined || instant < Date.parse(time.end));
}

function validPoint(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  return geometry.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
    && geometry.coordinates.every(part => typeof part === "number" && Number.isFinite(part))
    && Math.abs(geometry.coordinates[0] as number) <= 180 && Math.abs(geometry.coordinates[1] as number) <= 90;
}

function validateAdapterRead(descriptor: DatasetDescriptor, read: AdapterReadResult): void {
  if (!Array.isArray(read.rows) || read.rows.length > descriptor.accessPolicy.maxScanRows) throw new Error("SCAN_BUDGET_EXCEEDED");
  if (!read.sourceRefs.length || read.sourceRefs.length > 10 || read.sourceRefs.some(source => !source.sourceId || !source.version || !source.reference
    || !Number.isFinite(Date.parse(source.acquiredAt)) || source.checksumSha256 !== null && !/^[0-9a-f]{64}$/.test(source.checksumSha256))) throw new Error("INVALID_SOURCE_RECEIPT");
  if (Object.entries(read.exclusions).some(([reason, count]) => !/^[a-z][a-z0-9_]{0,79}$/.test(reason) || !Number.isInteger(count) || count < 0)) throw new Error("INVALID_EXCLUSIONS");
  const geometryField = descriptor.fields.find(field => field.name === "geometry");
  for (const row of read.rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("INVALID_ADAPTER_ROW");
    for (const field of descriptor.fields) {
      const value = row[field.name];
      if (value === null || value === undefined) {
        if (!field.nullable) throw new Error("INVALID_ADAPTER_ROW");
        continue;
      }
      const valid = field.type === "string" ? typeof value === "string" && value.length <= 4000
        : field.type === "number" ? typeof value === "number" && Number.isFinite(value)
        : field.type === "boolean" ? typeof value === "boolean"
        : field.type === "datetime" ? typeof value === "string" && Number.isFinite(Date.parse(value))
        : typeof value === "object";
      if (!valid) throw new Error("INVALID_ADAPTER_ROW");
    }
    if (geometryField && row.geometry !== null && row.geometry !== undefined && descriptor.geometry.type === "Point" && !validPoint(row.geometry)) throw new Error("INVALID_ADAPTER_GEOMETRY");
  }
}

export class QueryExecutor {
  private readonly adapters = new Map<string, QueryAdapter>();

  constructor(adapters: readonly QueryAdapter[]) {
    for (const adapter of adapters) {
      assertDatasetDescriptor(adapter.descriptor);
      if (this.adapters.has(adapter.descriptor.datasetId)) throw new Error("DUPLICATE_DATASET_ID");
      this.adapters.set(adapter.descriptor.datasetId, adapter);
    }
  }

  register(adapter: QueryAdapter): void {
    assertDatasetDescriptor(adapter.descriptor);
    if (this.adapters.has(adapter.descriptor.datasetId)) throw new Error("DUPLICATE_DATASET_ID");
    if (this.adapters.size >= 14) {
      const oldest = [...this.adapters.keys()].find(key => key.startsWith("layer:"));
      if (!oldest) throw new Error("DATASET_REGISTRY_LIMIT");
      this.adapters.delete(oldest); // Stored results retain their own rows and receipts.
    }
    this.adapters.set(adapter.descriptor.datasetId, adapter);
  }

  descriptors(): DatasetDescriptor[] { return [...this.adapters.values()].map(adapter => adapter.descriptor); }
  describe(datasetId: string): DatasetDescriptor | null {
    const adapter = this.adapters.get(datasetId);
    if (adapter && datasetId.startsWith("layer:")) { this.adapters.delete(datasetId); this.adapters.set(datasetId, adapter); }
    return adapter?.descriptor ?? null;
  }

  async execute(input: QueryRecordsInput, signal?: AbortSignal): Promise<ResultEnvelope> {
    return (await this.executeDetailed(input, signal)).envelope;
  }

  async executeDetailed(input: QueryRecordsInput, signal?: AbortSignal): Promise<QueryExecution> {
    const adapter = this.adapters.get(input.datasetId);
    if (!adapter) throw new Error("DATASET_NOT_FOUND");
    const { descriptor } = adapter;
    const offset = integer(input.offset, 0, 0, 10_000, "INVALID_OFFSET");
    const limit = integer(input.limit, Math.min(20, descriptor.accessPolicy.maxRowsPerQuery), 1, descriptor.accessPolicy.maxRowsPerQuery, "INVALID_LIMIT");
    const fieldMap = new Map(descriptor.fields.map(field => [field.name, field]));
    const select = input.select?.length ? [...input.select] : descriptor.fields.map(field => field.name);
    if (select.length > 50 || new Set(select).size !== select.length || select.some(field => !fieldMap.has(field))) throw new Error("FIELD_NOT_ALLOWED");
    const filters = input.filters ?? [];
    if (filters.length > 10 || filters.some(filter => !fieldMap.has(filter.field))) throw new Error("FILTER_NOT_ALLOWED");
    for (const filter of filters) {
      const field = fieldMap.get(filter.field)!;
      if (filter.op === "contains" && field.type !== "string") throw new Error("FILTER_NOT_ALLOWED");
    }
    const time = input.time;
    if (time) {
      if (!descriptor.timeFields.some(field => field.name === time.field) || time.start === undefined && time.end === undefined
        || time.start !== undefined && !Number.isFinite(Date.parse(time.start)) || time.end !== undefined && !Number.isFinite(Date.parse(time.end))
        || time.start !== undefined && time.end !== undefined && Date.parse(time.start) >= Date.parse(time.end)) throw new Error("INVALID_TIME_WINDOW");
    }
    const parameters = { ...(input.parameters ?? {}) };
    if (Object.keys(parameters).length > 12) throw new Error("PARAMETER_NOT_ALLOWED");
    for (const [name, value] of Object.entries(parameters)) {
      const expected = adapter.allowedParameters[name];
      if (!expected || value === null || typeof value !== expected) throw new Error("PARAMETER_NOT_ALLOWED");
    }
    const read = await adapter.read(parameters, signal);
    validateAdapterRead(descriptor, read);
    if (!Number.isInteger(read.rowsScanned) || read.rowsScanned < read.rows.length || read.rowsScanned > descriptor.accessPolicy.maxScanRows) throw new Error("SCAN_BUDGET_EXCEEDED");
    const matched = read.rows.filter(row => filters.every(filter => applyFilter(row, filter)) && (!time || applyTime(row, time)));
    const rows = matched.slice(offset, offset + limit).map(row => Object.fromEntries(select.map(field => [field, row[field] ?? null])));
    const normalized = { datasetId: input.datasetId, select, filters, ...(time ? { time } : {}), offset, limit, parameters };
    const queryHash = await sha256({ query: normalized, sources: read.sourceRefs.map(source => ({ sourceId: source.sourceId, version: source.version, checksumSha256: source.checksumSha256 })) });
    const envelope: ResultEnvelope = {
      schemaVersion: "pulse-query-result/0.1", resultId: `result-${queryHash.slice(0, 24)}`, queryHash, datasetId: input.datasetId,
      executionStatus: "complete", method: { operation: "query_records", version: "0.1", parameters: normalized }, sourceRefs: read.sourceRefs, ...(read.lineage ? { lineage: read.lineage } : {}),
      recordGrain: descriptor.recordGrain, countGrain: descriptor.recordGrain,
      units: Object.fromEntries(select.map(name => [name, fieldMap.get(name)!.unit])), coverage: read.coverage, freshness: read.freshness,
      totalMatched: matched.length, returned: rows.length, displayTruncated: offset + rows.length < matched.length, analysisComplete: true,
      excludedByReason: { ...read.exclusions }, rows,
      cost: { rowsScanned: read.rowsScanned, bytesScanned: read.bytesScanned, downloadedBytes: read.downloadedBytes, requests: read.requests, cacheHit: read.cacheHit }, expiresAt: read.expiresAt,
    };
    return { envelope, materializedRows: matched, descriptor };
  }
}
