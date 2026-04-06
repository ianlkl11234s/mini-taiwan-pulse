import { tableFromIPC } from "apache-arrow";
import type { Ship, ShipData, TrailPoint } from "../types";
import { S3_BASE, SHIP_PREFIX } from "./s3Loader";
import { supabase, isSupabase, todayTaiwan } from "../lib/supabase";

// ── Pulse API (legacy) ──

const API = "/api/v1";

export interface ShipDateInfo {
  date: string;
  frames?: number;
  records: number;
  ships?: number;
}

// ── GPS 異常過濾 ──

const MAX_SPEED_KNOTS = 40;
const KM_PER_DEG_LAT = 111.0;
const KM_PER_DEG_LNG = 101.0; // ~25°N 近似值

function filterGpsAnomalies(path: TrailPoint[]): TrailPoint[] {
  if (path.length < 2) return path;
  const filtered: TrailPoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const prev = filtered[filtered.length - 1]!;
    const cur = path[i]!;
    const dtHours = (cur[3] - prev[3]) / 3600;
    if (dtHours > 0) {
      const dLat = (cur[0] - prev[0]) * KM_PER_DEG_LAT;
      const dLon = (cur[1] - prev[1]) * KM_PER_DEG_LNG;
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      const speedKnots = distKm / dtHours / 1.852;
      if (speedKnots > MAX_SPEED_KNOTS) continue;
    }
    filtered.push(cur);
  }
  return filtered;
}

// ── ship_type 中文 → AIS 數字碼映射 ──

const SHIP_TYPE_MAP: Record<string, number> = {
  "漁船": 30, "貨船": 70, "油輪": 80, "客輪": 60,
  "高速船": 40, "拖船": 52, "疏浚船": 33, "遊艇": 36,
  "帆船": 36, "引水船": 50, "執法船": 55, "港口小艇": 50,
  "未指定": 0,
};

function parseShipType(t: string | null): number {
  if (!t) return 0;
  return SHIP_TYPE_MAP[t] ?? 0;
}

/** 解析 "lat,lng,ts;lat,lng,ts;..." → TrailPoint[] */
function parseTrail(trail: string): TrailPoint[] {
  const points = trail.split(";");
  const result: TrailPoint[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const parts = points[i]!.split(",");
    result[i] = [+parts[0]!, +parts[1]!, 0, +parts[2]!];
  }
  return result;
}

// ── Supabase loaders ──

async function fetchShipDatesSupabase(): Promise<ShipDateInfo[]> {
  const { data, error } = await supabase.rpc("get_ship_dates");
  if (error) throw new Error(`Supabase get_ship_dates: ${error.message}`);
  return (data as { date: string; records: number; ships: number }[]).map((d) => ({
    date: d.date,
    records: Number(d.records),
    ships: Number(d.ships),
  }));
}

async function fetchShipDaySupabase(date: string): Promise<ShipData> {
  const t0 = performance.now();
  const { data, error } = await supabase.rpc("get_ship_trails", { target_date: date });
  if (error) throw new Error(`Supabase get_ship_trails: ${error.message}`);

  const rows = data as { mmsi: string; ship_type: string | null; trail: string }[];
  let tsMin = Infinity;
  let tsMax = -Infinity;
  let totalFiltered = 0;

  const ships: Ship[] = rows.map((row) => {
    const rawPath = parseTrail(row.trail);
    const path = filterGpsAnomalies(rawPath);
    totalFiltered += rawPath.length - path.length;
    for (const pt of path) {
      if (pt[3] < tsMin) tsMin = pt[3];
      if (pt[3] > tsMax) tsMax = pt[3];
    }
    return { mmsi: row.mmsi, vessel_type: parseShipType(row.ship_type), path };
  });

  const elapsed = (performance.now() - t0).toFixed(0);
  console.log(
    `[Ship/Supabase] ${date}: ${ships.length} ships, ${elapsed}ms` +
    (totalFiltered > 0 ? `, filtered ${totalFiltered} anomalous points` : "")
  );

  return {
    metadata: {
      date,
      ship_count: ships.length,
      time_range: [
        tsMin === Infinity ? 0 : tsMin,
        tsMax === -Infinity ? 0 : tsMax,
      ] as [number, number],
    },
    ships,
  };
}

// ── Pulse API loaders (legacy) ──

async function fetchShipDatesApi(): Promise<ShipDateInfo[]> {
  const res = await fetch(`${API}/ships/dates`);
  if (!res.ok) throw new Error(`ships/dates: ${res.status}`);
  const data = await res.json();
  return data.dates as ShipDateInfo[];
}

async function fetchShipDayArrowApi(date: string): Promise<ShipData> {
  const res = await fetch(`${API}/ships/day?date=${date}&format=arrow`);
  if (!res.ok) throw new Error(`ships/day ${date}: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const table = tableFromIPC(new Uint8Array(buffer));

  const shipMap = new Map<number, Ship>();
  const mmsiCol = table.getChild("mmsi")!;
  const latCol = table.getChild("lat")!;
  const lonCol = table.getChild("lon")!;
  const vtypeCol = table.getChild("vtype")!;
  const tsCol = table.getChild("ts_unix")!;

  let tsMin = Infinity;
  let tsMax = -Infinity;
  let filteredPoints = 0;

  for (let i = 0; i < table.numRows; i++) {
    const mmsi = mmsiCol.get(i) as number;
    const lat = latCol.get(i) as number;
    const lon = lonCol.get(i) as number;
    const vtype = vtypeCol.get(i) as number;
    const ts = Number(tsCol.get(i));

    if (ts < tsMin) tsMin = ts;
    if (ts > tsMax) tsMax = ts;

    let ship = shipMap.get(mmsi);
    if (!ship) {
      ship = { mmsi: String(mmsi), vessel_type: vtype, path: [] };
      shipMap.set(mmsi, ship);
    }

    const path = ship.path;
    if (path.length > 0) {
      const last = path[path.length - 1]!;
      const dtHours = (ts - last[3]) / 3600;
      if (dtHours > 0) {
        const dLat = (lat - last[0]) * KM_PER_DEG_LAT;
        const dLon = (lon - last[1]) * KM_PER_DEG_LNG;
        const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
        const speedKnots = distKm / dtHours / 1.852;
        if (speedKnots > MAX_SPEED_KNOTS) { filteredPoints++; continue; }
      }
    }
    path.push([lat, lon, 0, ts]);
  }

  if (filteredPoints > 0) {
    console.log(`[Ship/Arrow] Filtered ${filteredPoints} anomalous points (speed > ${MAX_SPEED_KNOTS} knots)`);
  }

  return {
    metadata: {
      date,
      ship_count: shipMap.size,
      time_range: [tsMin === Infinity ? 0 : tsMin, tsMax === -Infinity ? 0 : tsMax] as [number, number],
    },
    ships: Array.from(shipMap.values()),
  };
}

// ── Public API (auto-switch based on VITE_DATA_SOURCE) ──

/** 取得所有有船舶資料的日期 */
export async function fetchShipDates(): Promise<ShipDateInfo[]> {
  if (isSupabase()) return fetchShipDatesSupabase();
  return fetchShipDatesApi();
}

/** 載入單日船舶資料 */
export async function fetchShipDayArrow(date: string): Promise<ShipData> {
  if (isSupabase()) return fetchShipDaySupabase(date);
  return fetchShipDayArrowApi(date);
}

/** 從已取得的日期清單中挑選最佳日期並載入（避免重複查詢 dates） */
export async function loadShipsWithDates(dates: ShipDateInfo[]): Promise<ShipData> {
  if (!dates || dates.length === 0) throw new Error("No ship dates available");

  if (isSupabase()) {
    const today = todayTaiwan();
    // 優先選今天，沒有則往前找最近的日期（不選未來）
    for (let i = dates.length - 1; i >= 0; i--) {
      const d = dates[i]!;
      if (d.date <= today && d.records > 1000) {
        console.log(`[Ship/Supabase] Picking date ${d.date} (${d.ships} ships, ${d.records} records)`);
        return fetchShipDaySupabase(d.date);
      }
    }
    const fallback = dates[dates.length - 1]!;
    console.log(`[Ship/Supabase] No suitable day, using ${fallback.date}`);
    return fetchShipDaySupabase(fallback.date);
  }

  const latest = dates[dates.length - 1]!.date;
  return fetchShipDayArrowApi(latest);
}

/** 舊介面（legacy 用，會自己查 dates） */
export async function loadShipsFromApi(): Promise<ShipData> {
  const dates = await fetchShipDates();
  return loadShipsWithDates(dates);
}

// ── Legacy loaders (fallback) ──

let legacyCached: ShipData | null = null;
const S3_SHIP = `${S3_BASE}/${SHIP_PREFIX}`;

interface ShipManifest {
  lastUpdated: string;
  dates: { date: string; shipCount: number }[];
}

async function loadFromS3(): Promise<ShipData> {
  const manifestRes = await fetch(`${S3_SHIP}/manifest.json`);
  if (!manifestRes.ok) throw new Error("Ship S3 manifest not available");
  const manifest: ShipManifest = await manifestRes.json();

  if (manifest.dates.length === 0) throw new Error("Ship S3 manifest has no dates");

  const fetches = manifest.dates.map(async (d) => {
    const [y, m, dd] = d.date.split("-");
    const res = await fetch(`${S3_SHIP}/${y}/${m}/${dd}/data.json`);
    if (!res.ok) return null;
    return (await res.json()) as ShipData;
  });

  const results = await Promise.all(fetches);
  const valid = results.filter((r): r is ShipData => r !== null);

  if (valid.length === 0) throw new Error("No ship data from S3");
  if (valid.length === 1) return valid[0]!;

  const merged: ShipData = {
    metadata: valid[0]!.metadata,
    ships: valid.flatMap((d) => d.ships),
  };
  merged.metadata.ship_count = merged.ships.length;
  return merged;
}

/** Legacy: 從本地檔案或 S3 載入 */
export async function loadShipsLegacy(): Promise<ShipData> {
  if (legacyCached) return legacyCached;

  try {
    const res = await fetch("/ship_data.json");
    if (res.ok) {
      const text = await res.text();
      if (text.trimStart().startsWith("<")) throw new Error("Got HTML, not JSON");
      legacyCached = JSON.parse(text);
      return legacyCached!;
    }
  } catch {
    // fall through to S3
  }

  console.log("[Ship] Local file unavailable, loading from S3...");
  legacyCached = await loadFromS3();
  return legacyCached!;
}
