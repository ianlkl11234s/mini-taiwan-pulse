/**
 * OpenSky 空域快照資料載入器
 * 資料來源：Supabase RPC (get_flight_trails / get_flight_dates)
 */

import type { Flight } from "../types";
import { supabase, todayTaiwan } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
// 解析邏輯與 `/embed` 回放共用（EM-16）。見 src/data/flightTrails.ts
import { flightRowsToFlights, type FlightTrailRow } from "./flightTrails";

export interface AirspaceDateInfo {
  date: string;
  frames?: number;
  records: number;
  flights?: number;
}

export interface AirspaceData {
  metadata: {
    date: string;
    aircraft_count: number;
    time_range: [number, number];
  };
  flights: Flight[];
}

/** 取得所有有航班資料的日期 */
export async function fetchAirspaceDates(): Promise<AirspaceDateInfo[]> {
  const { data, error } = await withLoading(
    "airspace:dates",
    "航班日期",
    supabase.rpc("get_flight_dates"),
  );
  if (error) throw new Error(`Supabase get_flight_dates: ${error.message}`);
  return (data as { date: string; records: number; flights: number }[]).map((d) => ({
    date: d.date,
    records: Number(d.records),
    flights: Number(d.flights),
  }));
}

/** 載入單日空域快照 */
export async function fetchAirspaceDayArrow(date: string): Promise<AirspaceData> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    `airspace:${date}`,
    `航班軌跡 ${date}`,
    supabase.rpc("get_flight_trails", { target_date: date }),
  );
  if (error) throw new Error(`Supabase get_flight_trails: ${error.message}`);

  const rows = data as FlightTrailRow[];

  const { flights, timeRange, splitCount } = flightRowsToFlights(rows);

  if (splitCount > 0) {
    console.log(`[Airspace] Split ${splitCount} multi-leg flights (gap > 30min)`);
  }
  console.log(`[Airspace] ${date}: ${flights.length} flights from ${rows.length} records, ${(performance.now() - t0).toFixed(0)}ms`);

  return {
    metadata: {
      date,
      aircraft_count: flights.length,
      time_range: timeRange,
    },
    flights,
  };
}

/** 從已取得的日期清單中挑選最佳日期並載入 */
export async function loadAirspaceWithDates(dates: AirspaceDateInfo[]): Promise<AirspaceData> {
  if (!dates || dates.length === 0) throw new Error("No airspace dates available");

  const today = todayTaiwan();
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = dates[i]!;
    if (d.date <= today && d.records > 100) {
      console.log(`[Airspace] Picking date ${d.date} (${d.flights} flights, ${d.records} records)`);
      return fetchAirspaceDayArrow(d.date);
    }
  }
  const fallback = dates[dates.length - 1]!;
  console.log(`[Airspace] No suitable day, using ${fallback.date}`);
  return fetchAirspaceDayArrow(fallback.date);
}

/** 載入最新空域資料（自動查日期） */
export async function loadLatestAirspace(): Promise<AirspaceData> {
  const dates = await fetchAirspaceDates();
  return loadAirspaceWithDates(dates);
}
