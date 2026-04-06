/**
 * OpenSky 空域快照資料載入器
 * 資料來源：Supabase RPC (get_flight_trails / get_flight_dates)
 */

import type { Flight, TrailPoint } from "../types";
import { supabase, todayTaiwan } from "../lib/supabase";

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

/** 解析航班 trail "lat,lng,alt,ts;..." → TrailPoint[] */
function parseFlightTrail(trail: string): TrailPoint[] {
  const points = trail.split(";");
  const result: TrailPoint[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const parts = points[i]!.split(",");
    result[i] = [+parts[0]!, +parts[1]!, +parts[2]!, +parts[3]!];
  }
  return result;
}

/**
 * 把一條軌跡依時間間隙拆分成多段（同一 callsign 可能包含多趟航班）
 * @param path 原始軌跡點（已按時間排序）
 * @param maxGap 最大允許間隙秒數（預設 1800 = 30 分鐘）
 */
function splitTrailByGap(path: TrailPoint[], maxGap: number = 1800): TrailPoint[][] {
  if (path.length < 2) return [path];
  const segments: TrailPoint[][] = [];
  let current: TrailPoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const gap = path[i]![3] - path[i - 1]![3];
    if (gap > maxGap) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(path[i]!);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

/** 取得所有有航班資料的日期 */
export async function fetchAirspaceDates(): Promise<AirspaceDateInfo[]> {
  const { data, error } = await supabase.rpc("get_flight_dates");
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
  const { data, error } = await supabase.rpc("get_flight_trails", { target_date: date });
  if (error) throw new Error(`Supabase get_flight_trails: ${error.message}`);

  const rows = data as {
    flight_id: string; callsign: string; aircraft_type: string;
    origin: string; destination: string; trail: string;
  }[];

  let tsMin = Infinity;
  let tsMax = -Infinity;
  let splitCount = 0;

  const flights: Flight[] = [];
  for (const row of rows) {
    const fullPath = parseFlightTrail(row.trail);
    const segments = splitTrailByGap(fullPath, 1800);
    if (segments.length > 1) splitCount++;

    for (let si = 0; si < segments.length; si++) {
      const path = segments[si]!;
      if (path.length < 2) continue;
      const firstTs = path[0]![3];
      const lastTs = path[path.length - 1]![3];
      if (firstTs < tsMin) tsMin = firstTs;
      if (lastTs > tsMax) tsMax = lastTs;

      flights.push({
        fr24_id: segments.length > 1 ? `${row.flight_id}_${si}` : row.flight_id,
        callsign: row.callsign,
        registration: "",
        aircraft_type: row.aircraft_type,
        origin_icao: row.origin,
        origin_iata: "",
        dest_icao: row.destination,
        dest_iata: "",
        dep_time: firstTs,
        arr_time: lastTs,
        status: "",
        trail_points: path.length,
        path,
      });
    }
  }

  if (splitCount > 0) {
    console.log(`[Airspace] Split ${splitCount} multi-leg flights (gap > 30min)`);
  }
  console.log(`[Airspace] ${date}: ${flights.length} flights from ${rows.length} records, ${(performance.now() - t0).toFixed(0)}ms`);

  return {
    metadata: {
      date,
      aircraft_count: flights.length,
      time_range: [tsMin === Infinity ? 0 : tsMin, tsMax === -Infinity ? 0 : tsMax],
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
