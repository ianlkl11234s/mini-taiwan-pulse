import type { GeometryRole, RecordGrain, SourceReceipt } from "./dataContracts";
import { BrowserMemoryResultStore, type ResultReference } from "./resultStore";

type Row = Record<string, unknown>;
type Point = { type: "Point"; coordinates: [number, number] };
export type AggregateOperation = "count" | "distinct" | "sum" | "mean" | "min" | "max";

export interface ResultGeometry {
  type: "Point" | "Polygon" | "MultiPolygon" | "none";
  role: GeometryRole;
  spatialAnalysisEligible: boolean;
}

/** The materialized rows are intentionally separate from a display page. */
export interface StoredDataResult extends ResultReference {
  datasetId: string;
  rows: readonly Row[];
  recordGrain: RecordGrain | "aggregate" | "joined" | "metric" | "series";
  geometry: ResultGeometry;
  sourceRefs: readonly SourceReceipt[];
  presentation?: { kind: "neighborhood"; countField: string; label: string; radiusM: number; sourceLabels: { field: string; label: string }[] };
  lineage?: Readonly<Record<string, unknown>>;
  coverage: string;
  freshness: "current" | "stale" | "unknown";
  units: Readonly<Record<string, string | null>>;
  excludedByReason?: Readonly<Record<string, number>>;
}

export interface AnalysisResult extends StoredDataResult {
  operation: "within_distance" | "nearest" | "aggregate" | "key_join" | "ratio" | "difference" | "read_series" | "compare_series";
  inputResultIds: readonly string[];
  method: Readonly<Record<string, unknown>>;
  summary: Readonly<Record<string, unknown>>;
}

export interface WithinDistanceInput { resultId: string; center: { lng: number; lat: number }; radiusM: number; }
export interface NearestInput { resultId: string; center: { lng: number; lat: number }; limit?: number; }
export interface AggregateInput { resultId: string; operation: AggregateOperation; field?: string; groupBy?: readonly string[]; }
export interface KeyJoinInput { leftResultId: string; rightResultId: string; leftKey: string; rightKey: string; cardinality: "one_to_one" | "one_to_many"; }
export interface MetricInput { resultId: string; operation: "ratio" | "difference"; numeratorField: string; denominatorField: string; outputField?: string; unit?: string | null; }
export interface ReadSeriesInput { resultId: string; timeField: string; resolution: "day" | "week"; operation: "count" | "sum" | "mean"; valueField?: string; }
export interface CompareSeriesInput { currentResultId: string; baselineResultId: string; operation: "ratio" | "difference"; }

export interface QualitySummary {
  resultId: string;
  rows: number;
  nullByField: Record<string, number>;
  geometry: ResultGeometry;
  spatialAnalysisEligible: boolean;
  freshness: StoredDataResult["freshness"];
  coverage: string;
  excludedByReason: Record<string, number>;
  sourceRefs: readonly SourceReceipt[];
  lineage?: Readonly<Record<string, unknown>>;
}

export interface RecordEvidence {
  resultId: string;
  recordIndex: number;
  record: Row;
  sourceRefs: readonly SourceReceipt[];
  lineage?: Readonly<Record<string, unknown>>;
  coverage: string;
  freshness: StoredDataResult["freshness"];
}

function point(value: unknown): Point | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) return null;
  const [lng, lat] = geometry.coordinates;
  return typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180 && typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90
    ? { type: "Point", coordinates: [lng, lat] } : null;
}

function assertCenter(center: { lng: number; lat: number }): void {
  if (!Number.isFinite(center.lng) || !Number.isFinite(center.lat) || Math.abs(center.lng) > 180 || Math.abs(center.lat) > 90) throw new Error("INVALID_SPATIAL_CENTER");
}

function distanceMeters(a: { lng: number; lat: number }, b: Point): number {
  const radians = Math.PI / 180;
  const lat1 = a.lat * radians; const lat2 = b.coordinates[1] * radians;
  const dLat = lat2 - lat1; const dLng = (b.coordinates[0] - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function keyOf(value: unknown): string {
  if (value === null || value === undefined) throw new Error("MISSING_JOIN_KEY");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return `${typeof value}:${value}`;
  throw new Error("INVALID_JOIN_KEY");
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Allowlisted, in-memory operations over complete materialized result rows. */
export class AnalysisOperations {
  private sequence = 0;
  constructor(private readonly store: BrowserMemoryResultStore<ResultReference>) {}

  withinDistance(input: WithinDistanceInput): AnalysisResult {
    assertCenter(input.center);
    if (!Number.isFinite(input.radiusM) || input.radiusM < 0 || input.radiusM > 500_000) throw new Error("INVALID_DISTANCE_RADIUS");
    const source = this.data(input.resultId); this.assertActualPoints(source);
    const rows = source.rows.flatMap(row => {
      const geometry = point(row.geometry); if (!geometry) throw new Error("INVALID_POINT_GEOMETRY");
      const distanceM = distanceMeters(input.center, geometry);
      return distanceM <= input.radiusM ? [{ ...row, distanceM }] : [];
    });
    return this.save("within_distance", [source], rows, source.recordGrain, source.geometry, { ...source.units, distanceM: "m" }, { center: input.center, radiusM: input.radiusM }, { matched: rows.length, radiusM: input.radiusM });
  }

  nearest(input: NearestInput): AnalysisResult {
    assertCenter(input.center);
    const limit = input.limit ?? 1;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("INVALID_NEAREST_LIMIT");
    const source = this.data(input.resultId); this.assertActualPoints(source);
    const rows = source.rows.map(row => {
      const geometry = point(row.geometry); if (!geometry) throw new Error("INVALID_POINT_GEOMETRY");
      return { ...row, distanceM: distanceMeters(input.center, geometry) };
    }).sort((a, b) => (a.distanceM as number) - (b.distanceM as number)).slice(0, limit);
    return this.save("nearest", [source], rows, source.recordGrain, source.geometry, { ...source.units, distanceM: "m" }, { center: input.center, limit }, { matched: rows.length, limit });
  }

  aggregate(input: AggregateInput): AnalysisResult {
    const source = this.data(input.resultId); const groupBy = [...(input.groupBy ?? [])];
    if (groupBy.length > 8 || new Set(groupBy).size !== groupBy.length || groupBy.some(field => !validField(field))) throw new Error("INVALID_GROUP_BY");
    if (input.operation !== "count" && (!input.field || !validField(input.field))) throw new Error("INVALID_AGGREGATE_FIELD");
    const groups = new Map<string, { values: Row[]; labels: Row }>();
    for (const row of source.rows) {
      const labels = Object.fromEntries(groupBy.map(field => [field, row[field] ?? null]));
      const id = JSON.stringify(labels);
      const group = groups.get(id) ?? { values: [], labels }; group.values.push(row); groups.set(id, group);
    }
    const rows = [...groups.values()].map(group => {
      const raw = input.field ? group.values.map(row => row[input.field!]) : [];
      const present = raw.filter((value): value is Exclude<unknown, null> => value !== null && value !== undefined);
      const numbers = raw.map(numeric).filter((value): value is number => value !== null);
      let value: number;
      switch (input.operation) {
        case "count": value = input.field ? present.length : group.values.length; break;
        case "distinct": value = new Set(present.map(keyOf)).size; break;
        case "sum": value = numbers.length ? numbers.reduce((sum, item) => sum + item, 0) : Number.NaN; break;
        case "mean": value = numbers.length ? numbers.reduce((sum, item) => sum + item, 0) / numbers.length : Number.NaN; break;
        case "min": value = numbers.length ? Math.min(...numbers) : Number.NaN; break;
        case "max": value = numbers.length ? Math.max(...numbers) : Number.NaN; break;
      }
      return { ...group.labels, value: Number.isNaN(value) ? null : value, rowsInGroup: group.values.length, nullOrNonNumeric: input.operation === "count" || input.operation === "distinct" ? raw.length - present.length : raw.length - numbers.length };
    });
    return this.save("aggregate", [source], rows, "aggregate", { type: "none", role: "none", spatialAnalysisEligible: false }, { value: input.operation === "count" || input.operation === "distinct" ? "records" : source.units[input.field ?? ""] ?? null }, { ...input }, { groups: rows.length, operation: input.operation, nullsExcluded: true });
  }

  keyJoin(input: KeyJoinInput): AnalysisResult {
    if (!validField(input.leftKey) || !validField(input.rightKey)) throw new Error("INVALID_JOIN_KEY");
    const left = this.data(input.leftResultId); const right = this.data(input.rightResultId);
    const { index: leftIndex, missingKeys: missingLeftKeys } = this.index(left.rows, input.leftKey);
    const { index: rightIndex, missingKeys: missingRightKeys } = this.index(right.rows, input.rightKey);
    const leftDuplicateKeys = [...leftIndex.values()].filter(rows => rows.length > 1).length;
    const rightDuplicateKeys = [...rightIndex.values()].filter(rows => rows.length > 1).length;
    if (input.cardinality === "one_to_one" && (leftDuplicateKeys || rightDuplicateKeys)) throw new Error("JOIN_CARDINALITY_VIOLATION");
    if (input.cardinality === "one_to_many" && leftDuplicateKeys) throw new Error("JOIN_CARDINALITY_VIOLATION");
    const rows: Row[] = []; let unmatchedLeft = missingLeftKeys;
    for (const [key, leftRows] of leftIndex) {
      const rightRows = rightIndex.get(key);
      if (!rightRows) { unmatchedLeft += leftRows.length; continue; }
      for (const leftRow of leftRows) for (const rightRow of rightRows) rows.push({
        ...Object.fromEntries(Object.entries(leftRow).map(([field, value]) => [`left_${field}`, value])),
        ...Object.fromEntries(Object.entries(rightRow).map(([field, value]) => [`right_${field}`, value])),
      });
    }
    let unmatchedRight = missingRightKeys;
    for (const [key, rightRows] of rightIndex) if (!leftIndex.has(key)) unmatchedRight += rightRows.length;
    return this.save("key_join", [left, right], rows, "joined", { type: "none", role: "none", spatialAnalysisEligible: false }, {}, { ...input }, { unmatchedLeft, unmatchedRight, missingLeftKeys, missingRightKeys, duplicatedLeftKeys: leftDuplicateKeys, duplicatedRightKeys: rightDuplicateKeys, cardinality: input.cardinality });
  }

  calculateMetric(input: MetricInput): AnalysisResult {
    if (!validField(input.numeratorField) || !validField(input.denominatorField)) throw new Error("INVALID_METRIC_FIELD");
    const source = this.data(input.resultId); const outputField = input.outputField ?? input.operation;
    if (!validField(outputField)) throw new Error("INVALID_METRIC_FIELD");
    const rows = source.rows.map(row => {
      const numerator = numeric(row[input.numeratorField]);
      const denominator = numeric(row[input.denominatorField]);
      if (input.operation === "ratio" && denominator === 0) throw new Error("ZERO_DENOMINATOR");
      const value = input.operation === "ratio" ? numerator === null || denominator === null ? null : numerator / denominator
        : numerator === null || denominator === null ? null : numerator - denominator;
      return { ...row, [outputField]: value };
    });
    return this.save(input.operation, [source], rows, "metric", source.geometry, { ...source.units, [outputField]: input.unit ?? null }, { ...input, outputField }, { nullMetrics: rows.filter(row => row[outputField] === null).length, nullsPreserved: true });
  }

  readSeries(input: ReadSeriesInput): AnalysisResult {
    if (!validField(input.timeField) || input.operation !== "count" && (!input.valueField || !validField(input.valueField))) throw new Error("INVALID_SERIES_FIELD");
    const source = this.data(input.resultId); const groups = new Map<string, { rows: number; values: number[] }>(); let invalidTime = 0;
    for (const row of source.rows) {
      const instant = typeof row[input.timeField] === "string" ? new Date(row[input.timeField] as string) : null;
      if (!instant || !Number.isFinite(instant.getTime())) { invalidTime += 1; continue; }
      const start = new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
      if (input.resolution === "week") { const day = start.getUTCDay() || 7; start.setUTCDate(start.getUTCDate() - day + 1); }
      const key = start.toISOString(); const group = groups.get(key) ?? { rows: 0, values: [] }; group.rows += 1;
      const value = input.valueField ? numeric(row[input.valueField]) : null; if (value !== null) group.values.push(value); groups.set(key, group);
    }
    const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([periodStart, group]) => {
      const value = input.operation === "count" ? group.rows : group.values.length ? input.operation === "sum" ? group.values.reduce((sum, item) => sum + item, 0) : group.values.reduce((sum, item) => sum + item, 0) / group.values.length : null;
      return { period_start: periodStart, value, records: group.rows, missing_value: input.operation === "count" ? 0 : group.rows - group.values.length };
    });
    return this.save("read_series", [source], rows, "series", { type: "none", role: "none", spatialAnalysisEligible: false }, { value: input.operation === "count" ? "records" : source.units[input.valueField ?? ""] ?? null }, { ...input, timezone: "UTC" }, { periods: rows.length, invalidTime, missingPeriodsFilled: false });
  }

  compareSeries(input: CompareSeriesInput): AnalysisResult {
    const current = this.data(input.currentResultId); const baseline = this.data(input.baselineResultId);
    if (current.recordGrain !== "series" || baseline.recordGrain !== "series") throw new Error("SERIES_RESULT_REQUIRED");
    const currentRows = new Map(current.rows.map(row => [String(row.period_start), row])); const baselineRows = new Map(baseline.rows.map(row => [String(row.period_start), row]));
    const keys = [...new Set([...currentRows.keys(), ...baselineRows.keys()])].sort(); let missingCurrent = 0; let missingBaseline = 0; let zeroBaseline = 0;
    const rows = keys.map(periodStart => {
      const currentValue = numeric(currentRows.get(periodStart)?.value); const baselineValue = numeric(baselineRows.get(periodStart)?.value);
      let status = "valid"; let value: number | null = null;
      if (currentValue === null) { missingCurrent += 1; status = "missing_current"; }
      else if (baselineValue === null) { missingBaseline += 1; status = "missing_baseline"; }
      else if (input.operation === "ratio" && baselineValue === 0) { zeroBaseline += 1; status = "zero_baseline"; }
      else value = input.operation === "ratio" ? currentValue / baselineValue : currentValue - baselineValue;
      return { period_start: periodStart, current_value: currentValue, baseline_value: baselineValue, value, status };
    });
    return this.save("compare_series", [current, baseline], rows, "series", { type: "none", role: "none", spatialAnalysisEligible: false }, { value: input.operation === "ratio" ? "ratio" : current.units.value ?? null }, { operation: input.operation, keyField: "period_start", valueField: "value" }, { periods: rows.length, missingCurrent, missingBaseline, zeroBaseline, nullsPreserved: true });
  }

  qualitySummary(resultId: string): QualitySummary {
    const source = this.data(resultId); const nullByField: Record<string, number> = {};
    for (const row of source.rows) for (const [field, value] of Object.entries(row)) if (value === null || value === undefined) nullByField[field] = (nullByField[field] ?? 0) + 1;
    return { resultId, lineage: source.lineage, rows: source.rows.length, nullByField, geometry: { ...source.geometry }, spatialAnalysisEligible: source.geometry.role === "actual" && source.geometry.spatialAnalysisEligible, freshness: source.freshness, coverage: source.coverage, excludedByReason: { ...(source.excludedByReason ?? {}) }, sourceRefs: source.sourceRefs.map(sourceRef => ({ ...sourceRef })) };
  }

  recordEvidence(resultId: string, recordIndex: number): RecordEvidence {
    const source = this.data(resultId);
    if (!Number.isInteger(recordIndex) || recordIndex < 0 || recordIndex >= source.rows.length) throw new Error("RECORD_NOT_FOUND");
    return { resultId, recordIndex, lineage: source.lineage, record: structuredClone(source.rows[recordIndex]!), sourceRefs: source.sourceRefs.map(sourceRef => ({ ...sourceRef })), coverage: source.coverage, freshness: source.freshness };
  }

  private data(resultId: string): StoredDataResult {
    const result = this.store.get(resultId) as StoredDataResult | null;
    if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
    if (!Array.isArray(result.rows) || !result.geometry || !Array.isArray(result.sourceRefs)) throw new Error("INVALID_STORED_RESULT");
    return result;
  }
  private assertActualPoints(result: StoredDataResult): void {
    if (result.geometry.type !== "Point" || result.geometry.role !== "actual" || !result.geometry.spatialAnalysisEligible) throw new Error("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
  }
  private index(rows: readonly Row[], field: string): { index: Map<string, Row[]>; missingKeys: number } {
    const index = new Map<string, Row[]>();
    let missingKeys = 0;
    for (const row of rows) {
      if (row[field] === null || row[field] === undefined) { missingKeys += 1; continue; }
      const key = keyOf(row[field]); const existing = index.get(key) ?? []; existing.push(row); index.set(key, existing);
    }
    return { index, missingKeys };
  }
  private save(operation: AnalysisResult["operation"], inputs: readonly StoredDataResult[], rows: readonly Row[], recordGrain: AnalysisResult["recordGrain"], geometry: ResultGeometry, units: Readonly<Record<string, string | null>>, method: Readonly<Record<string, unknown>>, summary: Readonly<Record<string, unknown>>): AnalysisResult {
    this.sequence += 1;
    const excludedByReason: Record<string, number> = {};
    for (const input of inputs) for (const [reason, count] of Object.entries(input.excludedByReason ?? {})) excludedByReason[reason] = (excludedByReason[reason] ?? 0) + count;
    const result: AnalysisResult = { resultId: `analysis-${operation}-${Date.now().toString(36)}-${this.sequence}`, datasetId: inputs.map(input => input.datasetId).join("+"), rows: structuredClone(rows), recordGrain, geometry, ...(inputs.some(input => input.lineage) ? { lineage: { inputs: inputs.filter(input => input.lineage).map(input => ({ resultId: input.resultId, lineage: structuredClone(input.lineage) })) } } : {}), sourceRefs: inputs.flatMap(input => input.sourceRefs).filter((source, index, all) => all.findIndex(other => other.sourceId === source.sourceId && other.version === source.version) === index), coverage: inputs.map(input => input.coverage).join(" | "), freshness: inputs.some(input => input.freshness === "stale") ? "stale" : inputs.some(input => input.freshness === "unknown") ? "unknown" : "current", units: { ...units }, excludedByReason, operation, inputResultIds: inputs.map(input => input.resultId), method: structuredClone(method), summary: structuredClone(summary) };
    this.store.put(result);
    return structuredClone(result);
  }
}

function validField(field: string): boolean { return /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(field); }
