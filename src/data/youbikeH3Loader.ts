import { supabase, todayTaiwan } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

export interface YoubikeH3CellData {
  h: string;   // H3 index
  fr: number;  // fullness_rate (0~1): 有車率
  sc: number;  // scale: 該 cell 平均總車柱數
}

export interface YoubikeH3DataSet {
  metadata: {
    resolution: number;
    cell_count: number;
    source: string;
    generated_at: string;
    time_range: string[];       // [first_key, last_key]
    snapshot_count: number;
    cities: string[];
    total_db_rows: number;
    value_columns: string[];
  };
  snapshots: Record<string, YoubikeH3CellData[]>;  // "2026-03-28T08:00" → cells
}

const cache = new Map<string, YoubikeH3DataSet>();

/** cache key = "res7:2026-04-03" */
function cacheKey(resolution: number, date: string): string {
  return `res${resolution}:${date}`;
}

// ── Supabase RPC ──

/** 取得可用日期清單 */
async function fetchAvailableDates(): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_youbike_h3_dates");
  if (error || !data) return [];
  return (data as { date: string }[]).map((d) => d.date);
}

/** 從 Supabase RPC 載入單日 H3 聚合 */
async function fetchFromSupabase(
  resolution: number,
  date: string,
): Promise<YoubikeH3DataSet | null> {
  const { data, error } = await withLoading(
    `youbike-h3:${date}:r${resolution}`,
    `YouBike ${date}`,
    supabase.rpc("get_youbike_h3_snapshots", {
      target_date: date,
      h3_resolution: resolution,
    }),
  );

  if (error || !data || data.length === 0) {
    console.warn(`[YouBike-H3] Supabase RPC failed for ${date} res${resolution}:`, error?.message);
    return null;
  }

  const rows = data as { time_key: string; cells: YoubikeH3CellData[] }[];
  const snapshots: Record<string, YoubikeH3CellData[]> = {};
  const allCells = new Set<string>();

  for (const row of rows) {
    snapshots[row.time_key] = row.cells;
    for (const c of row.cells) allCells.add(c.h);
  }

  const timeKeys = Object.keys(snapshots).sort();
  return {
    metadata: {
      resolution,
      cell_count: allCells.size,
      source: "supabase:get_youbike_h3_snapshots",
      generated_at: new Date().toISOString(),
      time_range: timeKeys.length > 0 ? [timeKeys[0]!, timeKeys[timeKeys.length - 1]!] : [],
      snapshot_count: timeKeys.length,
      cities: [],
      total_db_rows: 0,
      value_columns: ["fr", "sc"],
    },
    snapshots,
  };
}

// ── Public API ──

/**
 * Load YouBike H3 data by resolution (7 or 8) from Supabase.
 * Loads target_date (default: today in Asia/Taipei).
 */
export async function loadYoubikeH3(
  resolution: number,
  date?: string,
): Promise<YoubikeH3DataSet> {
  const empty: YoubikeH3DataSet = {
    metadata: { resolution, cell_count: 0, source: "", generated_at: "", time_range: [], snapshot_count: 0, cities: [], total_db_rows: 0, value_columns: [] },
    snapshots: {},
  };

  const targetDate = date ?? todayTaiwan();
  const key = cacheKey(resolution, targetDate);
  const cached = cache.get(key);
  if (cached) return cached;

  const dataset = await fetchFromSupabase(resolution, targetDate);
  if (dataset && dataset.metadata.cell_count > 0) {
    cache.set(key, dataset);
    console.log(`[YouBike-H3] res${resolution} ${targetDate}: ${dataset.metadata.cell_count} cells, ${dataset.metadata.snapshot_count} snapshots`);
    return dataset;
  }

  console.warn(`[YouBike-H3] Failed to load res${resolution} for ${targetDate}`);
  return empty;
}

/**
 * Get available dates from Supabase (for multi-day navigation).
 * Returns empty array in legacy mode.
 */
export async function getYoubikeH3Dates(): Promise<string[]> {
  return fetchAvailableDates();
}
