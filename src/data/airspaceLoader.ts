/**
 * OpenSky 空域快照資料載入器
 * 從 pulse-api /airspace/day 載入 Arrow IPC → 轉為 Flight 型別
 */

import { tableFromIPC } from "apache-arrow";
import type { Flight, TrailPoint } from "../types";

const API = "/api/v1";

export interface AirspaceDateInfo {
  date: string;
  frames: number;
  records: number;
}

export interface AirspaceData {
  metadata: {
    date: string;
    aircraft_count: number;
    time_range: [number, number];
  };
  flights: Flight[];
}

/** 取得所有有空域快照資料的日期 */
export async function fetchAirspaceDates(): Promise<AirspaceDateInfo[]> {
  const res = await fetch(`${API}/airspace/dates`);
  if (!res.ok) throw new Error(`airspace/dates: ${res.status}`);
  const data = await res.json();
  return data.dates as AirspaceDateInfo[];
}

/** 從 Arrow IPC 載入單日空域快照 → Flight[] */
export async function fetchAirspaceDayArrow(date: string): Promise<AirspaceData> {
  const res = await fetch(`${API}/airspace/day?date=${date}&format=arrow`);
  if (!res.ok) throw new Error(`airspace/day ${date}: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const table = tableFromIPC(new Uint8Array(buffer));

  // flat table → grouped by icao24
  const acMap = new Map<string, { callsign: string; path: TrailPoint[] }>();
  const icaoCol = table.getChild("icao24")!;
  const csCol = table.getChild("callsign");
  const latCol = table.getChild("lat")!;
  const lonCol = table.getChild("lon")!;
  const altCol = table.getChild("altitude");
  const tsCol = table.getChild("ts_unix")!;

  let tsMin = Infinity;
  let tsMax = -Infinity;

  for (let i = 0; i < table.numRows; i++) {
    const icao24 = icaoCol.get(i) as string;
    const lat = latCol.get(i) as number;
    const lon = lonCol.get(i) as number;
    const alt = altCol ? (altCol.get(i) as number | null) ?? 0 : 0;
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

  // 轉為 Flight 型別（FlightScene 相容）
  const flights: Flight[] = [];
  for (const [icao24, ac] of acMap) {
    if (ac.path.length < 2) continue; // 至少要兩個點才有軌跡
    flights.push({
      fr24_id: icao24,
      callsign: ac.callsign,
      registration: "",
      aircraft_type: "",
      origin_icao: "",
      origin_iata: "",
      dest_icao: "",
      dest_iata: "",
      dep_time: ac.path[0]![3],
      arr_time: ac.path[ac.path.length - 1]![3],
      status: "",
      trail_points: ac.path.length,
      path: ac.path,
    });
  }

  return {
    metadata: {
      date,
      aircraft_count: flights.length,
      time_range: [
        tsMin === Infinity ? 0 : tsMin,
        tsMax === -Infinity ? 0 : tsMax,
      ],
    },
    flights,
  };
}

/** 從 API 載入最新一天（初始載入用） */
export async function loadLatestAirspace(): Promise<AirspaceData> {
  const dates = await fetchAirspaceDates();
  if (!dates || dates.length === 0) throw new Error("No airspace dates from API");
  const latest = dates[dates.length - 1]!.date;
  return fetchAirspaceDayArrow(latest);
}
