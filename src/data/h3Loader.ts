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

const cache = new Map<number, H3DataSet>();

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
