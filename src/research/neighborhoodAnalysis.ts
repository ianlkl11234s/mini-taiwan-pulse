import type { StoredDataResult } from "./analysisOperations";
import type { SourceReceipt } from "./dataContracts";

type Row = Record<string, unknown>;
type Point = { type: "Point"; coordinates: [number, number] };

export interface NeighborhoodCountInput {
  candidates: StoredDataResult;
  sources: readonly StoredDataResult[];
  radiusM: number;
  /** Whether a candidate counts its same-index record when it is also a source. */
  includeSelf: boolean;
  /** Optional presentation order only; it never changes any count. */
  rankSourceIndex?: number;
}

/** Deliberately separate from AnalysisResult until its operation union is integrated. */
export interface NeighborhoodCountResult extends StoredDataResult {
  operation: "neighborhood_count";
  inputResultIds: readonly string[];
  method: Readonly<{
    algorithm: "haversine";
    radiusM: number;
    includeSelf: boolean;
    rankSourceIndex: number | null;
    sourceCountFields: readonly string[];
  }>;
  summary: Readonly<{
    candidates: number;
    sources: number;
    sourceRecords: number;
    pairComparisons: number;
    totalMatched: number;
    returned: number;
    displayTruncated: false;
    analysisComplete: true;
    countsLimitedToProvidedSourceSnapshots: true;
  }>;
}

const MAX_CANDIDATES = 2_000;
const MAX_SOURCE_RECORDS = 20_000;
const MAX_PAIR_COMPARISONS = 5_000_000;
let sequence = 0;

function actualPoints(result: unknown): asserts result is StoredDataResult {
  if (!result || typeof result !== "object" || !Array.isArray((result as StoredDataResult).rows)
    || !Array.isArray((result as StoredDataResult).sourceRefs) || !(result as StoredDataResult).geometry) throw new Error("INVALID_STORED_RESULT");
  const geometry = (result as StoredDataResult).geometry;
  if (geometry.type !== "Point" || geometry.role !== "actual" || !geometry.spatialAnalysisEligible) throw new Error("SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY");
}

function wgs84Point(value: unknown): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_WGS84_POINT_GEOMETRY");
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) throw new Error("INVALID_WGS84_POINT_GEOMETRY");
  const [lng, lat] = geometry.coordinates;
  if (typeof lng !== "number" || !Number.isFinite(lng) || Math.abs(lng) > 180 || typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90) throw new Error("INVALID_WGS84_POINT_GEOMETRY");
  return { type: "Point", coordinates: [lng, lat] };
}

function haversineMeters(a: Point, b: Point): number {
  const radians = Math.PI / 180;
  const lat1 = a.coordinates[1] * radians;
  const lat2 = b.coordinates[1] * radians;
  const dLat = lat2 - lat1;
  const dLng = (b.coordinates[0] - a.coordinates[0]) * radians;
  const h = Math.max(0, Math.min(1, Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2));
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function mergedFreshness(inputs: readonly StoredDataResult[]): StoredDataResult["freshness"] {
  return inputs.some(input => input.freshness === "stale") ? "stale" : inputs.some(input => input.freshness === "unknown") ? "unknown" : "current";
}

function mergedExclusions(inputs: readonly StoredDataResult[]): Record<string, number> {
  const combined: Record<string, number> = {};
  for (const input of inputs) for (const [reason, count] of Object.entries(input.excludedByReason ?? {})) combined[reason] = (combined[reason] ?? 0) + count;
  return combined;
}

/**
 * Counts source records around each candidate over complete supplied snapshots.
 * A zero means no supplied source record was within radius; it says nothing about
 * coverage beyond those snapshots.
 */
export function neighborhoodCount(input: NeighborhoodCountInput): NeighborhoodCountResult {
  if (!input || typeof input !== "object" || !Number.isFinite(input.radiusM) || input.radiusM < 100 || input.radiusM > 5_000 || typeof input.includeSelf !== "boolean") throw new Error("INVALID_NEIGHBORHOOD_INPUT");
  actualPoints(input.candidates);
  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 4) throw new Error("INVALID_NEIGHBORHOOD_SOURCES");
  for (const source of input.sources) actualPoints(source);
  if (!Number.isInteger(input.rankSourceIndex ?? 0) || input.rankSourceIndex !== undefined && (input.rankSourceIndex < 0 || input.rankSourceIndex >= input.sources.length)) throw new Error("INVALID_NEIGHBORHOOD_RANK_SOURCE");
  if (input.candidates.rows.length > MAX_CANDIDATES) throw new Error("NEIGHBORHOOD_CANDIDATE_LIMIT_EXCEEDED");
  const sourceRecords = input.sources.reduce((total, source) => total + source.rows.length, 0);
  if (sourceRecords > MAX_SOURCE_RECORDS) throw new Error("NEIGHBORHOOD_SOURCE_RECORD_LIMIT_EXCEEDED");
  const pairComparisons = input.candidates.rows.length * sourceRecords;
  if (pairComparisons > MAX_PAIR_COMPARISONS) throw new Error("NEIGHBORHOOD_PAIR_COMPARISON_LIMIT_EXCEEDED");

  const candidatePoints = input.candidates.rows.map(row => wgs84Point(row.geometry));
  const sourcePoints = input.sources.map(source => source.rows.map((row: Row) => wgs84Point(row.geometry)));
  const countFields = input.sources.map((_, index) => `source_${index}_count`);
  const rows: Row[] = input.candidates.rows.map((candidate, candidateIndex) => {
    const counts = input.sources.map((source, sourceIndex) => source.rows.reduce((count, _, recordIndex) => {
      const isSameRecord = source.resultId === input.candidates.resultId && recordIndex === candidateIndex;
      return !input.includeSelf && isSameRecord ? count : count + Number(haversineMeters(candidatePoints[candidateIndex]!, sourcePoints[sourceIndex]![recordIndex]!) <= input.radiusM);
    }, 0));
    return { ...structuredClone(candidate), ...Object.fromEntries(countFields.map((field, index) => [field, counts[index]!])) };
  });
  if (input.rankSourceIndex !== undefined) {
    const field = countFields[input.rankSourceIndex]!;
    rows.sort((left, right) => (right[field] as number) - (left[field] as number));
  }

  const inputs = [input.candidates, ...input.sources];
  sequence += 1;
  return {
    resultId: `analysis-neighborhood_count-${Date.now().toString(36)}-${sequence}`,
    datasetId: inputs.map(result => result.datasetId).join("+"),
    rows: structuredClone(rows),
    recordGrain: input.candidates.recordGrain,
    geometry: structuredClone(input.candidates.geometry),
    sourceRefs: inputs.flatMap(result => result.sourceRefs).map(receipt => structuredClone(receipt)) as SourceReceipt[],
    lineage: {
      claimScope: "Ranking applies only to the supplied candidate source-record locations, NOT arbitrary locations, households or all land in the city. Counts are nearby source records, not educational quality or deduplicated institutions.",
      sourceScope: "Each source may be filtered. Features beyond its supplied scope are not searched; administrative-edge effects must be disclosed if sources are city-filtered.",
      candidates: { resultId: input.candidates.resultId, datasetId: input.candidates.datasetId, records: input.candidates.rows.length, lineage: structuredClone(input.candidates.lineage ?? null) },
      sources: input.sources.map((source, index) => ({ countField: countFields[index], resultId: source.resultId, datasetId: source.datasetId, records: source.rows.length, lineage: structuredClone(source.lineage ?? null) })),
    },
    coverage: inputs.map(result => result.coverage).join(" | "),
    freshness: mergedFreshness(inputs),
    units: { ...input.candidates.units, ...Object.fromEntries(countFields.map(field => [field, "records"])) },
    excludedByReason: mergedExclusions(inputs),
    operation: "neighborhood_count",
    inputResultIds: inputs.map(result => result.resultId),
    method: { algorithm: "haversine", radiusM: input.radiusM, includeSelf: input.includeSelf, rankSourceIndex: input.rankSourceIndex ?? null, sourceCountFields: countFields },
    summary: { candidates: input.candidates.rows.length, sources: input.sources.length, sourceRecords, pairComparisons, totalMatched: rows.length, returned: rows.length, displayTruncated: false, analysisComplete: true, countsLimitedToProvidedSourceSnapshots: true },
  };
}
