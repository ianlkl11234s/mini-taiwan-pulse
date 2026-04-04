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

let cache: YoubikeH3DataSet | null = null;

export async function loadYoubikeH3(): Promise<YoubikeH3DataSet> {
  if (cache) return cache;

  const empty: YoubikeH3DataSet = {
    metadata: { resolution: 8, cell_count: 0, source: "", generated_at: "", time_range: [], snapshot_count: 0, cities: [], total_db_rows: 0, value_columns: [] },
    snapshots: {},
  };

  try {
    const res = await fetch("./h3_youbike_fullness_res8.json");
    if (res.ok) {
      const data: YoubikeH3DataSet = await res.json();
      cache = data;
      console.log(`[YouBike-H3] Loaded ${data.metadata.cell_count} cells, ${data.metadata.snapshot_count} snapshots`);
      return data;
    }
  } catch { /* fallthrough */ }

  console.warn("[YouBike-H3] Failed to load data");
  return empty;
}
