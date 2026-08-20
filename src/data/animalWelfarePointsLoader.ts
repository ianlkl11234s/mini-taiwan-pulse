import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import type { AnimalWelfarePointType } from "./animalWelfarePointsTypes";

export const ANIMAL_WELFARE_POINTS_PAGE_SIZE = 5000;

export interface AnimalWelfarePointRow {
  source_dataset_id: string;
  source_record_key: string;
  canonical_entity_key: string | null;
  point_type: AnimalWelfarePointType | string;
  service_tags: unknown;
  name: string;
  county_code: string | null;
  county_name: string | null;
  address: string | null;
  phone: string | null;
  status: string | null;
  valid_from: string | null;
  valid_to: string | null;
  longitude: number;
  latitude: number;
  geom: unknown;
  geocode_metadata: unknown;
  details: unknown;
  availability_state: string | null;
  last_seen_at: string | null;
  source_record_count: number | null;
  /** Preserve any forward-compatible canonical RPC columns in the GeoJSON popup props. */
  [key: string]: unknown;
}

export interface AnimalWelfarePointHistoryRow {
  [key: string]: unknown;
}

export interface AnimalWelfarePointPageArgs {
  p_point_types: string[] | null;
  p_county_codes: string[] | null;
  p_bbox: Record<string, number> | null;
  p_include_inactive: boolean;
  p_include_unlocated: boolean;
  p_limit: number;
  p_offset: number;
}

const nullableString = (value: unknown): string | null => value == null || value === "" ? null : String(value);
const nullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Rejects malformed / swapped coordinates; unlocated rows stay in the backend by contract. */
function validCoordinates(longitude: number | null, latitude: number | null): longitude is number {
  return longitude != null && latitude != null
    && longitude >= -180 && longitude <= 180
    && latitude >= -90 && latitude <= 90;
}

export function parseAnimalWelfarePoint(row: Record<string, unknown>): AnimalWelfarePointRow | null {
  const longitude = nullableNumber(row.longitude ?? row.lng ?? row.lon);
  const latitude = nullableNumber(row.latitude ?? row.lat);
  if (longitude == null || latitude == null || !validCoordinates(longitude, latitude)) return null;

  return {
    ...row,
    source_dataset_id: String(row.source_dataset_id ?? ""),
    source_record_key: String(row.source_record_key ?? ""),
    canonical_entity_key: nullableString(row.canonical_entity_key),
    point_type: String(row.point_type ?? "unknown"),
    service_tags: row.service_tags ?? [],
    name: String(row.name ?? "未命名服務點"),
    county_code: nullableString(row.county_code),
    county_name: nullableString(row.county_name),
    address: nullableString(row.address),
    phone: nullableString(row.phone),
    status: nullableString(row.status),
    valid_from: nullableString(row.valid_from),
    valid_to: nullableString(row.valid_to),
    longitude,
    latitude,
    geom: row.geom ?? null,
    geocode_metadata: row.geocode_metadata ?? row.geocode ?? null,
    details: row.details ?? null,
    availability_state: nullableString(row.availability_state),
    last_seen_at: nullableString(row.last_seen_at),
    source_record_count: nullableNumber(row.source_record_count),
  };
}

export const defaultAnimalWelfarePointPageArgs = (offset = 0): AnimalWelfarePointPageArgs => ({
  p_point_types: null,
  p_county_codes: null,
  p_bbox: null,
  p_include_inactive: false,
  p_include_unlocated: false,
  p_limit: ANIMAL_WELFARE_POINTS_PAGE_SIZE,
  p_offset: offset,
});

export const defaultAnimalWelfarePointHistoryArgs = (sourceDatasetId: string, sourceRecordKey: string) => ({
  p_source_dataset_id: sourceDatasetId,
  p_source_record_key: sourceRecordKey,
  p_from_date: null,
  p_to_date: null,
  p_limit: 400,
});

/** Pure pagination seam: contract tests assert every named arg and the short-page stop. */
export async function loadAnimalWelfarePointPages(
  requestPage: (args: AnimalWelfarePointPageArgs) => Promise<unknown[]>,
): Promise<AnimalWelfarePointRow[]> {
  const rows: AnimalWelfarePointRow[] = [];
  for (let offset = 0; ; offset += ANIMAL_WELFARE_POINTS_PAGE_SIZE) {
    const page = await requestPage(defaultAnimalWelfarePointPageArgs(offset));
    rows.push(...page
      .map((item) => parseAnimalWelfarePoint(item as Record<string, unknown>))
      .filter((item): item is AnimalWelfarePointRow => item !== null));
    if (page.length < ANIMAL_WELFARE_POINTS_PAGE_SIZE) return rows;
  }
}

async function requestAnimalWelfarePointPage(args: AnimalWelfarePointPageArgs): Promise<unknown[]> {
  const { data, error } = await withLoading(
    `animal-welfare-points:${args.p_offset}`,
    `動物福利服務點（第 ${Math.floor(args.p_offset / ANIMAL_WELFARE_POINTS_PAGE_SIZE) + 1} 頁）`,
    supabase.rpc("get_animal_welfare_points", args),
  );
  if (error) throw new Error(`get_animal_welfare_points: ${error.message}`);
  return Array.isArray(data) ? data : [];
}

async function fetchAnimalWelfarePointsUncached() {
  return loadAnimalWelfarePointPages(requestAnimalWelfarePointPage);
}

/** Active + located nationwide service points. Cached only after all pages have succeeded. */
export const fetchAnimalWelfarePoints = cachedOnce(fetchAnimalWelfarePointsUncached, 10 * 60_000);

export async function fetchAnimalWelfarePointHistory(
  sourceDatasetId: string,
  sourceRecordKey: string,
): Promise<AnimalWelfarePointHistoryRow[]> {
  if (!sourceDatasetId || !sourceRecordKey) return [];
  const { data, error } = await withLoading(
    `animal-welfare-point-history:${sourceDatasetId}:${sourceRecordKey}`,
    "動物福利服務點歷程",
    supabase.rpc("get_animal_welfare_point_history", defaultAnimalWelfarePointHistoryArgs(sourceDatasetId, sourceRecordKey)),
  );
  if (error) throw new Error(`get_animal_welfare_point_history: ${error.message}`);
  return Array.isArray(data) ? data as AnimalWelfarePointHistoryRow[] : [];
}
