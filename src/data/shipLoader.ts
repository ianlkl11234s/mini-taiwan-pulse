import type { ShipData } from "../types";
import { supabase, todayTaiwan } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
// trail 解析 / GPS 異常過濾 / ship_type 映射已抽成純函數共用件（EM-16 Phase 2）：
// `/embed` 回放讀靜態快照鏡像，走的是同一條解析路徑。見 src/data/shipTrails.ts。
import { shipRowsToShips, type ShipTrailRow } from "./shipTrails";

export interface ShipDateInfo {
  date: string;
  frames?: number;
  records: number;
  ships?: number;
}

// ── Supabase loaders ──

/** 取得所有有船舶資料的日期 */
export async function fetchShipDates(): Promise<ShipDateInfo[]> {
  const { data, error } = await withLoading(
    "ship:dates",
    "船舶日期",
    supabase.rpc("get_ship_dates"),
  );
  if (error) throw new Error(`Supabase get_ship_dates: ${error.message}`);
  return (data as { date: string; records: number; ships: number }[]).map((d) => ({
    date: d.date,
    records: Number(d.records),
    ships: Number(d.ships),
  }));
}

/** 載入單日船舶資料 */
export async function fetchShipDayArrow(date: string): Promise<ShipData> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `ship:${date}`,
    `船舶軌跡 ${date}`,
    supabase.rpc("get_ship_trails", { target_date: date }),
  );
  if (error) throw new Error(`Supabase get_ship_trails: ${error.message}`);

  const rows = data as ShipTrailRow[];
  const { ships, timeRange, filteredPoints } = shipRowsToShips(rows);

  const elapsed = (performance.now() - t0).toFixed(0);
  console.log(
    `[Ship] ${date}: ${ships.length} ships, ${elapsed}ms` +
    (filteredPoints > 0 ? `, filtered ${filteredPoints} anomalous points` : "")
  );

  return {
    metadata: {
      date,
      ship_count: ships.length,
      time_range: timeRange,
    },
    ships,
  };
}

/** 從已取得的日期清單中挑選最佳日期並載入 */
export async function loadShipsWithDates(dates: ShipDateInfo[]): Promise<ShipData> {
  if (!dates || dates.length === 0) throw new Error("No ship dates available");

  const today = todayTaiwan();
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i]!;
    if (d.date <= today && d.records > 1000) {
      console.log(`[Ship] Picking date ${d.date} (${d.ships} ships, ${d.records} records)`);
      return fetchShipDayArrow(d.date);
    }
  }
  const fallback = dates[dates.length - 1]!;
  console.log(`[Ship] No suitable day, using ${fallback.date}`);
  return fetchShipDayArrow(fallback.date);
}

/** 載入最新船舶資料（自動查日期） */
export async function loadShipsFromApi(): Promise<ShipData> {
  const dates = await fetchShipDates();
  return loadShipsWithDates(dates);
}
