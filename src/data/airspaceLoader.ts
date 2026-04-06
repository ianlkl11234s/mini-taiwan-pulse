/**
 * OpenSky 空域快照資料載入器
 * Supabase: get_flight_trails / get_flight_dates RPC
 * Legacy: pulse-api /airspace/day Arrow IPC
 */

import { tableFromIPC } from "apache-arrow";
import type { Flight, TrailPoint } from "../types";
import { supabase, isSupabase, todayTaiwan } from "../lib/supabase";

const API = "/api/v1";

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

// ── Supabase loaders ──

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
 * @returns 拆分後的航段陣列
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

async function fetchAirspaceDatesSupabase(): Promise<AirspaceDateInfo[]> {
  const { data, error } = await supabase.rpc("get_flight_dates");
  if (error) throw new Error(`Supabase get_flight_dates: ${error.message}`);
  return (data as { date: string; records: number; flights: number }[]).map((d) => ({
    date: d.date,
    records: Number(d.records),
    flights: Number(d.flights),
  }));
}

async function fetchAirspaceDaySupabase(date: string): Promise<AirspaceData> {
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
    // 偵測時間間隙（> 30 分鐘）並拆分為獨立航段
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
    console.log(`[Airspace/Supabase] Split ${splitCount} multi-leg flights (gap > 30min)`);
  }
  console.log(`[Airspace/Supabase] ${date}: ${flights.length} flights from ${rows.length} records, ${(performance.now() - t0).toFixed(0)}ms`);

  return {
    metadata: {
      date,
      aircraft_count: flights.length,
      time_range: [tsMin === Infinity ? 0 : tsMin, tsMax === -Infinity ? 0 : tsMax],
    },
    flights,
  };
}

// ── Pulse API loaders (legacy) ──

async function fetchAirspaceDatesApi(): Promise<AirspaceDateInfo[]> {
  const res = await fetch(`${API}/airspace/dates`);
  if (!res.ok) throw new Error(`airspace/dates: ${res.status}`);
  const data = await res.json();
  return data.dates as AirspaceDateInfo[];
}

async function fetchAirspaceDayArrowApi(date: string): Promise<AirspaceData> {
  const res = await fetch(`${API}/airspace/day?date=${date}&format=arrow`);
  if (!res.ok) throw new Error(`airspace/day ${date}: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const table = tableFromIPC(new Uint8Array(buffer));

  console.log(`[Airspace] Parsing ${date}: ${table.numRows.toLocaleString()} rows`);

  const acMap = new Map<string, { callsign: string; path: TrailPoint[] }>();
  const icaoCol = table.getChild("icao24")!;
  const csCol = table.getChild("callsign");
  const latCol = table.getChild("lat")!;
  const lonCol = table.getChild("lon")!;
  const altCol = table.getChild("altitude");
  const tsCol = table.getChild("ts_unix")!;

  let tsMin = Infinity;
  let tsMax = -Infinity;
  let groundSkipped = 0;

  for (let i = 0; i < table.numRows; i++) {
    const alt = altCol ? (altCol.get(i) as number | null) ?? 0 : 0;
    if (alt < 100) { groundSkipped++; continue; }

    const icao24 = icaoCol.get(i) as string;
    const lat = latCol.get(i) as number;
    const lon = lonCol.get(i) as number;
    const ts = Number(tsCol.get(i));
    const callsign = csCol ? (csCol.get(i) as string | null) ?? "" : "";

    if (ts < tsMin) tsMin = ts;
    if (ts > tsMax) tsMax = ts;

    let ac = acMap.get(icao24);
    if (!ac) {
      ac = { callsign: callsign.trim(), path: [] };
      acMap.set(icao24, ac);
    }
    ac.path.push([lat, lon, alt, ts]);
  }

  if (groundSkipped > 0) {
    console.log(`[Airspace] Filtered ${groundSkipped} ground points (alt < 100m)`);
  }

  const flights: Flight[] = [];
  for (const [icao24, ac] of acMap) {
    if (ac.path.length < 2) continue;
    flights.push({
      fr24_id: icao24, callsign: ac.callsign, registration: "",
      aircraft_type: "", origin_icao: "", origin_iata: "",
      dest_icao: "", dest_iata: "",
      dep_time: ac.path[0]![3], arr_time: ac.path[ac.path.length - 1]![3],
      status: "", trail_points: ac.path.length, path: ac.path,
    });
  }

  return {
    metadata: {
      date, aircraft_count: flights.length,
      time_range: [tsMin === Infinity ? 0 : tsMin, tsMax === -Infinity ? 0 : tsMax],
    },
    flights,
  };
}

// ── Public API (auto-switch) ──

export async function fetchAirspaceDates(): Promise<AirspaceDateInfo[]> {
  if (isSupabase()) return fetchAirspaceDatesSupabase();
  return fetchAirspaceDatesApi();
}

export async function fetchAirspaceDayArrow(date: string): Promise<AirspaceData> {
  if (isSupabase()) return fetchAirspaceDaySupabase(date);
  return fetchAirspaceDayArrowApi(date);
}

/** 從已取得的日期清單中挑選最佳日期並載入（避免重複查詢 dates） */
export async function loadAirspaceWithDates(dates: AirspaceDateInfo[]): Promise<AirspaceData> {
  if (!dates || dates.length === 0) throw new Error("No airspace dates available");

  if (isSupabase()) {
    const today = todayTaiwan();
    // 優先選今天，沒有則往前找最近的日期（不選未來）
    for (let i = dates.length - 1; i >= 0; i--) {
      const d = dates[i]!;
      if (d.date <= today && d.records > 100) {
        console.log(`[Airspace/Supabase] Picking date ${d.date} (${d.flights} flights, ${d.records} records)`);
        return fetchAirspaceDaySupabase(d.date);
      }
    }
    const fallback = dates[dates.length - 1]!;
    console.log(`[Airspace/Supabase] No suitable day, using ${fallback.date}`);
    return fetchAirspaceDaySupabase(fallback.date);
  }

  const latest = dates[dates.length - 1]!.date;
  return fetchAirspaceDayArrowApi(latest);
}

/** 舊介面（legacy 用） */
export async function loadLatestAirspace(): Promise<AirspaceData> {
  const dates = await fetchAirspaceDates();
  return loadAirspaceWithDates(dates);
}
