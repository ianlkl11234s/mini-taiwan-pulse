import { neighborhoodCount, type NeighborhoodCountResult } from "./neighborhoodAnalysis";
import { assertDatasetAccess, assertLayerSourceAccess } from "./dataExploration";
import { AnalysisOperations, type AnalysisResult, type StoredDataResult } from "./analysisOperations";
import type { QueryRecordsInput } from "./queryExecutor";
import { queryRecordsDetailed } from "./researchDatasets";
import { describeDataset, ensureDataset } from "./researchDatasets";
import { BrowserMemoryResultStore, type ResultReference } from "./resultStore";
import type { WalkingIsochroneExecution } from "./networkProvider";

export type AnalysisQueryOperation = "compare_neighborhoods" | "create_analysis_scope" | "spatial_query" | "aggregate_by_area" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series" | "get_data_quality" | "get_record_evidence" | "get_analysis_result" | "get_result_bounds" | "list_results" | "remove_result";
export type PresentableResult = Pick<StoredDataResult, "resultId" | "datasetId" | "rows" | "geometry" | "presentation"> & { displayLabel?: string };

/**
 * Presentation is a collection, rather than a domain-specific single result.
 * These are deliberately finite browser budgets, not a statement about how
 * many results an analysis session can retain or how many records exist at the
 * source.
 */
export const RESULT_COLLECTION_LIMITS = {
  // BrowserMemoryResultStore keeps at most eight session-local results.
  maxLogicalResults: 8,
  maxFeatures: 10_000,
  maxVertices: 100_000,
  maxBytes: 8 * 1024 * 1024,
} as const;

type Position = [number, number];
type SupportedPresentationGeometry = "Point" | "Polygon" | "MultiPolygon";

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 && value.every(part => typeof part === "number" && Number.isFinite(part));
}

function samePosition(left: Position, right: Position): boolean { return left[0] === right[0] && left[1] === right[1]; }

function polygonPositions(value: unknown): Position[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const positions: Position[] = [];
  for (const ring of value) {
    if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition) || !samePosition(ring[0]!, ring[ring.length - 1]!)) return null;
    positions.push(...ring);
  }
  return positions;
}

function geometryPositions(value: unknown, expectedType: SupportedPresentationGeometry): Position[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== expectedType) return null;
  if (expectedType === "Point") return isPosition(geometry.coordinates) ? [geometry.coordinates] : null;
  if (expectedType === "Polygon") return polygonPositions(geometry.coordinates);
  if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return null;
  const positions: Position[] = [];
  for (const polygon of geometry.coordinates) {
    const polygonVertices = polygonPositions(polygon);
    if (!polygonVertices) return null;
    positions.push(...polygonVertices);
  }
  return positions;
}

export function presentationMetrics(rows: readonly Record<string, unknown>[], type: SupportedPresentationGeometry): { featureCount: number; vertexCount: number; bytes: number; positions: Position[] } {
  const positions: Position[] = [];
  for (const row of rows) {
    const vertices = geometryPositions(row.geometry, type);
    if (!vertices) throw new Error("RESULT_PRESENTATION_GEOMETRY_MISMATCH");
    positions.push(...vertices);
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

function isMapEligibleGeometry(geometry: PresentableResult["geometry"]): geometry is PresentableResult["geometry"] & { type: SupportedPresentationGeometry } {
  if (geometry.type === "Point") return geometry.role === "actual" && geometry.spatialAnalysisEligible || geometry.role === "generalized" && !geometry.spatialAnalysisEligible;
  return (geometry.type === "Polygon" || geometry.type === "MultiPolygon") && (geometry.role === "actual" || geometry.role === "derived" || geometry.role === "generalized");
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
      if (args.predicate === "within" || args.predicate === "intersects") {
        result = this.operations.spatialJoin({ pointResultId: id(args.pointResultId), areaResultId: id(args.areaResultId), predicate: args.predicate });
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
    return prepared.map(({ result }) => ({ resultId: result.resultId, datasetId: result.datasetId, displayLabel: resultDisplayLabel(result), rows: result.rows, geometry: result.geometry, presentation: result.presentation }));
  }

  bounds(resultIds: readonly string[]): { bounds: [number, number, number, number]; pointCount: number; featureCount: number; vertexCount: number } {
    const results = this.presentable(resultIds);
    const metrics = results.map(result => presentationMetrics(result.rows, result.geometry.type as SupportedPresentationGeometry));
    const positions = metrics.flatMap(metric => metric.positions);
    if (!positions.length) throw new Error("RESULT_HAS_NO_MAP_GEOMETRY");
    const lngs = positions.map(position => position[0]); const lats = positions.map(position => position[1]);
    return { bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], pointCount: results.filter(result => result.geometry.type === "Point").reduce((n, result) => n + result.rows.length, 0), featureCount: metrics.reduce((n, metric) => n + metric.featureCount, 0), vertexCount: metrics.reduce((n, metric) => n + metric.vertexCount, 0) };
  }

  private getPage(resultId: string, offset?: unknown, limit?: unknown): Record<string, unknown> {
    const result = this.store.get(resultId) as StoredDataResult | null;
    if (!result) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
    return page(result, offset, limit);
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
      resultIds: [area.resultId, anchor.resultId], area: page(area, 0, 1), centerResult: page(anchor, 0, 1),
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
  const rowLabel = typeof result.rows[0]?.label === "string" && result.rows[0].label.trim() ? result.rows[0].label.trim() : "分析範圍";
  if (result.datasetId === "derived:analysis-scope-area") return `${rowLabel}・範圍`;
  if (result.datasetId === "derived:analysis-scope-center") return `${rowLabel}・中心點`;
  if (result.datasetId.startsWith("derived:valhalla-walking-")) return rowLabel;
  try { return describeDataset(result.datasetId).label; } catch { return result.datasetId; }
}
