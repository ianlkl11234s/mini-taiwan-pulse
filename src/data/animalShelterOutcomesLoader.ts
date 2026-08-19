import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

export interface AnimalShelterOutcomeMonthRow {
  source_dataset_id: string;
  source_record_id: string;
  report_year: number | null;
  source_report_year: number | null;
  report_month: number | null;
  period_start: string | null;
  county_code: string | null;
  county_name: string | null;
  report_grain_key: string | null;
  official_metrics: Record<string, unknown>;
  quality_flags: unknown[];
  source_retrieved_at: string | null;
}

export interface AnimalShelterPressureRow extends AnimalShelterOutcomeMonthRow {
  revision_index: number | null;
  duplicate_grain_count: number | null;
  is_ambiguous: boolean;
  excluded_ambiguous_grain_count: number | null;
  /** 0-100；只在官方欄位或在養量／容量都存在時才有值。 */
  capacity_utilization: number | null;
  in_shelter_count: number | null;
  capacity: number | null;
}

const nullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

function metricNumber(metrics: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = nullableNumber(metrics[key]);
    if (n != null) return n;
  }
  return null;
}

export function parseAnimalShelterOutcomeMonth(row: Record<string, unknown>): AnimalShelterOutcomeMonthRow {
  return {
    source_dataset_id: String(row.source_dataset_id ?? ""),
    source_record_id: String(row.source_record_id ?? ""),
    report_year: nullableNumber(row.report_year),
    source_report_year: nullableNumber(row.source_report_year),
    report_month: nullableNumber(row.report_month),
    period_start: row.period_start == null ? null : String(row.period_start),
    county_code: row.county_code == null ? null : String(row.county_code),
    county_name: row.county_name == null ? (row.name == null ? null : String(row.name)) : String(row.county_name),
    report_grain_key: row.report_grain_key == null
      ? (row.grain_key == null ? null : String(row.grain_key))
      : String(row.report_grain_key),
    official_metrics: object(row.official_metrics),
    quality_flags: array(row.quality_flags),
    source_retrieved_at: row.source_retrieved_at == null ? null : String(row.source_retrieved_at),
  };
}

export function parseAnimalShelterPressure(row: Record<string, unknown>): AnimalShelterPressureRow {
  const base = parseAnimalShelterOutcomeMonth(row);
  const metrics = base.official_metrics;
  // 73396 canonical fields：fe_sum_count 是月底在養總數，max_stay_* 是犬貓核定容量。
  const inShelter = metricNumber(metrics, ["fe_sum_count", "in_shelter_count", "in_shelter", "shelter_count", "current_count"]);
  const directCapacity = metricNumber(metrics, ["capacity", "shelter_capacity", "total_capacity"]);
  const dogCapacity = metricNumber(metrics, ["max_stay_dog_count"]);
  const catCapacity = metricNumber(metrics, ["max_stay_cat_count"]);
  const capacity = directCapacity ?? (dogCapacity != null && catCapacity != null ? dogCapacity + catCapacity : null);
  const rawUtilization = metricNumber(metrics, ["capacity_utilization", "capacity_utilization_pct", "utilization_rate", "occupancy_rate"]);
  const utilization = rawUtilization == null
    ? (inShelter != null && capacity != null && capacity > 0 ? inShelter / capacity * 100 : null)
    : (rawUtilization >= 0 && rawUtilization <= 1 ? rawUtilization * 100 : rawUtilization);
  return {
    ...base,
    revision_index: nullableNumber(row.revision_index),
    duplicate_grain_count: nullableNumber(row.duplicate_grain_count),
    is_ambiguous: row.is_ambiguous === true,
    excluded_ambiguous_grain_count: nullableNumber(row.excluded_ambiguous_grain_count),
    capacity_utilization: utilization,
    in_shelter_count: inShelter,
    capacity,
  };
}

async function pressureRaw(countyCode?: string): Promise<AnimalShelterPressureRow[]> {
  const { data, error } = await withLoading(
    "animal-shelter-pressure-latest",
    "收容所最新壓力（月報）",
    supabase.rpc("get_animal_shelter_pressure_latest", {
      p_county_code: countyCode ?? null,
      p_include_ambiguous: false,
    }),
  );
  if (error) throw new Error(`get_animal_shelter_pressure_latest: ${error.message}`);
  return (Array.isArray(data) ? data : []).map((item) => parseAnimalShelterPressure(item as Record<string, unknown>));
}

const pressureCache = keyedThunkCache<AnimalShelterPressureRow[]>(10 * 60_000);
export function fetchAnimalShelterPressureLatest(countyCode?: string) {
  return pressureCache(countyCode ?? "", () => pressureRaw(countyCode));
}

export async function fetchAnimalShelterOutcomeMonthly(
  countyCode: string,
  fromYear?: number,
  toYear?: number,
): Promise<AnimalShelterOutcomeMonthRow[]> {
  const { data, error } = await withLoading(
    `animal-shelter-outcomes-${countyCode}-${fromYear ?? ""}-${toYear ?? ""}`,
    "收容成果月報",
    supabase.rpc("get_animal_shelter_outcome_monthly", {
      p_county_code: countyCode,
      p_from_year: fromYear ?? null,
      p_to_year: toYear ?? null,
      p_include_annual: false,
    }),
  );
  if (error) throw new Error(`get_animal_shelter_outcome_monthly: ${error.message}`);
  return (Array.isArray(data) ? data : []).map((item) => parseAnimalShelterOutcomeMonth(item as Record<string, unknown>));
}
