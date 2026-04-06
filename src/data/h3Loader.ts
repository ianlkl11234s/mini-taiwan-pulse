import { supabase } from "../lib/supabase";

export interface H3CellData {
  h: string; // H3 index
  d: number; // day population
  n: number; // night population
}

export interface H3DataSet {
  metadata: {
    resolution: number;
    cell_count: number;
    source: string;
    generated_at: string;
    value_columns: string[];
  };
  cells: H3CellData[];
}

/** 村里人口指標 H3 cell */
export interface DemographicH3CellData {
  h: string;   // H3 index
  p: number;   // population
  hh: number;  // household_count
  m: number;   // male_count
  f: number;   // female_count
  sr: number;  // sex_ratio
  pph: number; // persons_per_household
  dr: number;  // dependency_ratio
  cd: number;  // child_dependency
  ed: number;  // elderly_dependency
  ai: number;  // aging_index
}

export interface DemographicH3DataSet {
  metadata: {
    resolution: number;
    cell_count: number;
    source: string;
    generated_at: string;
    value_columns: string[];
  };
  cells: DemographicH3CellData[];
}

/** 村里社經指標 H3 cell */
export interface SocioeconomicH3CellData {
  h: string;   // H3 index
  im: number;  // income_median (萬元)
  iq: number;  // income_iqr_ratio
  sr: number;  // salary_ratio
  vs: number;  // vitality_score (0~1)
  vl: number;  // vulnerability (0~1)
}

export interface SocioeconomicH3DataSet {
  metadata: {
    resolution: number;
    cell_count: number;
    source: string;
    generated_at: string;
    value_columns: string[];
  };
  cells: SocioeconomicH3CellData[];
}

/** 最小統計區空間經濟 H3 cell */
export interface SpatialEconomyH3CellData {
  h: string;   // H3 index
  hp: number;  // housing_price (萬元)
  hu: number;  // housing_unit_price (萬元/坪)
  hpr: number; // housing_pressure_ratio
  ad: number;  // amenity_density (per 1000 people)
  lm: number;  // land_mix_index (0~1)
}

export interface SpatialEconomyH3DataSet {
  metadata: {
    resolution: number;
    cell_count: number;
    source: string;
    generated_at: string;
    value_columns: string[];
  };
  cells: SpatialEconomyH3CellData[];
}

/** 歷年人口結構 H3（民國 104~113 年） */
export interface DemographicYearlyH3DataSet {
  metadata: {
    resolution: number;
    years: number[];
    year_count: number;
    source: string;
    generated_at: string;
    value_columns: string[];
  };
  years: Record<string, DemographicH3CellData[]>;
}

const cache = new Map<number, H3DataSet>();
const demographicsCache = new Map<number, DemographicH3DataSet>();
const demographicsYearlyCache = new Map<string, DemographicH3CellData[]>(); // key: "res-year"
const socioeconomicCache = new Map<number, SocioeconomicH3DataSet>();
const spatialEconomyCache = new Map<number, SpatialEconomyH3DataSet>();

/**
 * Load H3 population data by resolution.
 * Priority: local public/ → S3 fallback.
 */
export async function loadH3Population(resolution: number): Promise<H3DataSet> {
  const cached = cache.get(resolution);
  if (cached) return cached;

  const filename = `h3_population_res${resolution}.json`;

  // Try local first
  try {
    const res = await fetch(`./${filename}`);
    if (res.ok) {
      const data: H3DataSet = await res.json();
      cache.set(resolution, data);
      console.log(`[H3] Loaded res${resolution} from local (${data.cells.length} cells)`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn(`[H3] Failed to load res${resolution}`);
  return { metadata: { resolution, cell_count: 0, source: "", generated_at: "", value_columns: [] }, cells: [] };
}

/**
 * Load H3 demographics (village population indicators) by resolution.
 */
export async function loadH3Demographics(resolution: number): Promise<DemographicH3DataSet> {
  const cached = demographicsCache.get(resolution);
  if (cached) return cached;

  const filename = `h3_demographics_res${resolution}.json`;

  try {
    const res = await fetch(`./${filename}`);
    if (res.ok) {
      const data: DemographicH3DataSet = await res.json();
      demographicsCache.set(resolution, data);
      console.log(`[H3-Demo] Loaded res${resolution} from local (${data.cells.length} cells)`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn(`[H3-Demo] Failed to load res${resolution}`);
  return { metadata: { resolution, cell_count: 0, source: "", generated_at: "", value_columns: [] }, cells: [] };
}

/**
 * Load H3 socioeconomic data (income, vitality, vulnerability).
 */
export async function loadH3Socioeconomic(resolution: number): Promise<SocioeconomicH3DataSet> {
  const cached = socioeconomicCache.get(resolution);
  if (cached) return cached;

  const filename = `h3_socioeconomic_res${resolution}.json`;
  const empty: SocioeconomicH3DataSet = { metadata: { resolution, cell_count: 0, source: "", generated_at: "", value_columns: [] }, cells: [] };

  try {
    const res = await fetch(`./${filename}`);
    if (res.ok) {
      const data: SocioeconomicH3DataSet = await res.json();
      socioeconomicCache.set(resolution, data);
      console.log(`[H3-Socio] Loaded res${resolution} from local (${data.cells.length} cells)`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn(`[H3-Socio] Failed to load res${resolution}`);
  return empty;
}

/**
 * Load H3 spatial economy data (housing price, amenity, land mix).
 */
export async function loadH3SpatialEconomy(resolution: number): Promise<SpatialEconomyH3DataSet> {
  const cached = spatialEconomyCache.get(resolution);
  if (cached) return cached;

  const filename = `h3_spatial_economy_res${resolution}.json`;
  const empty: SpatialEconomyH3DataSet = { metadata: { resolution, cell_count: 0, source: "", generated_at: "", value_columns: [] }, cells: [] };

  try {
    const res = await fetch(`./${filename}`);
    if (res.ok) {
      const data: SpatialEconomyH3DataSet = await res.json();
      spatialEconomyCache.set(resolution, data);
      console.log(`[H3-Spatial] Loaded res${resolution} from local (${data.cells.length} cells)`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn(`[H3-Spatial] Failed to load res${resolution}`);
  return empty;
}

// ── H3 Demographics Yearly (Supabase RPC → local fallback) ──

/**
 * Load H3 demographics for a specific year + resolution.
 * Priority: Supabase RPC → local yearly JSON fallback.
 */
export async function loadH3DemographicsYearly(
  year: number,
  resolution: number = 7,
): Promise<DemographicH3CellData[]> {
  const cacheKey = `${resolution}-${year}`;
  const cached = demographicsYearlyCache.get(cacheKey);
  if (cached) return cached;

  // Try Supabase RPC first
  try {
    const { data, error } = await supabase.rpc("get_h3_demographics_yearly", {
      target_year: year,
      target_resolution: resolution,
    });
    if (!error && data && data.length > 0) {
      const cells = data as DemographicH3CellData[];
      demographicsYearlyCache.set(cacheKey, cells);
      console.log(`[H3-DemoYearly] Loaded year=${year} res=${resolution} from Supabase (${cells.length} cells)`);
      return cells;
    }
    if (error) console.warn(`[H3-DemoYearly] Supabase RPC error:`, error.message);
  } catch (e) {
    console.warn(`[H3-DemoYearly] Supabase RPC failed:`, e);
  }

  // Local JSON fallback
  try {
    const filename = `h3_demographics_yearly_res${resolution}.json`;
    const res = await fetch(`./${filename}`);
    if (res.ok) {
      const dataset: DemographicYearlyH3DataSet = await res.json();
      // Cache all years from this file
      for (const [y, cells] of Object.entries(dataset.years)) {
        demographicsYearlyCache.set(`${resolution}-${y}`, cells);
      }
      const cells = dataset.years[String(year)] ?? [];
      console.log(`[H3-DemoYearly] Loaded year=${year} res=${resolution} from local (${cells.length} cells)`);
      return cells;
    }
  } catch { /* fallthrough */ }

  console.warn(`[H3-DemoYearly] Failed to load year=${year} res=${resolution}`);
  return [];
}

/**
 * Get available years from Supabase (or hardcoded fallback).
 */
export async function loadH3DemographicsYears(): Promise<
  { year: number; resolution: number; cell_count: number }[]
> {
  try {
    const { data, error } = await supabase.rpc("get_h3_demographics_years");
    if (!error && data) return data;
  } catch { /* fallthrough */ }
  // Fallback: hardcoded range
  return Array.from({ length: 10 }, (_, i) => ({
    year: 104 + i,
    resolution: 7,
    cell_count: 8000,
  }));
}
