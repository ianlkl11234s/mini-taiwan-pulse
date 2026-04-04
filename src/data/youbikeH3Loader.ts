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

const cache = new Map<number, YoubikeH3DataSet>();

/**
 * Load YouBike H3 data by resolution (7 or 8).
 */
export async function loadYoubikeH3(resolution: number): Promise<YoubikeH3DataSet> {
  const cached = cache.get(resolution);
  if (cached) return cached;

  const empty: YoubikeH3DataSet = {
    metadata: { resolution, cell_count: 0, source: "", generated_at: "", time_range: [], snapshot_count: 0, cities: [], total_db_rows: 0, value_columns: [] },
    snapshots: {},
  };

  const filename = `h3_youbike_fullness_res${resolution}.json`;

  try {
    const res = await fetch(`./${filename}`);
    if (res.ok) {
      const data: YoubikeH3DataSet = await res.json();
      cache.set(resolution, data);
      console.log(`[YouBike-H3] Loaded res${resolution}: ${data.metadata.cell_count} cells, ${data.metadata.snapshot_count} snapshots`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn(`[YouBike-H3] Failed to load res${resolution}`);
  return empty;
}
