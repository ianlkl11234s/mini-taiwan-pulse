import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 垃圾車「表定」時刻表 loader（Phase 3 prototype）
 *
 * 後端：gis-platform migration 079_waste_schedule_rpc.sql
 *   - public.get_waste_schedule_day(p_cities, p_dow)
 *
 * 跟 wasteLoader（GPS）的差異：
 *   - wasteLoader = 真實 GPS 軌跡 / OSRM matched
 *   - wasteScheduleLoader = 從 spatial.waste_collection_stops 表定 arrival/departure_time
 *     按時刻表跑（即使該車今天沒上線、也會動）
 *
 * 5 城資料現況（2026-05-10）：
 *   高雄市 8,870 dedup stops · 360 routes · weekday 中文「、」分隔
 *   新北市 23,280 stops · 612 routes · weekday 中文「,」分隔
 *   臺北市  4,010 stops · 187 routes · weekday 全空 → RPC 視為每日
 *   宜蘭縣  1,726 stops · 75 routes  · weekday 中文單字
 *   基隆市  1,079 stops · 55 routes  · weekday 數字 1-7 (ISO)
 */

/** RPC 回傳的單筆 stop（flat row） */
interface RawScheduleRow {
  city: string;
  route_id: string;
  route_name: string | null;
  vehicle_type: string;
  stop_seq: number;
  stop_id: number;
  stop_name: string | null;
  lng: number;
  lat: number;
  arrival_sec: number;     // 從當日 00:00:00 起算秒數（可 ≥ 86400 跨日）
  departure_sec: number;
}

export interface WasteScheduleStop {
  stopId: number;
  stopSeq: number;
  stopName: string | null;
  lng: number;
  lat: number;
  /** 當日 00:00 起算秒數（可 > 86400 跨日，例如 24:11 = 87060） */
  arrivalSec: number;
  departureSec: number;
}

export interface WasteScheduleRoute {
  city: string;
  routeId: string;
  routeName: string | null;
  vehicleType: string;
  stops: WasteScheduleStop[];   // 已按 arrival_sec 排序，stop_seq 1..N
}

/**
 * 撈指定星期幾的整日表定。
 *
 * @param cities 5 城子集，預設全 5 城
 * @param dow JS Date.getDay() 規則：0=Sun, 1=Mon, ..., 6=Sat
 */
export async function fetchWasteScheduleDay(
  cities: string[] = ["高雄市", "新北市", "宜蘭縣", "臺北市", "基隆市"],
  dow: number,
): Promise<WasteScheduleRoute[]> {
  const citiesKey = [...cities].sort().join(",");
  const { data, error } = await withLoading(
    `waste-schedule-${citiesKey}-${dow}`,
    `垃圾車表定 ${citiesKey} dow=${dow}`,
    supabase.rpc("get_waste_schedule_day", { p_cities: cities, p_dow: dow }),
  );
  if (error) throw new Error(`get_waste_schedule_day(dow=${dow}): ${error.message}`);
  const rows = (data ?? []) as RawScheduleRow[];

  // Group by (city, route_id) — RPC 已 ORDER BY city, route_id, arrival_sec
  const routes: WasteScheduleRoute[] = [];
  let current: WasteScheduleRoute | null = null;
  for (const r of rows) {
    if (!current || current.city !== r.city || current.routeId !== r.route_id) {
      current = {
        city: r.city,
        routeId: r.route_id,
        routeName: r.route_name,
        vehicleType: r.vehicle_type,
        stops: [],
      };
      routes.push(current);
    }
    current.stops.push({
      stopId: r.stop_id,
      stopSeq: r.stop_seq,
      stopName: r.stop_name,
      lng: r.lng,
      lat: r.lat,
      arrivalSec: r.arrival_sec,
      departureSec: r.departure_sec,
    });
  }

  // 清洗時間倒退的髒資料（觀察到臺北 ~22 筆「下一站 arrival 比上一站早」）
  // 線性插值會強制視覺折返，過濾掉非單調遞增 stops。
  for (const route of routes) {
    const cleaned: WasteScheduleStop[] = [];
    let lastArrival = -Infinity;
    for (const stop of route.stops) {
      if (stop.arrivalSec >= lastArrival) {
        cleaned.push(stop);
        lastArrival = Math.max(stop.arrivalSec, stop.departureSec);
      }
    }
    route.stops = cleaned;
  }

  return routes;
}

// ── 顏色 / 圖例 ────────────────────────────────────────────

/**
 * 表定動畫顏色（淡紫 / lavender）— 跟 GPS 圖層的琥珀 #fbbf24 在色相上明顯區隔，
 * 兩個圖層同開時可一眼分辨「表定 vs 實際」。
 */
export const WASTE_SCHEDULE_COLOR = "#a78bfa";
export const WASTE_SCHEDULE_LABEL = "垃圾車（表定）";
