import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

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

const cache = new Map<number, H3DataSet>();
const demographicsCache = new Map<number, DemographicH3DataSet>();
const demographicsYearlyCache = new Map<string, DemographicH3CellData[]>(); // key: "res-year"
const socioeconomicCache = new Map<number, SocioeconomicH3DataSet>();
const spatialEconomyCache = new Map<number, SpatialEconomyH3DataSet>();

const MIN_RES = 7;

function emptySet<T extends { metadata: H3DataSet["metadata"]; cells: unknown[] }>(
  resolution: number,
): T {
  return {
    metadata: { resolution, cell_count: 0, source: "", generated_at: "", value_columns: [] as string[] },
    cells: [] as unknown[],
  } as unknown as T;
}

/**
 * Fetch a single H3 JSON and parse it.
 * 404 / network error → null（讓呼叫端決定 fallback）。
 */
async function tryFetchH3<T>(filename: string, label: string): Promise<T | null> {
  try {
    const res = await withLoading(`h3:${filename}`, label, fetch(`./h3/${filename}`));
    if (res.ok) return (await res.json()) as T;
  } catch { /* fallthrough */ }
  return null;
}

/**
 * Load H3 population data by resolution.
 * 若目標 res 檔案不存在（例如 res9 尚未生成、res8 僅在 S3 上沒同步到本地），
 * 自動退回較低解析度避免 console 錯誤與空圖層。
 */
export async function loadH3Population(resolution: number): Promise<H3DataSet> {
  const cached = cache.get(resolution);
  if (cached) return cached;

  for (let res = resolution; res >= MIN_RES; res--) {
    const hit = cache.get(res);
    if (hit && hit.cells.length > 0) {
      cache.set(resolution, hit);
      if (res !== resolution) console.log(`[H3] res${resolution} reuse cached res${res} (${hit.cells.length} cells)`);
      return hit;
    }
    const data = await tryFetchH3<H3DataSet>(`h3_population_res${res}.json`, `H3 人口網格 res${res}`);
    if (data) {
      cache.set(res, data);
      cache.set(resolution, data);
      const suffix = res === resolution ? "" : ` (fallback from res${resolution})`;
      console.log(`[H3] Loaded res${res}${suffix} (${data.cells.length} cells)`);
      return data;
    }
  }

  console.warn(`[H3] Failed to load res${resolution} (no fallback available)`);
  const empty = emptySet<H3DataSet>(resolution);
  cache.set(resolution, empty); // 快取空結果避免重複觸發 404
  return empty;
}

/**
 * Load H3 demographics (village population indicators) by resolution.
 */
export async function loadH3Demographics(resolution: number): Promise<DemographicH3DataSet> {
  const cached = demographicsCache.get(resolution);
  if (cached) return cached;

  for (let res = resolution; res >= MIN_RES; res--) {
    const hit = demographicsCache.get(res);
    if (hit && hit.cells.length > 0) {
      demographicsCache.set(resolution, hit);
      if (res !== resolution) console.log(`[H3-Demo] res${resolution} reuse cached res${res} (${hit.cells.length} cells)`);
      return hit;
    }
    const data = await tryFetchH3<DemographicH3DataSet>(`h3_demographics_res${res}.json`, `H3 人口指標 res${res}`);
    if (data) {
      demographicsCache.set(res, data);
      demographicsCache.set(resolution, data);
      const suffix = res === resolution ? "" : ` (fallback from res${resolution})`;
      console.log(`[H3-Demo] Loaded res${res}${suffix} (${data.cells.length} cells)`);
      return data;
    }
  }

  console.warn(`[H3-Demo] Failed to load res${resolution} (no fallback available)`);
  const empty = emptySet<DemographicH3DataSet>(resolution);
  demographicsCache.set(resolution, empty);
  return empty;
}

/**
 * Load H3 socioeconomic data (income, vitality, vulnerability).
 */
export async function loadH3Socioeconomic(resolution: number): Promise<SocioeconomicH3DataSet> {
  const cached = socioeconomicCache.get(resolution);
  if (cached) return cached;

  for (let res = resolution; res >= MIN_RES; res--) {
    const hit = socioeconomicCache.get(res);
    if (hit && hit.cells.length > 0) {
      socioeconomicCache.set(resolution, hit);
      if (res !== resolution) console.log(`[H3-Socio] res${resolution} reuse cached res${res} (${hit.cells.length} cells)`);
      return hit;
    }
    const data = await tryFetchH3<SocioeconomicH3DataSet>(`h3_socioeconomic_res${res}.json`, `H3 社經指標 res${res}`);
    if (data) {
      socioeconomicCache.set(res, data);
      socioeconomicCache.set(resolution, data);
      const suffix = res === resolution ? "" : ` (fallback from res${resolution})`;
      console.log(`[H3-Socio] Loaded res${res}${suffix} (${data.cells.length} cells)`);
      return data;
    }
  }

  console.warn(`[H3-Socio] Failed to load res${resolution} (no fallback available)`);
  const empty = emptySet<SocioeconomicH3DataSet>(resolution);
  socioeconomicCache.set(resolution, empty);
  return empty;
}

/**
 * Load H3 spatial economy data (housing price, amenity, land mix).
 */
export async function loadH3SpatialEconomy(resolution: number): Promise<SpatialEconomyH3DataSet> {
  const cached = spatialEconomyCache.get(resolution);
  if (cached) return cached;

  for (let res = resolution; res >= MIN_RES; res--) {
    const hit = spatialEconomyCache.get(res);
    if (hit && hit.cells.length > 0) {
      spatialEconomyCache.set(resolution, hit);
      if (res !== resolution) console.log(`[H3-Spatial] res${resolution} reuse cached res${res} (${hit.cells.length} cells)`);
      return hit;
    }
    const data = await tryFetchH3<SpatialEconomyH3DataSet>(`h3_spatial_economy_res${res}.json`, `H3 空間經濟 res${res}`);
    if (data) {
      spatialEconomyCache.set(res, data);
      spatialEconomyCache.set(resolution, data);
      const suffix = res === resolution ? "" : ` (fallback from res${resolution})`;
      console.log(`[H3-Spatial] Loaded res${res}${suffix} (${data.cells.length} cells)`);
      return data;
    }
  }

  console.warn(`[H3-Spatial] Failed to load res${resolution} (no fallback available)`);
  const empty = emptySet<SpatialEconomyH3DataSet>(resolution);
  spatialEconomyCache.set(resolution, empty);
  return empty;
}

// ── H3 Demographics Yearly (Supabase RPC) ──

/**
 * Load H3 demographics for a specific year + resolution from Supabase.
 */
export async function loadH3DemographicsYearly(
  year: number,
  resolution: number = 7,
): Promise<DemographicH3CellData[]> {
  const cacheKey = `${resolution}-${year}`;
  const cached = demographicsYearlyCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await withLoading(
    `h3-demo:${year}:r${resolution}`,
    `H3 人口 ${year}`,
    supabase.rpc("get_h3_demographics_yearly", {
      target_year: year,
      target_resolution: resolution,
    }),
  );
  if (error) {
    console.warn(`[H3-DemoYearly] Supabase RPC error:`, error.message);
    return [];
  }
  const cells = (data ?? []) as DemographicH3CellData[];
  demographicsYearlyCache.set(cacheKey, cells);
  console.log(`[H3-DemoYearly] year=${year} res=${resolution}: ${cells.length} cells`);
  return cells;
}

/**
 * Get available years from Supabase.
 */
export async function loadH3DemographicsYears(): Promise<
  { year: number; resolution: number; cell_count: number }[]
> {
  const { data, error } = await withLoading(
    "h3-demographics:years",
    "人口網格年份",
    supabase.rpc("get_h3_demographics_years"),
  );
  if (error || !data) {
    console.warn(`[H3-DemoYearly] get_h3_demographics_years failed:`, error?.message);
    return [];
  }
  return data;
}
