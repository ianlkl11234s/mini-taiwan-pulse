import { neighborhoodCount, type NeighborhoodCountResult } from "./neighborhoodAnalysis";
import { assertDatasetAccess, assertLayerSourceAccess } from "./dataExploration";
import { AnalysisOperations, type AnalysisResult, type StoredDataResult } from "./analysisOperations";
import type { QueryRecordsInput } from "./queryExecutor";
import { queryRecordsDetailed } from "./researchDatasets";
import { describeDataset, ensureDataset } from "./researchDatasets";
import { BrowserMemoryResultStore, type ResultReference } from "./resultStore";

export type AnalysisQueryOperation = "compare_neighborhoods" | "spatial_query" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series" | "get_data_quality" | "get_record_evidence" | "get_analysis_result" | "get_result_bounds" | "list_results" | "remove_result";
export type PresentableResult = Pick<StoredDataResult, "resultId" | "datasetId" | "rows" | "geometry" | "presentation">;

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
    presentation: result.presentation, sourceRefs: result.sourceRefs, lineage: result.lineage, coverage: result.coverage, freshness: result.freshness, units: result.units,
    totalRows: result.rows.length, offset, limit, returned: rows.length, truncated: offset + rows.length < result.rows.length,
    nextOffset: offset + rows.length < result.rows.length ? offset + rows.length : null, rows,
    ...(isAnalysis(result) ? { operation: result.operation, inputResultIds: result.inputResultIds, method: result.method, summary: result.summary } : {}),
  };
}

function isAnalysis(result: StoredDataResult): result is AnalysisResult | NeighborhoodCountResult { return "operation" in result && "inputResultIds" in result; }

/** One instance belongs to one paired browser component/study. */
export class ResearchAnalysisSession {
  private readonly store = new BrowserMemoryResultStore<ResultReference>();
  private readonly operations = new AnalysisOperations(this.store);
  constructor(private readonly locked: () => ReadonlySet<string> = () => new Set()) {}
  private readonly plans = new Map<string, { input: QueryRecordsInput; expiresAt: number }>();

  async queryRecords(input: QueryRecordsInput): Promise<Record<string, unknown>> {
    await ensureDataset(input.datasetId, this.locked());
    assertDatasetAccess(input.datasetId, this.locked());
    const execution = await queryRecordsDetailed(input);
    assertDatasetAccess(input.datasetId, this.locked());
    const stored: StoredDataResult = {
      resultId: execution.envelope.resultId, datasetId: execution.envelope.datasetId, rows: execution.materializedRows,
      recordGrain: execution.envelope.recordGrain, geometry: {
        type: execution.descriptor.geometry.type, role: execution.descriptor.geometry.role,
        spatialAnalysisEligible: execution.descriptor.geometry.spatialAnalysisEligible,
      }, lineage: { ...execution.envelope.lineage, queryScope: { datasetId: input.datasetId, filters: input.filters ?? [], time: input.time ?? null, totalMatched: execution.envelope.totalMatched } }, sourceRefs: execution.envelope.sourceRefs, coverage: execution.envelope.coverage, freshness: execution.envelope.freshness,
      units: execution.envelope.units, excludedByReason: execution.envelope.excludedByReason,
    };
    this.store.put(stored);
    return execution.envelope as unknown as Record<string, unknown>;
  }

  async planDataAccess(input: QueryRecordsInput): Promise<Record<string, unknown>> {
    await ensureDataset(input.datasetId, this.locked());
    assertDatasetAccess(input.datasetId, this.locked());
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
    // Access can change after a query; recheck the result lineage before reuse or presentation.
    for (const [key, value] of Object.entries(args)) {
      if (key.endsWith("ResultId") || key === "resultId") this.assertResultAccess(id(value));
      if (key.endsWith("ResultIds") || key === "resultIds") if (Array.isArray(value)) value.forEach(v => this.assertResultAccess(id(v)));
    }
    if (operation === "compare_neighborhoods") {
      const get = (value: unknown) => { const result = this.store.get(id(value)) as StoredDataResult | null; if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED"); return result; };
      const sources = Array.isArray(args.sourceResultIds) ? args.sourceResultIds.map(get) : [];
      if (new Set(args.sourceResultIds as string[]).size !== sources.length) throw new Error("INVALID_INPUT");
      const rank = integer(args.rankBySource, 0, 0, sources.length - 1);
      const result = neighborhoodCount({ candidates: get(args.candidateResultId), sources, radiusM: Number(args.radiusM), includeSelf: true, rankSourceIndex: rank });
      const label = (datasetId: string) => { try { return describeDataset(datasetId).label; } catch { return datasetId; } };
      result.presentation = { kind: "neighborhood", countField: `source_${rank}_count`, label: label(sources[rank]!.datasetId), radiusM: Number(args.radiusM), sourceLabels: sources.map((source, index) => ({ field: `source_${index}_count`, label: label(source.datasetId) })) };
      result.lineage = { ...result.lineage, datasets: [get(args.candidateResultId).datasetId, ...sources.map(source => source.datasetId)] };
      this.store.put(result);
      return page(result, 0, args.limit);
    }
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

  private assertResultAccess(resultId: string): void {
    const result = this.store.get(resultId) as StoredDataResult | null;
    if (!result) return;
    const datasets = [...result.datasetId.split("+"), ...(Array.isArray(result.lineage?.datasets) ? result.lineage.datasets.filter((v): v is string => typeof v === "string") : [])];
    for (const datasetId of datasets) { if (datasetId.startsWith("layer:")) assertLayerSourceAccess(datasetId.slice(6), this.locked()); else if (describeDatasetSafe(datasetId)) assertDatasetAccess(datasetId, this.locked()); }
  }

  hasResult(resultId: string): boolean { return this.store.has(resultId); }

  presentable(resultIds: readonly string[]): PresentableResult[] {
    if (!resultIds.length || resultIds.length > 4 || new Set(resultIds).size !== resultIds.length) throw new Error("INVALID_PRESENTATION_RESULTS");
    return resultIds.map(resultId => {
      this.assertResultAccess(resultId);
      const result = this.store.get(id(resultId)) as StoredDataResult | null;
      if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
      if (!(result.geometry.type === "Point" && result.geometry.role === "actual" && result.geometry.spatialAnalysisEligible) && !(result.datasetId === "tw-schools-grid-150m" && result.geometry.type === "Polygon" && result.geometry.role === "generalized")) throw new Error("RESULT_NOT_MAP_ELIGIBLE");
      if (result.rows.length > (result.geometry.type === "Polygon" ? 10_000 : 2_000)) throw new Error("RESULT_PRESENTATION_TOO_LARGE");
      return { resultId: result.resultId, datasetId: result.datasetId, rows: result.rows, geometry: result.geometry, presentation: result.presentation };
    });
  }

  bounds(resultIds: readonly string[]): { bounds: [number, number, number, number]; pointCount: number; featureCount: number; vertexCount: number } {
    const results = this.presentable(resultIds);
    const points = results.flatMap(result => result.rows.flatMap(row => {
      const geometry = row.geometry as { type?: string; coordinates?: number[][][] };
      return geometry?.type === "Polygon" ? (geometry.coordinates?.[0] ?? []).map(coordinates => ({ type: "Point", coordinates })) : [row.geometry];
    })).filter((geometry): geometry is { type: "Point"; coordinates: [number, number] } => {
      if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) return false;
      const candidate = geometry as { type?: unknown; coordinates?: unknown };
      return candidate.type === "Point" && Array.isArray(candidate.coordinates) && candidate.coordinates.length === 2 && candidate.coordinates.every(value => typeof value === "number" && Number.isFinite(value));
    });
    if (!points.length) throw new Error("RESULT_HAS_NO_MAP_GEOMETRY");
    const lngs = points.map(point => point.coordinates[0]); const lats = points.map(point => point.coordinates[1]);
    return { bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], pointCount: results.filter(result => result.geometry.type === "Point").reduce((n, result) => n + result.rows.length, 0), featureCount: results.reduce((n, result) => n + result.rows.length, 0), vertexCount: points.length };
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

function describeDatasetSafe(datasetId: string): boolean { try { describeDataset(datasetId); return true; } catch { return false; } }
