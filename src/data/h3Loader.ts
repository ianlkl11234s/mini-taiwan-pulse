import { S3_BASE } from "./s3Loader";

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

const cache = new Map<number, H3DataSet>();
const demographicsCache = new Map<number, DemographicH3DataSet>();

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

  // S3 fallback
  try {
    const res = await fetch(`${S3_BASE}/h3-data/${filename}`);
    if (res.ok) {
      const data: H3DataSet = await res.json();
      cache.set(resolution, data);
      console.log(`[H3] Loaded res${resolution} from S3 (${data.cells.length} cells)`);
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

  try {
    const res = await fetch(`${S3_BASE}/h3-data/${filename}`);
    if (res.ok) {
      const data: DemographicH3DataSet = await res.json();
      demographicsCache.set(resolution, data);
      console.log(`[H3-Demo] Loaded res${resolution} from S3 (${data.cells.length} cells)`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn(`[H3-Demo] Failed to load res${resolution}`);
  return { metadata: { resolution, cell_count: 0, source: "", generated_at: "", value_columns: [] }, cells: [] };
}
