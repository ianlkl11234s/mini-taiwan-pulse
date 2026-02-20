import type { Flight } from "../types";

let cachedFlights: Flight[] | null = null;

/** 載入 aviation_data.json */
export async function loadFlights(): Promise<Flight[]> {
  if (cachedFlights) return cachedFlights;

  const res = await fetch("/aviation_data.json");
  const data: Flight[] = await res.json();

  // 過濾掉沒有軌跡點的航班
  cachedFlights = data.filter((f) => f.path.length > 0);
  return cachedFlights;
}

/** 依目的地機場 ICAO 篩選（降落航班） */
export function filterByArrivalAirport(
  flights: Flight[],
  icao: string,
): Flight[] {
  return flights.filter((f) => f.dest_icao === icao);
}

/** 依出發機場 ICAO 篩選（起飛航班） */
export function filterByDepartureAirport(
  flights: Flight[],
  icao: string,
): Flight[] {
  return flights.filter((f) => f.origin_icao === icao);
}

/** 依機場篩選（起飛或降落） */
export function filterByAirport(flights: Flight[], icao: string): Flight[] {
  return flights.filter(
    (f) => f.dest_icao === icao || f.origin_icao === icao,
  );
}

/** 取得資料中所有出現的台灣機場 ICAO */
export function getTaiwanAirports(flights: Flight[]): string[] {
  const twIcaoPrefix = "RC";
  const airports = new Set<string>();
  for (const f of flights) {
    if (f.origin_icao.startsWith(twIcaoPrefix)) airports.add(f.origin_icao);
    if (f.dest_icao.startsWith(twIcaoPrefix)) airports.add(f.dest_icao);
  }
  return [...airports].sort();
}

/** 依時間窗口篩選：當前時間 ±12h 內與指定機場相關的航班 */
export function filterByTimeWindow(
  flights: Flight[],
  icao: string,
  currentTime: number,
  windowHours: number = 12,
): Flight[] {
  const windowSec = windowHours * 3600;
  const tMin = currentTime - windowSec;
  const tMax = currentTime + windowSec;

  return flights.filter((f) => {
    // 必須與指定機場相關
    if (f.dest_icao !== icao && f.origin_icao !== icao) return false;
    // 軌跡時間範圍必須與窗口重疊
    if (f.path.length === 0) return false;
    const pathStart = f.path[0]![3];
    const pathEnd = f.path[f.path.length - 1]![3];
    return pathEnd >= tMin && pathStart <= tMax;
  });
}

/** 取得航班群的時間範圍 */
export function getTimeRange(flights: Flight[]): {
  start: number;
  end: number;
} {
  let start = Infinity;
  let end = -Infinity;
  for (const f of flights) {
    for (const pt of f.path) {
      const t = pt[3];
      if (t < start) start = t;
      if (t > end) end = t;
    }
  }
  return { start, end };
}
