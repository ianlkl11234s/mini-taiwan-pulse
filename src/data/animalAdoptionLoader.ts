import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

export interface AnimalAdoptionShelterRow {
  canonical_shelter_id: string;
  shelter_name: string;
  county_code: string | null;
  county_name: string | null;
  lng: number;
  lat: number;
  listed_count: number;
  species_counts: Record<string, number>;
  latest_snapshot_date: string | null;
  latest_collected_at: string | null;
}

export interface AnimalAdoptionDailyRow {
  snapshot_date: string;
  listed_count: number;
}

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function parseAnimalAdoptionSummary(row: Record<string, unknown>): AnimalAdoptionShelterRow | null {
  const lng = num(row.lng ?? row.longitude ?? row.lon, NaN);
  const lat = num(row.lat ?? row.latitude, NaN);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const species = row.species_counts;
  return {
    canonical_shelter_id: String(row.canonical_shelter_id ?? row.shelter_id ?? ""),
    shelter_name: String(row.shelter_name ?? "未命名收容所"),
    county_code: row.county_code == null ? null : String(row.county_code),
    county_name: row.county_name == null ? null : String(row.county_name),
    lng, lat,
    listed_count: Math.max(0, num(row.listed_count)),
    species_counts: species && typeof species === "object" ? species as Record<string, number> : {},
    latest_snapshot_date: row.latest_snapshot_date == null ? null : String(row.latest_snapshot_date),
    latest_collected_at: row.latest_collected_at == null ? null : String(row.latest_collected_at),
  };
}

async function fetchSummaryRaw(countyCode?: string, animalKind?: string): Promise<AnimalAdoptionShelterRow[]> {
  const { data, error } = await withLoading(
    "animal-adoption-summary",
    "動物認領養收容所摘要",
    supabase.rpc("get_animal_adoption_shelter_summary", {
      p_county_code: countyCode ?? null,
      p_animal_kind: animalKind ?? null,
    }),
  );
  if (error) throw new Error(`get_animal_adoption_shelter_summary: ${error.message}`);
  return (Array.isArray(data) ? data : [])
    .map((r) => parseAnimalAdoptionSummary(r as Record<string, unknown>))
    .filter((r): r is AnimalAdoptionShelterRow => r !== null);
}

const cachedSummary = keyedThunkCache<AnimalAdoptionShelterRow[]>(10 * 60_000);
export function fetchAnimalAdoptionSummary(countyCode?: string, animalKind?: string) {
  const key = `${countyCode ?? ""}:${animalKind ?? ""}`;
  return cachedSummary(key, () => fetchSummaryRaw(countyCode, animalKind));
}

export async function fetchAnimalAdoptionDaily(
  from: string,
  to: string,
  countyCode?: string,
  shelterId?: string,
  animalKind?: string,
): Promise<AnimalAdoptionDailyRow[]> {
  const { data, error } = await withLoading(
    `animal-adoption-daily-${from}-${to}`,
    "動物認領養每日時序",
    supabase.rpc("get_animal_adoption_daily", {
      p_from: from, p_to: to,
      p_county_code: countyCode ?? null,
      p_shelter_id: shelterId ?? null,
      p_animal_kind: animalKind ?? null,
    }),
  );
  if (error) throw new Error(`get_animal_adoption_daily: ${error.message}`);
  return (Array.isArray(data) ? data : []).map((r) => parseAnimalAdoptionDaily(r as Record<string, unknown>));
}

export function parseAnimalAdoptionDaily(row: Record<string, unknown>): AnimalAdoptionDailyRow {
  return {
    snapshot_date: String(row.snapshot_date ?? ""),
    listed_count: Math.max(0, num(row.animal_count ?? row.listed_count)),
  };
}
