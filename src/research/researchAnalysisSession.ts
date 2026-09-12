import { AnalysisOperations, type AnalysisResult, type StoredDataResult } from "./analysisOperations";
import type { QueryRecordsInput } from "./queryExecutor";
import { queryRecordsDetailed } from "./researchDatasets";
import { describeDataset } from "./researchDatasets";
import { BrowserMemoryResultStore, type ResultReference } from "./resultStore";

export type AnalysisQueryOperation = "spatial_query" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series" | "get_data_quality" | "get_record_evidence" | "get_analysis_result" | "get_result_bounds" | "list_results" | "remove_result";
export type PresentableResult = Pick<StoredDataResult, "resultId" | "datasetId" | "rows" | "geometry">;

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const result = value === undefined ? fallback : value;
  if (!Number.isInteger(result) || (result as number) < min || (result as number) > max) throw new Error("INVALID_INPUT");
  return result as number;
}

function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value)) throw new Error("INVALID_RESULT_ID");
  return value;
}

function page(result: StoredDataResult, offsetInput?: unknown, limitInput?: unknown): Record<string, unknown> {
  const offset = integer(offsetInput, 0, 0, 10_000);
  const limit = integer(limitInput, 20, 1, 50);
  const rows = result.rows.slice(offset, offset + limit);
  return {
    resultId: result.resultId, datasetId: result.datasetId, recordGrain: result.recordGrain, geometry: result.geometry,
    sourceRefs: result.sourceRefs, coverage: result.coverage, freshness: result.freshness, units: result.units,
    totalRows: result.rows.length, offset, limit, returned: rows.length, truncated: offset + rows.length < result.rows.length,
    nextOffset: offset + rows.length < result.rows.length ? offset + rows.length : null, rows,
    ...(isAnalysis(result) ? { operation: result.operation, inputResultIds: result.inputResultIds, method: result.method, summary: result.summary } : {}),
  };
}

function isAnalysis(result: StoredDataResult): result is AnalysisResult { return "operation" in result && "inputResultIds" in result; }

/** One instance belongs to one paired browser component/study. */
export class ResearchAnalysisSession {
  private readonly store = new BrowserMemoryResultStore<ResultReference>();
  private readonly operations = new AnalysisOperations(this.store);
  private readonly plans = new Map<string, { input: QueryRecordsInput; expiresAt: number }>();

  async queryRecords(input: QueryRecordsInput): Promise<Record<string, unknown>> {
    const execution = await queryRecordsDetailed(input);
    const stored: StoredDataResult = {
      resultId: execution.envelope.resultId, datasetId: execution.envelope.datasetId, rows: execution.materializedRows,
      recordGrain: execution.envelope.recordGrain, geometry: {
        type: execution.descriptor.geometry.type, role: execution.descriptor.geometry.role,
        spatialAnalysisEligible: execution.descriptor.geometry.spatialAnalysisEligible,
      }, sourceRefs: execution.envelope.sourceRefs, coverage: execution.envelope.coverage, freshness: execution.envelope.freshness,
      units: execution.envelope.units, excludedByReason: execution.envelope.excludedByReason,
    };
    this.store.put(stored);
    return execution.envelope as unknown as Record<string, unknown>;
  }

  async planDataAccess(input: QueryRecordsInput): Promise<Record<string, unknown>> {
    const descriptor = describeDataset(input.datasetId);
    const encoded = new TextEncoder().encode(stable({ input, versions: descriptor.versions, adapterId: descriptor.adapterId }));
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const planId = `plan-${hash.slice(0, 24)}`; const expiresAt = Date.now() + 5 * 60_000;
    this.plans.set(planId, { input: structuredClone(input), expiresAt });
    while (this.plans.size > 8) this.plans.delete(this.plans.keys().next().value!);
    return {
      planId, datasetId: descriptor.datasetId, adapterId: descriptor.adapterId, accessMode: descriptor.accessPolicy.mode,
      sourceVersions: descriptor.versions, estimatedScanRows: descriptor.accessPolicy.maxScanRows,
      estimatedScanBytes: null, estimatedDownloadBytes: null, estimatedRequests: 1,
      cacheReuse: "source_version_and_query_hash", cacheHit: null, costKnown: false, estimatedMonetaryCost: null,
      requiresApproval: false, hardLimits: { rowsPerPage: descriptor.accessPolicy.maxRowsPerQuery, scanRows: descriptor.accessPolicy.maxScanRows },
      expiresAt: new Date(expiresAt).toISOString(), limitations: ["Byte and monetary cost remain unknown until the allowlisted adapter returns a source receipt; unknown is not zero."],
    };
  }

  async materializeData(planIdInput: unknown): Promise<Record<string, unknown>> {
    const planId = id(planIdInput); const plan = this.plans.get(planId);
    if (!plan || plan.expiresAt <= Date.now()) { this.plans.delete(planId); throw new Error("PLAN_NOT_FOUND_OR_EXPIRED"); }
    this.plans.delete(planId);
    const result = await this.queryRecords(plan.input);
    return { planId, materialized: true, result };
  }

  execute(operation: AnalysisQueryOperation, args: Record<string, unknown>): Record<string, unknown> {
    if (operation === "list_results") return { results: this.store.list().map(item => page(item as StoredDataResult, 0, 1)).map(({ rows: _rows, ...summary }) => summary) };
    if (operation === "remove_result") return { resultId: id(args.resultId), removed: this.store.remove(id(args.resultId)) };
    if (operation === "get_analysis_result") return this.getPage(id(args.resultId), args.offset, args.limit);
    if (operation === "get_result_bounds") return this.bounds(Array.isArray(args.resultIds) ? args.resultIds.map(id) : []);
    if (operation === "get_data_quality") return this.operations.qualitySummary(id(args.resultId)) as unknown as Record<string, unknown>;
    if (operation === "get_record_evidence") return this.operations.recordEvidence(id(args.resultId), integer(args.recordIndex, 0, 0, 100_000)) as unknown as Record<string, unknown>;
    let result: AnalysisResult;
    if (operation === "spatial_query") {
      const center = args.center;
      if (!Array.isArray(center) || center.length !== 2 || !center.every(part => typeof part === "number" && Number.isFinite(part))) throw new Error("INVALID_INPUT");
      const point = { lng: center[0] as number, lat: center[1] as number };
      result = args.predicate === "nearest"
        ? this.operations.nearest({ resultId: id(args.resultId), center: point, limit: integer(args.limit, 20, 1, 50) })
        : args.predicate === "within_distance" && typeof args.radiusM === "number"
          ? this.operations.withinDistance({ resultId: id(args.resultId), center: point, radiusM: args.radiusM })
          : (() => { throw new Error("INVALID_INPUT"); })();
    } else if (operation === "aggregate_records") {
      result = this.operations.aggregate({ resultId: id(args.resultId), operation: args.operation as Parameters<AnalysisOperations["aggregate"]>[0]["operation"], ...(typeof args.field === "string" ? { field: args.field } : {}), ...(Array.isArray(args.groupBy) ? { groupBy: args.groupBy as string[] } : {}) });
    } else if (operation === "join_records") {
      result = this.operations.keyJoin({ leftResultId: id(args.leftResultId), rightResultId: id(args.rightResultId), leftKey: String(args.leftKey ?? ""), rightKey: String(args.rightKey ?? ""), cardinality: args.cardinality as "one_to_one" | "one_to_many" });
    } else if (operation === "calculate_metric") {
      result = this.operations.calculateMetric({ resultId: id(args.resultId), operation: args.operation as "ratio" | "difference", numeratorField: String(args.numeratorField ?? ""), ...(typeof args.denominatorField === "string" ? { denominatorField: args.denominatorField } : {}), ...(typeof args.outputField === "string" ? { outputField: args.outputField } : {}), ...(typeof args.unit === "string" || args.unit === null ? { unit: args.unit } : {}) });
    } else if (operation === "read_series") {
      result = this.operations.readSeries({ resultId: id(args.resultId), timeField: String(args.timeField ?? ""), resolution: args.resolution as "day" | "week", operation: args.operation as "count" | "sum" | "mean", ...(typeof args.valueField === "string" ? { valueField: args.valueField } : {}) });
    } else {
      result = this.operations.compareSeries({ currentResultId: id(args.currentResultId), baselineResultId: id(args.baselineResultId), operation: args.operation as "ratio" | "difference" });
    }
    return page(result, 0, args.limit);
  }

  clear(): void { for (const result of this.store.list()) this.store.remove(result.resultId); this.plans.clear(); }

  presentable(resultIds: readonly string[]): PresentableResult[] {
    if (!resultIds.length || resultIds.length > 4 || new Set(resultIds).size !== resultIds.length) throw new Error("INVALID_PRESENTATION_RESULTS");
    return resultIds.map(resultId => {
      const result = this.store.get(id(resultId)) as StoredDataResult | null;
      if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
      if (result.geometry.type !== "Point" || result.geometry.role !== "actual" || !result.geometry.spatialAnalysisEligible) throw new Error("RESULT_NOT_MAP_ELIGIBLE");
      if (result.rows.length > 2_000) throw new Error("RESULT_PRESENTATION_TOO_LARGE");
      return { resultId: result.resultId, datasetId: result.datasetId, rows: result.rows, geometry: result.geometry };
    });
  }

  bounds(resultIds: readonly string[]): { bounds: [number, number, number, number]; pointCount: number } {
    const results = this.presentable(resultIds);
    const points = results.flatMap(result => result.rows.map(row => row.geometry)).filter((geometry): geometry is { type: "Point"; coordinates: [number, number] } => {
      if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) return false;
      const candidate = geometry as { type?: unknown; coordinates?: unknown };
      return candidate.type === "Point" && Array.isArray(candidate.coordinates) && candidate.coordinates.length === 2 && candidate.coordinates.every(value => typeof value === "number" && Number.isFinite(value));
    });
    if (!points.length) throw new Error("RESULT_HAS_NO_MAP_GEOMETRY");
    const lngs = points.map(point => point.coordinates[0]); const lats = points.map(point => point.coordinates[1]);
    return { bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], pointCount: points.length };
  }

  private getPage(resultId: string, offset?: unknown, limit?: unknown): Record<string, unknown> {
    const result = this.store.get(resultId) as StoredDataResult | null;
    if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
    return page(result, offset, limit);
  }
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}
