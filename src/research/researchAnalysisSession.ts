import { withLoading } from "../lib/loadingRegistry";
import { neighborhoodCount, type NeighborhoodCountResult } from "./neighborhoodAnalysis";
import { assertDatasetAccess, assertLayerSourceAccess } from "./dataExploration";
import { AnalysisOperations, type AnalysisResult, type StoredDataResult } from "./analysisOperations";
import type { QueryRecordsInput } from "./queryExecutor";
import { describeDataset, ensureDataset, queryRecordsDetailed, validateQueryRecordsInput } from "./researchDatasets";
import { BrowserMemoryResultStore, type ResultReference } from "./resultStore";
import type { WalkingIsochroneExecution } from "./networkProvider";
import { loadWarehouseResult, validateWarehouseImportArgs } from "./warehouseResultImport";

export type AnalysisQueryOperation = "compare_neighborhoods" | "create_analysis_scope" | "spatial_query" | "aggregate_by_area" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series" | "compare_regions" | "get_data_quality" | "get_record_evidence" | "get_analysis_result" | "get_result_bounds" | "list_results" | "remove_result";
export type PresentableResult = Pick<StoredDataResult, "resultId" | "datasetId" | "rows" | "geometry" | "presentation" | "resultStyle"> & { displayLabel?: string; units?: StoredDataResult["units"] };

/**
 * Presentation is a collection, rather than a domain-specific single result.
 * These are deliberately finite browser budgets, not a statement about how
 * many results an analysis session can retain or how many records exist at the
 * source.
 */
export const RESULT_COLLECTION_LIMITS = {
  // This shared scene budget admits the measured 22-county raw boundary
  // (332,091 vertices / 14,719,725 serialized source bytes). It raises the
  // browser work and memory possible for one scene; it neither simplifies the
  // source geometry nor reduces result-store/cache bytes.
  maxLogicalResults: 8,
  maxFeatures: 10_000,
  maxVertices: 400_000,
  maxBytes: 24 * 1024 * 1024,
} as const;

type Position = [number, number];
type SupportedPresentationGeometry = "Point" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part));
}

function samePosition(left: Position, right: Position): boolean { return left[0] === right[0] && left[1] === right[1]; }

function appendPositions(target: Position[], source: readonly Position[]): void {
  for (const position of source) target.push(position);
}

function polygonPositions(value: unknown): Position[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const positions: Position[] = [];
  for (const ring of value) {
    if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition) || !samePosition(ring[0]!, ring[ring.length - 1]!)) return null;
    appendPositions(positions, ring);
  }
  return positions;
}

function linePositions(value: unknown): Position[] | null {
  return Array.isArray(value) && value.length >= 2 && value.every(isPosition) ? value : null;
}

function geometryPositions(value: unknown, expectedType: SupportedPresentationGeometry): Position[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== expectedType) return null;
  if (expectedType === "Point") return isPosition(geometry.coordinates) ? [geometry.coordinates] : null;
  if (expectedType === "LineString") return linePositions(geometry.coordinates);
  if (expectedType === "MultiLineString") {
    if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return null;
    const lines = geometry.coordinates.map(linePositions); return lines.some(line => !line) ? null : lines.flat() as Position[];
  }
  if (expectedType === "Polygon") return polygonPositions(geometry.coordinates);
  if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return null;
  const positions: Position[] = [];
  for (const polygon of geometry.coordinates) {
    const polygonVertices = polygonPositions(polygon);
    if (!polygonVertices) return null;
    appendPositions(positions, polygonVertices);
  }
  return positions;
}

export function presentationMetrics(rows: readonly Record<string, unknown>[], type: SupportedPresentationGeometry): { featureCount: number; vertexCount: number; bytes: number; positions: Position[] } {
  const positions: Position[] = [];
  for (const row of rows) {
    const vertices = geometryPositions(row.geometry, type);
    if (!vertices) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    appendPositions(positions, vertices);
  }
  return { featureCount: rows.length, vertexCount: positions.length, bytes: new TextEncoder().encode(JSON.stringify(rows)).byteLength, positions };
}

export function assertResultCollectionBudget(metrics: readonly Pick<ReturnType<typeof presentationMetrics>, "featureCount" | "vertexCount" | "bytes">[]): void {
  const featureCount = metrics.reduce((count, metric) => count + metric.featureCount, 0);
  const vertexCount = metrics.reduce((count, metric) => count + metric.vertexCount, 0);
  const bytes = metrics.reduce((count, metric) => count + metric.bytes, 0);
  if (featureCount > RESULT_COLLECTION_LIMITS.maxFeatures) throw new Error("RESULT_COLLECTION_FEATURE_LIMIT");
  if (vertexCount > RESULT_COLLECTION_LIMITS.maxVertices) throw new Error("RESULT_COLLECTION_VERTEX_LIMIT");
  if (bytes > RESULT_COLLECTION_LIMITS.maxBytes) throw new Error("RESULT_COLLECTION_BYTE_LIMIT");
}

export function isMapEligibleGeometry(geometry: PresentableResult["geometry"]): geometry is PresentableResult["geometry"] & { type: SupportedPresentationGeometry } {
  if (geometry.type === "Point") return geometry.role === "actual" && geometry.spatialAnalysisEligible || geometry.role === "generalized" && !geometry.spatialAnalysisEligible;
  if (geometry.type === "LineString" || geometry.type === "MultiLineString") return geometry.role === "actual" && geometry.spatialAnalysisEligible || geometry.role === "proxy" && !geometry.spatialAnalysisEligible;
  return (geometry.type === "Polygon" || geometry.type === "MultiPolygon") && (geometry.role === "actual" || geometry.role === "derived" || geometry.role === "generalized" || geometry.role === "proxy" && !geometry.spatialAnalysisEligible);
}

function analysisCenter(value: unknown): Position {
  if (!isPosition(value) || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 85) throw new Error("INVALID_SPATIAL_CENTER");
  return value;
}

function geodesicCircle(center: Position, radiusM: number, segments = 64): Position[] {
  const radians = Math.PI / 180;
  const degrees = 180 / Math.PI;
  const angularDistance = radiusM / 6_371_008.8;
  const longitude = center[0] * radians;
  const latitude = center[1] * radians;
  const ring: Position[] = [];
  for (let index = 0; index < segments; index += 1) {
    const bearing = index / segments * Math.PI * 2;
    const targetLatitude = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing));
    const targetLongitude = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude), Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude));
    ring.push([((targetLongitude * degrees + 540) % 360) - 180, targetLatitude * degrees]);
  }
  ring.push([...ring[0]!] as Position);
  return ring;
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const result = value === undefined ? fallback : value;
  if (!Number.isInteger(result) || (result as number) < min || (result as number) > max) throw new Error("INVALID_INPUT");
  return result as number;
}

function id(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value)) throw new Error("INVALID_RESULT_ID");
  return value;
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

const MAX_BOUNDED_LINEAGE_ITEMS = 64;
const MAX_BOUNDED_LINEAGE_BYTES = 32 * 1024;

function geometrySourceInputsFromLineage(resultId: string, lineage: Record<string, unknown>, fallbackDatasetId: string, depth = 0): Record<string, unknown>[] {
  if (depth >= MAX_BOUNDED_LINEAGE_ITEMS) throw new Error("LINEAGE_BUDGET_EXCEEDED");
  const sourceInputs = Array.isArray(lineage.sourceInputs) ? lineage.sourceInputs : [];
  if (sourceInputs.length) return sourceInputs.flatMap(value => {
    const item = object(value); const sourceResultId = item.resultId;
    return typeof sourceResultId === "string" ? geometrySourceInputsFromLineage(sourceResultId, object(item.lineage), fallbackDatasetId, depth + 1) : [];
  });
  const nestedInputs = Array.isArray(lineage.inputs) ? lineage.inputs : [];
  if (nestedInputs.length) return nestedInputs.flatMap(value => {
    const item = object(value); const sourceResultId = item.resultId;
    return typeof sourceResultId === "string" ? geometrySourceInputsFromLineage(sourceResultId, object(item.lineage), fallbackDatasetId, depth + 1) : [];
  });
  const sourceLineage: Record<string, unknown> = {};
  for (const key of ["queryScope", "sourceContract", "datasets", "authorizedDatasetIds"]) if (lineage[key] !== undefined) sourceLineage[key] = structuredClone(lineage[key]);
  const sourceDatasetId = typeof object(lineage.queryScope).datasetId === "string" ? object(lineage.queryScope).datasetId
    : typeof object(lineage.sourceContract).datasetId === "string" ? object(lineage.sourceContract).datasetId : fallbackDatasetId;
  if (!sourceLineage.datasets) sourceLineage.datasets = [sourceDatasetId];
  if (!sourceLineage.authorizedDatasetIds) sourceLineage.authorizedDatasetIds = [sourceDatasetId];
  return [{ resultId, lineage: sourceLineage }];
}

function geometrySourceInputs(input: StoredDataResult): Record<string, unknown>[] {
  return geometrySourceInputsFromLineage(input.resultId, object(input.lineage), input.datasetId);
}

function geometryOperationTrail(input: StoredDataResult): Record<string, unknown>[] {
  const lineage = object(input.lineage);
  const inherited = Array.isArray(lineage.operationTrail) ? lineage.operationTrail.filter(value => {
    const item = object(value);
    return typeof item.resultId === "string" && typeof item.operation === "string" && Array.isArray(item.inputResultIds) && Object.keys(object(item.method)).length > 0;
  }).map(value => structuredClone(value as Record<string, unknown>)) : [];
  return isAnalysis(input) ? [...inherited, { resultId: input.resultId, operation: input.operation, inputResultIds: [...input.inputResultIds], method: structuredClone(input.method) }] : inherited;
}

function uniqueByResultId(values: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...new Map(values.filter(value => typeof value.resultId === "string").map(value => [value.resultId as string, value])).values()];
}

function uniqueSourceRefs(inputs: readonly StoredDataResult[]): StoredDataResult["sourceRefs"] {
  return inputs.flatMap(input => input.sourceRefs).filter((source, index, all) => all.findIndex(other => other.sourceId === source.sourceId && other.version === source.version && other.checksumSha256 === source.checksumSha256 && other.reference === source.reference && other.acquiredAt === source.acquiredAt) === index);
}

function assertBoundedLineage(sourceInputs: Record<string, unknown>[], operationTrail: Record<string, unknown>[]): void {
  if (sourceInputs.length > MAX_BOUNDED_LINEAGE_ITEMS || operationTrail.length > MAX_BOUNDED_LINEAGE_ITEMS) throw new Error("LINEAGE_BUDGET_EXCEEDED");
  if (new TextEncoder().encode(JSON.stringify({ sourceInputs, operationTrail })).byteLength > MAX_BOUNDED_LINEAGE_BYTES) throw new Error("LINEAGE_BUDGET_EXCEEDED");
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
  private generation = 0;
  private readonly plans = new Map<string, { input: QueryRecordsInput; expiresAt: number }>();

  async queryRecords(input: QueryRecordsInput): Promise<Record<string, unknown>> {
    await ensureDataset(input.datasetId, this.locked());
    assertDatasetAccess(input.datasetId, this.locked());
    const execution = await queryRecordsDetailed(input);
    assertDatasetAccess(input.datasetId, this.locked());
    const normalizedScope = execution.envelope.method.parameters;
    const stored: StoredDataResult = {
      resultId: execution.envelope.resultId, datasetId: execution.envelope.datasetId, rows: execution.materializedRows,
      recordGrain: execution.envelope.recordGrain, geometry: {
        type: execution.descriptor.geometry.type, role: execution.descriptor.geometry.role,
        spatialAnalysisEligible: execution.descriptor.geometry.spatialAnalysisEligible,
      }, lineage: {
        ...execution.envelope.lineage,
        queryScope: {
          datasetId: execution.envelope.datasetId,
          filters: normalizedScope.filters ?? [], bbox: normalizedScope.bbox ?? null,
          time: normalizedScope.time ?? null, parameters: normalizedScope.parameters ?? {},
          totalMatched: execution.envelope.totalMatched,
        },
        sourceContract: {
          datasetId: execution.descriptor.datasetId, recordGrain: execution.descriptor.recordGrain,
          timeFields: execution.descriptor.timeFields, geometry: execution.descriptor.geometry,
        },
      }, sourceRefs: execution.envelope.sourceRefs, coverage: execution.envelope.coverage, freshness: execution.envelope.freshness,
      units: Object.fromEntries(execution.descriptor.fields.map(field => [field.name, field.unit])), excludedByReason: execution.envelope.excludedByReason,
    };
    this.store.put(stored);
    return execution.envelope as unknown as Record<string, unknown>;
  }

  async planDataAccess(input: QueryRecordsInput): Promise<Record<string, unknown>> {
    await ensureDataset(input.datasetId, this.locked());
    assertDatasetAccess(input.datasetId, this.locked());
    const validatedInput = validateQueryRecordsInput(input);
    const descriptor = describeDataset(validatedInput.datasetId);
    const encoded = new TextEncoder().encode(stable({ input: validatedInput, versions: descriptor.versions, adapterId: descriptor.adapterId }));
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const planId = `plan-${hash.slice(0, 24)}`; const expiresAt = Date.now() + 5 * 60_000;
    this.plans.set(planId, { input: structuredClone(validatedInput), expiresAt });
    while (this.plans.size > 8) this.plans.delete(this.plans.keys().next().value!);
    return {
      planId, datasetId: descriptor.datasetId, adapterId: descriptor.adapterId, accessMode: descriptor.access.mode,
      sourceVersions: descriptor.versions, estimatedScanRows: descriptor.access.limits.maxScanRows,
      estimatedScanBytes: null, estimatedDownloadBytes: null, estimatedRequests: 1,
      cacheReuse: "source_version_and_query_hash", cacheHit: null, costKnown: false, estimatedMonetaryCost: null,
      requiresApproval: false, hardLimits: { rowsPerPage: descriptor.access.limits.maxRowsPerQuery, scanRows: descriptor.access.limits.maxScanRows, responseBytes: descriptor.access.limits.maxResponseBytes, sourceBytes: descriptor.access.limits.maxSourceBytes },
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

  storeWalkingIsochrone(execution: WalkingIsochroneExecution): Record<string, unknown> {
    const acquiredAt = execution.graph.observedAt;
    const sourceRef = {
      sourceId: "valhalla-public-demo-osm-pedestrian-graph",
      version: `${execution.graph.engineVersion}@${execution.graph.tilesetLastModified}`,
      acquiredAt,
      checksumSha256: execution.graph.checksumSha256,
      reference: "https://valhalla1.openstreetmap.de/status",
    } as const;
    const suffix = Date.now().toString(36);
    const stored = execution.contours.map((contour, index) => {
      const result: AnalysisResult = {
        resultId: `analysis-walking-${contour.minutes}m-${suffix}-${index}`,
        datasetId: `derived:valhalla-walking-${contour.minutes}m`,
        rows: [{
          record_id: `walking-${contour.minutes}m-${suffix}`,
          label: `步行 ${contour.minutes} 分鐘`,
          contourMinutes: contour.minutes,
          geometry: structuredClone(contour.geometry),
        }],
        recordGrain: "feature",
        geometry: { type: "MultiPolygon", role: "derived", spatialAnalysisEligible: true },
        sourceRefs: [sourceRef],
        coverage: `Valhalla pedestrian ${contour.minutes}-minute modeled isochrone around ${execution.request.center[0]},${execution.request.center[1]}; only returned routable graph coverage is represented.`,
        freshness: "unknown",
        units: { contourMinutes: "min" },
        excludedByReason: {},
        lineage: {
          origin: "external_valhalla_isochrone",
          provider: execution.provider,
          endpointClass: execution.endpointClass,
          sendsCoordinatesExternally: execution.sendsCoordinatesExternally,
          graph: structuredClone(execution.graph),
          center: [...execution.request.center],
          contourMinutes: contour.minutes,
        },
        operation: "walking_isochrone",
        inputResultIds: [],
        method: {
          operation: "walking_isochrone",
          version: "0.1",
          costing: "pedestrian",
          graph: structuredClone(execution.graph),
          providerGeometryType: "MultiPolygon",
          vertexCount: contour.vertexCount,
          noHaversineFallback: true,
        },
        summary: {
          featureCount: 1,
          contourMinutes: contour.minutes,
          vertexCount: contour.vertexCount,
          boundaryMeaning: "Modeled pedestrian travel-time boundary from Valhalla over an OpenStreetMap-derived graph.",
        },
      };
      presentationMetrics(result.rows, "MultiPolygon");
      this.store.put(result);
      return result;
    });
    const { contours: _contours, ...receipt } = execution;
    return {
      ...receipt,
      result: {
        resultIds: stored.map(result => result.resultId),
        contours: stored.map((result, index) => ({ resultId: result.resultId, minutes: execution.contours[index]!.minutes, featureCount: 1 })),
        geometryType: "MultiPolygon",
        spatialAnalysisEligible: true,
        persistence: "paired_browser_session_only",
      },
    };
  }

  /** Load the bounded topology engine only for explicit geometry operations. */
  async executeGeometry(args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const predicate = args.predicate;
    if (!["line_buffer", "surface_intersection", "measure_geometry"].includes(String(predicate))) throw new Error("INVALID_INPUT");
    const allowed = predicate === "surface_intersection" ? ["predicate", "leftResultId", "rightResultId", "limit"] : predicate === "line_buffer" ? ["predicate", "resultId", "radiusM", "limit"] : ["predicate", "resultId", "limit"];
    if (Object.keys(args).some(key => !allowed.includes(key))) throw new Error("INVALID_INPUT");
    const limit = integer(args.limit, 20, 1, 50);
    const ids = predicate === "surface_intersection" ? [id(args.leftResultId), id(args.rightResultId)] : [id(args.resultId)];
    const read = (resultId: string): StoredDataResult => {
      this.assertResultAccess(resultId);
      const result = this.store.get(resultId) as StoredDataResult | null;
      if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
      if (!["actual", "derived"].includes(result.geometry.role) || !result.geometry.spatialAnalysisEligible) throw new Error("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
      // One complete feature per input; selecting a display page does not narrow analysis.
      if (result.rows.length !== 1) throw new Error("GEOMETRY_REQUIRES_SINGLE_FEATURE");
      return result;
    };
    if (predicate === "line_buffer" && (typeof args.radiusM !== "number" || !Number.isFinite(args.radiusM))) throw new Error("INVALID_INPUT");
    const inputs = ids.map(read);
    const generation = this.generation;
    const engine = await withLoading("research:geometry-engine", "載入有界幾何分析", import("./boundedGeometry"));
    if (generation !== this.generation) throw new Error("SESSION_REVOKED");
    ids.forEach(read); // Recheck access/expiry after asynchronous module loading.
    const outcome = predicate === "line_buffer" ? engine.boundedLineBuffer(inputs[0]!.rows[0]!.geometry, Number(args.radiusM))
      : predicate === "surface_intersection" ? engine.boundedSurfaceIntersection(inputs[0]!.rows[0]!.geometry, inputs[1]!.rows[0]!.geometry)
      : engine.boundedMeasure(inputs[0]!.rows[0]!.geometry);
    const label = predicate === "line_buffer" ? `${geometryInputLabel(inputs[0]!)}・${args.radiusM} 公尺線形環域` : predicate === "surface_intersection" ? "面交集（僅面積部分）" : "幾何度量";
    const rows = outcome.geometry ? [{ label, ...outcome.summary, geometry: outcome.geometry }] : predicate === "measure_geometry" ? [{ label, ...outcome.summary }] : [];
    const datasets = [...new Set(inputs.flatMap(input => [...input.datasetId.split("+"), ...stringArray(input.lineage?.datasets)]))];
    const resultId = `analysis-${predicate}-${crypto.randomUUID()}`;
    const sourceInputs = uniqueByResultId(inputs.flatMap(geometrySourceInputs));
    const operationTrail = uniqueByResultId(inputs.flatMap(geometryOperationTrail));
    const nextOperationTrail = [...operationTrail, { resultId, operation: predicate, inputResultIds: ids, method: outcome.method }];
    assertBoundedLineage(sourceInputs, nextOperationTrail);
    const result: AnalysisResult = {
      resultId, datasetId: datasets.join("+"), rows, recordGrain: "feature",
      geometry: { type: outcome.geometry?.type ?? (predicate === "measure_geometry" ? "none" : "MultiPolygon"), role: predicate === "measure_geometry" ? "none" : "derived", spatialAnalysisEligible: predicate !== "measure_geometry" },
      sourceRefs: uniqueSourceRefs(inputs),
      lineage: { format: "bounded_geometry_v03_flat", datasets, authorizedDatasetIds: datasets, inputResultIds: ids, sourceInputs, operationTrail: nextOperationTrail },
      coverage: [...new Set(inputs.map(input => input.coverage))].join(" | "), freshness: inputs.some(input => input.freshness === "stale") ? "stale" : inputs.some(input => input.freshness === "unknown") ? "unknown" : "current",
      units: { areaM2: "m²", lengthM: "m", boundaryLengthM: "m" }, operation: predicate as AnalysisResult["operation"], inputResultIds: ids,
      method: outcome.method, summary: outcome.summary,
    };
    this.store.put(result);
    return page(result, 0, limit);
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
    if (operation === "create_analysis_scope") return this.createAnalysisScope(args);
    if (operation === "list_results") return { results: this.store.list().map(item => page(item as StoredDataResult, 0, 1)).map(({ rows: _rows, ...summary }) => summary) };
    if (operation === "remove_result") return { resultId: id(args.resultId), removed: this.store.remove(id(args.resultId)) };
    if (operation === "get_analysis_result") return this.getPage(id(args.resultId), args.offset, args.limit);
    if (operation === "get_result_bounds") return this.bounds(Array.isArray(args.resultIds) ? args.resultIds.map(id) : []);
    if (operation === "get_data_quality") return this.operations.qualitySummary(id(args.resultId)) as unknown as Record<string, unknown>;
    if (operation === "get_record_evidence") return this.operations.recordEvidence(id(args.resultId), integer(args.recordIndex, 0, 0, 100_000)) as unknown as Record<string, unknown>;
    let result: AnalysisResult;
    if (operation === "spatial_query") {
      if (args.predicate === "contains_center") {
        const center = analysisCenter(args.center);
        result = this.operations.areasContainingCenter({ areaResultId: id(args.areaResultId), center: { lng: center[0], lat: center[1] } });
      } else if (args.predicate === "within" || args.predicate === "intersects") {
        result = this.operations.spatialJoin({ pointResultId: id(args.pointResultId), areaResultId: id(args.areaResultId), predicate: args.predicate });
      } else if (args.predicate === "line_intersects") {
        result = this.operations.lineIntersects({ lineResultId: id(args.lineResultId), areaResultId: id(args.areaResultId) });
      } else {
        const center = args.center;
        if (!Array.isArray(center) || center.length !== 2 || !center.every(part => typeof part === "number" && Number.isFinite(part))) throw new Error("INVALID_INPUT");
        const point = { lng: center[0] as number, lat: center[1] as number };
        result = args.predicate === "nearest"
          ? this.operations.nearest({ resultId: id(args.resultId), center: point, limit: integer(args.limit, 20, 1, 50) })
          : args.predicate === "within_distance" && typeof args.radiusM === "number"
            ? this.operations.withinDistance({ resultId: id(args.resultId), center: point, radiusM: args.radiusM })
            : (() => { throw new Error("INVALID_INPUT"); })();
      }
    } else if (operation === "aggregate_by_area") {
      result = this.operations.aggregateByArea({ pointResultId: id(args.pointResultId), areaResultId: id(args.areaResultId), predicate: args.predicate === "intersects" ? "intersects" : "within", ...(typeof args.outputField === "string" ? { outputField: args.outputField } : {}) });
    } else if (operation === "aggregate_records") {
      result = this.operations.aggregate({ resultId: id(args.resultId), operation: args.operation as Parameters<AnalysisOperations["aggregate"]>[0]["operation"], ...(typeof args.field === "string" ? { field: args.field } : {}), ...(Array.isArray(args.groupBy) ? { groupBy: args.groupBy as string[] } : {}) });
    } else if (operation === "join_records") {
      result = this.operations.keyJoin({ leftResultId: id(args.leftResultId), rightResultId: id(args.rightResultId), leftKey: String(args.leftKey ?? ""), rightKey: String(args.rightKey ?? ""), cardinality: args.cardinality as "one_to_one" | "one_to_many" });
    } else if (operation === "calculate_metric") {
      result = this.operations.calculateMetric({ resultId: id(args.resultId), operation: args.operation as "ratio" | "difference", numeratorField: String(args.numeratorField ?? ""), denominatorField: String(args.denominatorField ?? ""), ...(typeof args.outputField === "string" ? { outputField: args.outputField } : {}), ...(typeof args.unit === "string" || args.unit === null ? { unit: args.unit } : {}) });
    } else if (operation === "compare_regions") {
      result = this.operations.compareRegions({ resultId: id(args.resultId), areaCodes: Array.isArray(args.areaCodes) ? args.areaCodes as string[] : [], baselineAreaCode: String(args.baselineAreaCode ?? ""), ...(args.denominatorResultId ? { denominatorResultId: id(args.denominatorResultId) } : {}), ...(typeof args.per === "number" ? { per: args.per } : {}) });
    } else if (operation === "read_series") {
      result = this.operations.readSeries({ resultId: id(args.resultId), timeField: String(args.timeField ?? ""), resolution: args.resolution as "day" | "week", operation: args.operation as "count" | "sum" | "mean", ...(typeof args.valueField === "string" ? { valueField: args.valueField } : {}) });
    } else {
      result = this.operations.compareSeries({ currentResultId: id(args.currentResultId), baselineResultId: id(args.baselineResultId), operation: args.operation as "ratio" | "difference" });
    }
    return page(result, 0, args.limit);
  }

  clear(): void { ++this.generation; for (const result of this.store.list()) this.store.remove(result.resultId); this.plans.clear(); }

  /**
   * Keep the current scene's finite collection resident. Derived inputs remain
   * evictable, so the active eight-layer display cannot consume the whole
   * sixteen-result session budget through transitive dependencies.
   */
  setActiveResultCollection(resultIds: readonly string[]): void {
    if (resultIds.length > RESULT_COLLECTION_LIMITS.maxLogicalResults) throw new Error("RESULT_COLLECTION_LOGICAL_LIMIT");
    this.store.setPinned(resultIds);
  }

  private assertResultAccess(resultId: string): void {
    const result = this.store.get(resultId) as StoredDataResult | null;
    if (!result) return;
    const datasets = [...result.datasetId.split("+"), ...(Array.isArray(result.lineage?.datasets) ? result.lineage.datasets.filter((v): v is string => typeof v === "string") : [])];
    for (const datasetId of datasets) { if (datasetId.startsWith("layer:")) assertLayerSourceAccess(datasetId.slice(6), this.locked()); else if (describeDatasetSafe(datasetId)) assertDatasetAccess(datasetId, this.locked()); }
  }

  hasResult(resultId: string): boolean { return this.store.has(resultId); }

  presentable(resultIds: readonly string[]): PresentableResult[] {
    if (!resultIds.length || new Set(resultIds).size !== resultIds.length) throw new Error("INVALID_PRESENTATION_RESULTS");
    if (resultIds.length > RESULT_COLLECTION_LIMITS.maxLogicalResults) throw new Error("RESULT_COLLECTION_LOGICAL_LIMIT");
    const prepared = resultIds.map(resultId => {
      this.assertResultAccess(resultId);
      const result = this.store.get(id(resultId)) as StoredDataResult | null;
      if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
      if (!isMapEligibleGeometry(result.geometry)) throw new Error("RESULT_NOT_MAP_ELIGIBLE");
      const metrics = presentationMetrics(result.rows, result.geometry.type);
      return { result, metrics };
    });
    assertResultCollectionBudget(prepared.map(item => item.metrics));
    return prepared.map(({ result }) => ({ resultId: result.resultId, datasetId: result.datasetId, displayLabel: resultDisplayLabel(result), rows: result.rows, geometry: result.geometry, presentation: result.presentation, units: result.units, ...(result.resultStyle ? { resultStyle: result.resultStyle } : {}) }));
  }

  bounds(resultIds: readonly string[]): { bounds: [number, number, number, number]; pointCount: number; featureCount: number; vertexCount: number } {
    const results = this.presentable(resultIds);
    const metrics = results.map(result => presentationMetrics(result.rows, result.geometry.type as SupportedPresentationGeometry));
    let minLongitude = Infinity; let minLatitude = Infinity; let maxLongitude = -Infinity; let maxLatitude = -Infinity;
    for (const metric of metrics) for (const [longitude, latitude] of metric.positions) {
      minLongitude = Math.min(minLongitude, longitude); minLatitude = Math.min(minLatitude, latitude);
      maxLongitude = Math.max(maxLongitude, longitude); maxLatitude = Math.max(maxLatitude, latitude);
    }
    if (minLongitude === Infinity) throw new Error("RESULT_HAS_NO_MAP_GEOMETRY");
    return { bounds: [minLongitude, minLatitude, maxLongitude, maxLatitude], pointCount: results.filter(result => result.geometry.type === "Point").reduce((n, result) => n + result.rows.length, 0), featureCount: metrics.reduce((n, metric) => n + metric.featureCount, 0), vertexCount: metrics.reduce((n, metric) => n + metric.vertexCount, 0) };
  }

  private getPage(resultId: string, offset?: unknown, limit?: unknown): Record<string, unknown> {
    const result = this.store.get(resultId) as StoredDataResult | null;
    if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
    return page(result, offset, limit);
  }

  /** Register a verified server-side warehouse result; one session result per geometry type. Re-importing an id replaces it. */
  async importWarehouseResult(args: Record<string, unknown>, fetchImpl?: typeof fetch): Promise<Record<string, unknown>> {
    const input = validateWarehouseImportArgs(args);
    const generation = this.generation;
    const results = await withLoading("research:warehouse-result", "載入分析倉庫結果", loadWarehouseResult(input, fetchImpl));
    if (generation !== this.generation) throw new Error("SESSION_REVOKED");
    for (const stale of [input.resultId, ...["point", "linestring", "multilinestring", "polygon", "multipolygon"].map(type => `${input.resultId}:${type}`)]) this.store.remove(stale);
    for (const result of results) this.store.put(result);
    const resultIds = results.map(result => result.resultId);
    return {
      resultId: input.resultId, resultIds, featureCount: input.featureCount,
      ...(input.style ? { styleKind: input.style.kind } : {}),
      geometryTypes: results.map(result => result.geometry.type),
      ...(resultIds.length ? { bounds: this.bounds(resultIds).bounds } : {}),
      next: "Present with pulse_set_result_collection using these resultIds, then wait for scene ready and read map context.",
    };
  }

  private createAnalysisScope(args: Record<string, unknown>): Record<string, unknown> {
    const center = analysisCenter(args.center);
    const radiusM = args.radiusM;
    if (typeof radiusM !== "number" || !Number.isFinite(radiusM) || radiusM < 1 || radiusM > 500_000) throw new Error("INVALID_DISTANCE_RADIUS");
    const label = args.label === undefined ? "分析範圍" : args.label;
    if (typeof label !== "string" || !label.trim() || label.length > 120) throw new Error("INVALID_INPUT");
    const createdAt = new Date().toISOString();
    const scopeId = `scope-${Date.now().toString(36)}`;
    const common = {
      operation: "analysis_scope" as const, inputResultIds: [] as const,
      sourceRefs: [] as const, coverage: `Geodesic circle centered at ${center[0]},${center[1]} with radius ${radiusM} m.`, freshness: "current" as const,
      units: { radiusM: "m" }, excludedByReason: {},
      lineage: { origin: "agent_supplied_center", createdAt, scopeId, authoritativeBoundary: false, networkAccessibility: false },
      method: { operation: "create_analysis_scope", version: "0.1", distanceModel: "WGS84_spherical_geodesic", earthRadiusM: 6_371_008.8, radiusM, polygonSegments: 64, notWalkingIsochrone: true },
    };
    const area: AnalysisResult = {
      ...common, resultId: `analysis-scope-area-${scopeId}`, datasetId: "derived:analysis-scope-area", recordGrain: "feature",
      rows: [{ record_id: `${scopeId}:area`, label: label.trim(), radiusM, geometry: { type: "Polygon", coordinates: [geodesicCircle(center, radiusM)] } }],
      geometry: { type: "Polygon", role: "generalized", spatialAnalysisEligible: false },
      summary: { featureCount: 1, geometryPart: "area", radiusM, boundaryMeaning: "Derived display scope; not an administrative boundary or walking isochrone." },
    };
    const anchor: AnalysisResult = {
      ...common, resultId: `analysis-scope-center-${scopeId}`, datasetId: "derived:analysis-scope-center", recordGrain: "feature",
      rows: [{ record_id: `${scopeId}:center`, label: label.trim(), radiusM, geometry: { type: "Point", coordinates: center } }],
      geometry: { type: "Point", role: "generalized", spatialAnalysisEligible: false },
      summary: { featureCount: 1, geometryPart: "center", center, pointMeaning: "Derived analysis anchor; not a source-observed place record." },
    };
    this.store.put(area);
    this.store.put(anchor);
    return {
      scopeId, label: label.trim(), center, radiusM, distanceModel: "WGS84_spherical_geodesic", networkAccessibility: false,
      // Geometry remains in the result store and is fetched by resultId. A
      // polygon ring can exceed the Gateway's nested-container contract, so
      // never embed it in the command receipt.
      resultIds: [area.resultId, anchor.resultId],
      // Preserve the established response names so existing MCP plans can read
      // result IDs without carrying an unbounded GeoJSON page.
      area: { resultId: area.resultId, datasetId: area.datasetId, geometryType: area.geometry.type, geometryRole: area.geometry.role, spatialAnalysisEligible: area.geometry.spatialAnalysisEligible, featureCount: 1, radiusM },
      centerResult: { resultId: anchor.resultId, datasetId: anchor.datasetId, geometryType: anchor.geometry.type, geometryRole: anchor.geometry.role, spatialAnalysisEligible: anchor.geometry.spatialAnalysisEligible, featureCount: 1, center },
      limitations: ["This is a straight-line geodesic display scope, not a walking route or isochrone.", "The polygon is derived geometry and is not an authoritative administrative boundary."],
    };
  }
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

function describeDatasetSafe(datasetId: string): boolean { try { describeDataset(datasetId); return true; } catch { return false; } }

function resultDisplayLabel(result: StoredDataResult): string {
  if (isAnalysis(result) && ["line_buffer", "surface_intersection"].includes(result.operation)) return String(result.rows[0]?.label ?? "面交集（空結果）");
  const rowLabel = typeof result.rows[0]?.label === "string" && result.rows[0].label.trim() ? result.rows[0].label.trim() : "分析範圍";
  if (result.datasetId.startsWith("warehouse:")) return String(isAnalysis(result) ? (result.summary as Record<string, unknown>).label ?? result.datasetId : result.datasetId);
  if (result.datasetId === "derived:analysis-scope-area") return `${rowLabel}・範圍`;
  if (result.datasetId === "derived:analysis-scope-center") return `${rowLabel}・中心點`;
  if (result.datasetId.startsWith("derived:valhalla-walking-")) return rowLabel;
  if (isAnalysis(result) && result.operation === "spatial_join") {
    const pointDatasetId = result.datasetId.split("+")[0]!;
    let sourceLabel = pointDatasetId;
    try { sourceLabel = describeDataset(pointDatasetId).label; } catch { /* retain source identity */ }
    return `${sourceLabel}・範圍篩選`;
  }
  if (isAnalysis(result) && ["compare_regions", "compare_series"].includes(result.operation)) {
    const datasetIds = [...new Set(result.datasetId.split("+").filter(Boolean))];
    if (datasetIds.length > 1) return `${datasetIds.map(datasetId => {
      try { return describeDataset(datasetId).label; } catch { return datasetId; }
    }).join("＋")} 比較`;
  }
  try { return describeDataset(result.datasetId).label; } catch { return result.datasetId; }
}

/** Prefer a source feature name, retaining a bounded identifier when none is declared. */
function geometryInputLabel(result: StoredDataResult): string {
  const row = result.rows[0];
  for (const key of ["label", "name", "route_label", "area_name", "route_id", "id"]) {
    const value = row?.[key];
    if ((typeof value === "string" && value.trim()) || typeof value === "number") return String(value).trim().slice(0, 100);
  }
  return `${resultDisplayLabel(result).slice(0, 80)}（${result.resultId.slice(-12)}）`;
}
