import type { Ship, ShipData, TrailPoint } from "../types";
import { supabase, todayTaiwan } from "../lib/supabase";

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

/** 取得所有有船舶資料的日期 */
export async function fetchShipDates(): Promise<ShipDateInfo[]> {
  const { data, error } = await supabase.rpc("get_ship_dates");
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
    `[Ship] ${date}: ${ships.length} ships, ${elapsed}ms` +
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
