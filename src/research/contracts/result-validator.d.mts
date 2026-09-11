export const RESULT_SCHEMA_VERSION: 'research-result/0.1';
export const MAX_RESULT_BYTES: number;
export const MAX_FEATURES: number;
export const MAX_VERTICES: number;
export const MAX_TEXT_BYTES: number;
export const MAX_ERRORS: number;
export const MAX_TABLE_COLUMNS: number;
export const MAX_TABLE_ROWS: number;
export const MAX_RING_VERTICES: number;
export const MAX_SEGMENT_PAIR_COMPARISONS: number;

export type MetricStatus = 'valid' | 'partial' | 'unknown' | 'suppressed' | 'undefined' | 'not_comparable' | 'error';
export type CoverageStatus = 'complete' | 'partial' | 'none' | 'unknown';
export type Scalar = string | number | boolean | null;
export interface TimeInterval { start: string | null; end: string | null; }
export interface Scope { spatialRef: string; timeInterval: TimeInterval | null; }
export interface Coverage { status: CoverageStatus; requested: { spatialRef: string | null; timeInterval: TimeInterval | null }; covered: { spatialRef: string | null; timeInterval: TimeInterval | null }; dataVersion: string | null; validInputCount: number; }
export interface RatioComponent { value: number | null; status: MetricStatus; unit: string; }
export interface Metric { name: string; value: number | null; unit: string; status: MetricStatus; scope: Scope; coverage: CoverageStatus; reason?: string; numerator?: RatioComponent; denominator?: RatioComponent; }
export type Position = [number, number];
/** Phase A deliberately excludes MultiPolygon and polygon holes. */
export type Geometry = { type: 'Point'; coordinates: Position; bbox?: [number, number, number, number] } | { type: 'MultiPoint' | 'LineString'; coordinates: Position[]; bbox?: [number, number, number, number] } | { type: 'MultiLineString'; coordinates: Position[][]; bbox?: [number, number, number, number] } | { type: 'Polygon'; coordinates: [Position[]]; bbox?: [number, number, number, number] };
export interface Feature { type: 'Feature'; geometry: Geometry | null; properties: Record<string, Scalar>; id?: string | number; bbox?: [number, number, number, number]; }
export interface FeatureCollection { type: 'FeatureCollection'; features: Feature[]; bbox?: [number, number, number, number]; }
export interface ResearchResult { schemaVersion: 'research-result/0.1'; artifactId: string; title: string; createdAt: string; inputMode: 'synthetic'; inputs: []; method: { name: string; version: string; parameters: unknown; scriptHash: string; environmentRef: string }; geojson: FeatureCollection | null; table: { columns: string[]; rows: Scalar[][] } | null; metrics: Metric[]; quality: { executionStatus: 'succeeded' | 'partial' | 'failed' | 'cancelled'; coverage: Coverage; freshness: { status: 'fresh' | 'stale' | 'unknown' | 'not_applicable'; evaluatedAt: string; observedAt: string | null; sourceVersion: string | null; thresholdPolicyRef: string | null }; exclusions: Record<'missing_geometry' | 'invalid_geometry' | 'missing_value' | 'duplicate' | 'outside_scope', number | null>; analysisComplete: boolean; displayTruncated: boolean }; sourceRefs: string[]; licenseRefs: string[]; limitations: string[]; }
export interface ValidationError { path: string; code: string; message: string; }
export interface ValidationResult { valid: boolean; errors: ValidationError[]; }
export function validateResult(input: unknown): ValidationResult;
export function assertValidResult<T>(input: T): T;
