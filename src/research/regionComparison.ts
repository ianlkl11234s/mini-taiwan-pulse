import type { ResultGeometry, StoredDataResult } from "./analysisOperations";

type Row = Record<string, unknown>;
type ValueStatus = "observed" | "missing" | "suppressed" | "not_reported";

export interface CompareRegionsInput {
  areaCodes: readonly string[];
  baselineAreaCode: string;
  denominatorResult?: StoredDataResult;
  per?: number;
}

export interface RegionComparisonRow extends Record<string, unknown> {
  area_code: string;
  area_name: string | null;
  value: number | null;
  status: ValueStatus;
  absoluteDifference: number | null;
  ratio: number | null;
  comparison_status: "valid" | "missing" | "suppressed" | "not_reported" | "baseline_missing" | "baseline_suppressed" | "baseline_not_reported" | "baseline_zero";
  normalizedValue: number | null;
  normalization_status: "not_requested" | "valid" | "missing" | "suppressed" | "not_reported" | "denominator_missing" | "denominator_suppressed" | "denominator_not_reported" | "zero_denominator";
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface RegionComparisonResult {
  rows: readonly RegionComparisonRow[];
  method: Readonly<Record<string, unknown>>;
  summary: Readonly<Record<string, unknown>>;
  units: Readonly<Record<string, string | null>>;
  geometry: ResultGeometry;
}

type Contract = {
  datasetId: string;
  indicatorId: string;
  dimensions: string;
  periodStart: string;
  periodEnd: string;
  unit: string;
  level: string;
  boundaryVersion: string;
  boundarySha256: string;
  releaseId: string;
};

type CanonicalRow = {
  areaCode: string;
  areaName: string | null;
  value: number | null;
  status: ValueStatus;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
};

const POPULATION_UNITS = new Set(["person", "persons", "人", "人口"]);
const POPULATION_INDICATORS = new Set(["population", "resident_population", "total_population", "registered_population"]);

function canonicalJson(value: unknown): string | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : null;
  if (Array.isArray(value)) {
    const items = value.map(canonicalJson);
    return items.some(item => item === null) ? null : `[${items.join(",")}]`;
  }
  if (!value || typeof value !== "object") return null;
  const items = Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => {
    const encoded = canonicalJson(item);
    return encoded === null ? null : `${JSON.stringify(key)}:${encoded}`;
  });
  return items.some(item => item === null) ? null : `{${items.join(",")}}`;
}

function stringField(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || !value) throw new Error("REGION_COMPARISON_INSUFFICIENT_CONTRACT");
  return value;
}

function geometry(value: unknown): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as GeoJSON.Geometry;
  return candidate.type === "Polygon" || candidate.type === "MultiPolygon" ? candidate : null;
}

function materialize(source: StoredDataResult): { contract: Contract; rows: Map<string, CanonicalRow> } {
  if (source.recordGrain !== "admin_statistic" || source.rows.length === 0) throw new Error("REGION_COMPARISON_REQUIRES_ADMIN_STATISTICS");
  const rows = new Map<string, CanonicalRow>();
  let contract: Contract | null = null;
  for (const row of source.rows) {
    const dimensions = canonicalJson(row.dimensions);
    if (dimensions === null) throw new Error("REGION_COMPARISON_INSUFFICIENT_CONTRACT");
    const next: Contract = {
      datasetId: stringField(row, "dataset_id"), indicatorId: stringField(row, "indicator_id"), dimensions,
      periodStart: stringField(row, "period_start"), periodEnd: stringField(row, "period_end"), unit: stringField(row, "unit"),
      level: stringField(row, "level"), boundaryVersion: stringField(row, "boundary_version"), boundarySha256: stringField(row, "boundary_sha256"), releaseId: stringField(row, "release_id"),
    };
    if (contract && Object.keys(contract).some(key => contract![key as keyof Contract] !== next[key as keyof Contract])) throw new Error("REGION_COMPARISON_AMBIGUOUS_CONTRACT");
    contract = next;
    const areaCode = stringField(row, "area_code");
    if (rows.has(areaCode)) throw new Error("REGION_COMPARISON_DUPLICATE_AREA_OBSERVATION");
    const status = row.status;
    if (status !== "observed" && status !== "missing" && status !== "suppressed" && status !== "not_reported") throw new Error("REGION_COMPARISON_INVALID_STATUS");
    const value = row.value;
    if (status === "observed" ? typeof value !== "number" || !Number.isFinite(value) : value !== null) throw new Error("REGION_COMPARISON_INVALID_VALUE_STATUS");
    rows.set(areaCode, { areaCode, areaName: typeof row.area_name === "string" ? row.area_name : null, value: value as number | null, status, geometry: geometry(row.geometry) });
  }
  const declaredUnit = source.units.value;
  if (declaredUnit !== null && declaredUnit !== undefined && declaredUnit !== contract!.unit) throw new Error("REGION_COMPARISON_INSUFFICIENT_CONTRACT");
  return { contract: contract!, rows };
}

function assertInput(input: CompareRegionsInput): string[] {
  if (!Array.isArray(input.areaCodes) || input.areaCodes.length < 2 || input.areaCodes.length > 8 || !input.areaCodes.every(code => typeof code === "string" && code)) throw new Error("INVALID_REGION_COMPARISON_AREAS");
  const codes = [...input.areaCodes];
  if (new Set(codes).size !== codes.length || !codes.includes(input.baselineAreaCode)) throw new Error("INVALID_REGION_COMPARISON_AREAS");
  if (input.per !== undefined && (!Number.isFinite(input.per) || input.per <= 0)) throw new Error("INVALID_NORMALIZATION_SCALE");
  return codes;
}

function compareStatus(value: CanonicalRow, baseline: CanonicalRow): RegionComparisonRow["comparison_status"] {
  if (value.status !== "observed") return value.status;
  if (baseline.status !== "observed") return baseline.status === "missing" ? "baseline_missing" : baseline.status === "suppressed" ? "baseline_suppressed" : "baseline_not_reported";
  return baseline.value === 0 ? "baseline_zero" : "valid";
}

function compatibleDenominator(numerator: Contract, denominator: Contract): void {
  for (const key of ["level", "boundaryVersion", "boundarySha256", "periodStart", "periodEnd"] as const) {
    if (numerator[key] !== denominator[key]) throw new Error("REGION_COMPARISON_DENOMINATOR_INCOMPATIBLE");
  }
  if (!POPULATION_UNITS.has(denominator.unit) || !POPULATION_INDICATORS.has(denominator.indicatorId) || !totalPopulationDimensions(denominator.dimensions)) throw new Error("REGION_COMPARISON_DENOMINATOR_NOT_POPULATION");
}

function totalPopulationDimensions(encoded: string): boolean {
  const value: unknown = JSON.parse(encoded);
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Row).every(item => item === "all" || item === "total" || item === null);
}

/** Compare selected canonical administrative statistics without aggregating, interpolating, or coercing statuses. */
export function compareRegions(source: StoredDataResult, input: CompareRegionsInput): RegionComparisonResult {
  const codes = assertInput(input);
  const numerator = materialize(source);
  const selected = codes.map(code => {
    const row = numerator.rows.get(code);
    if (!row) throw new Error("REGION_COMPARISON_AREA_NOT_IN_RESULT");
    return row;
  });
  const baseline = numerator.rows.get(input.baselineAreaCode)!;
  const per = input.per ?? 10_000;
  const denominator = input.denominatorResult ? materialize(input.denominatorResult) : null;
  if (denominator) {
    compatibleDenominator(numerator.contract, denominator.contract);
    if ([...denominator.rows.values()].some(row => row.status === "observed" && row.value! < 0)) throw new Error("REGION_COMPARISON_INVALID_POPULATION_VALUE");
  }
  // Administrative value comparisons do not run topology. Retain display
  // polygons without upgrading generalized geometry to analytical eligibility.
  const allGeometryRetained = ["Polygon", "MultiPolygon"].includes(source.geometry.type)
    && (source.geometry.role === "generalized" || source.geometry.role === "actual" && source.geometry.spatialAnalysisEligible)
    && selected.every(row => row.geometry !== null);
  const rows = selected.map(row => {
    const comparison = compareStatus(row, baseline);
    const denominatorRow = denominator?.rows.get(row.areaCode);
    let normalizationStatus: RegionComparisonRow["normalization_status"] = "not_requested";
    let normalizedValue: number | null = null;
    if (denominator) {
      if (!denominatorRow || denominatorRow.status === "missing") normalizationStatus = "denominator_missing";
      else if (denominatorRow.status === "suppressed") normalizationStatus = "denominator_suppressed";
      else if (denominatorRow.status === "not_reported") normalizationStatus = "denominator_not_reported";
      else if (denominatorRow.value === 0) normalizationStatus = "zero_denominator";
      else if (row.status === "missing") normalizationStatus = "missing";
      else if (row.status === "suppressed") normalizationStatus = "suppressed";
      else if (row.status === "not_reported") normalizationStatus = "not_reported";
      else { normalizationStatus = "valid"; normalizedValue = row.value! / denominatorRow.value! * per; }
    }
    return {
      area_code: row.areaCode, area_name: row.areaName, value: row.value, status: row.status,
      absoluteDifference: row.status === "observed" && baseline.status === "observed" ? row.value! - baseline.value! : null,
      ratio: comparison === "valid" ? row.value! / baseline.value! : null,
      comparison_status: comparison, normalizedValue, normalization_status: normalizationStatus,
      ...(allGeometryRetained ? { geometry: row.geometry! } : {}),
    };
  });
  const byStatus = (status: string, field: "status" | "comparison_status" | "normalization_status") => rows.filter(row => row[field] === status).length;
  return {
    rows,
    method: { operation: "compare_regions", sourceContract: numerator.contract, baselineAreaCode: input.baselineAreaCode, areaCodes: codes, comparison: "absolute_difference_and_ratio_to_baseline", normalization: denominator ? { denominatorContract: denominator.contract, per, formula: "value / population * per" } : null, noAggregation: true, noAreaInterpolation: true },
    summary: { areasRequested: codes.length, observed: byStatus("observed", "status"), missing: byStatus("missing", "status"), suppressed: byStatus("suppressed", "status"), comparable: byStatus("valid", "comparison_status"), normalized: byStatus("valid", "normalization_status"), geometriesRetained: allGeometryRetained ? rows.length : 0 },
    units: { value: numerator.contract.unit, absoluteDifference: numerator.contract.unit, ratio: "ratio", normalizedValue: denominator ? `${numerator.contract.unit} per ${per} persons` : null },
    geometry: allGeometryRetained ? source.geometry : { type: "none", role: "none", spatialAnalysisEligible: false },
  };
}
