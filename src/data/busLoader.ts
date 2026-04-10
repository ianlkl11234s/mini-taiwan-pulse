/**
 * 公車資料載入 — 靜態路線 + Supabase 即時位置
 */

import type { BusRouteData, BusRouteGeometry, BusPosition, BusDateInfo, BusTrail, TrailPoint } from "../types";
import { BusCity, BUS_CITY_CONFIG } from "../types";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { dedupRpc } from "../lib/rpcDebounce";

// Per-city route cache
const cityRouteCache = new Map<BusCity, BusRouteData>();
const cityRouteFetching = new Map<BusCity, Promise<BusRouteData>>();

/** 載入指定城市的靜態路線幾何（lazy，有 per-city 快取） */
export async function loadBusRoutesForCity(city: BusCity): Promise<BusRouteData> {
  if (cityRouteCache.has(city)) return cityRouteCache.get(city)!;

  // 正在 fetching 中，複用同一個 promise
  if (cityRouteFetching.has(city)) return cityRouteFetching.get(city)!;

  const promise = withLoading(
    `bus-routes-${city}`,
    `公車路線 ${city}`,
    fetch(BUS_CITY_CONFIG[city].jsonFile).then((r) => {
      if (!r.ok) throw new Error(`Bus routes ${city}: ${r.status}`);
      return r.json() as Promise<Record<string, BusRouteGeometry>>;
    }),
  ).then((raw) => {
    const routes = new Map<string, BusRouteGeometry>();
    const routeIndex = new Map<string, string[]>();

    for (const [key, val] of Object.entries(raw)) {
      routes.set(key, val);
      const uid = val.routeUid;
      if (!routeIndex.has(uid)) routeIndex.set(uid, []);
      routeIndex.get(uid)!.push(key);
    }

    console.log(`[Bus] Loaded ${routes.size} route shapes for ${city}`);
    const result: BusRouteData = { routes, routeIndex };
    cityRouteCache.set(city, result);
    cityRouteFetching.delete(city);
    return result;
  }).catch((err) => {
    console.warn(`[Bus] Failed to load routes for ${city}:`, err);
    cityRouteFetching.delete(city);
    const empty: BusRouteData = { routes: new Map(), routeIndex: new Map() };
    return empty;
  });

  cityRouteFetching.set(city, promise);
  return promise;
}

/** 向後兼容 wrapper（呼叫 loadBusRoutesForCity("Taipei")） */
export async function loadBusRoutes(): Promise<BusRouteData> {
  return loadBusRoutesForCity("Taipei");
}

/** 從 Supabase 拉取即時公車位置（25s 內重複呼叫直接複用） */
export async function fetchBusCurrent(cities: BusCity[]): Promise<BusPosition[]> {
  if (!supabaseConfigured) return [];
  if (cities.length === 0) return [];

  const dedupKey = `get_bus_current:${[...cities].sort().join(",")}`;

  return dedupRpc(dedupKey, async () => {
    const { data, error } = await supabase.rpc("get_bus_current", { cities });
    if (error) {
      console.warn("[Bus] RPC error:", error.message);
      return [];
    }
    if (!data) return [];

    return (data as any[]).map((row) => ({
      plateNumb: row.plate_numb,
      routeUid: row.route_uid,
      routeName: row.route_name,
      direction: row.direction,
      city: row.city as BusCity,
      lat: row.bus_lat,
      lng: row.bus_lng,
      speed: row.speed ?? 0,
      collectedAt: new Date(row.collected_at).getTime() / 1000,
    }));
  }, 25_000);
}

// ── Replay (歷史回放) ──

/** 解析 trail string → TrailPoint[]（與 shipLoader 同格式） */
function parseTrail(trail: string): TrailPoint[] {
  const segments = trail.split(";");
  const result: TrailPoint[] = new Array(segments.length);
  for (let i = 0; i < segments.length; i++) {
    const parts = segments[i]!.split(",");
    result[i] = [+parts[0]!, +parts[1]!, 0, +parts[2]!];
  }
  return result;
}

/** 取得可用日期清單 */
export async function fetchBusDates(): Promise<BusDateInfo[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_bus_dates");
  if (error) {
    console.warn("[Bus] get_bus_dates error:", error.message);
    return [];
  }
  if (!data) return [];
  return (data as any[]).map((d) => ({
    day: d.day,
    records: Number(d.records),
    buses: Number(d.buses),
  }));
}

/** 載入指定日期的公車歷史軌跡 */
export async function fetchBusTrails(date: string, cities: BusCity[]): Promise<BusTrail[]> {
  if (!supabaseConfigured) return [];

  const { data, error } = await withLoading(
    `bus-trails:${date}`,
    `公車軌跡 ${date}`,
    supabase.rpc("get_bus_trails", { target_date: date, cities }),
  );
  if (error) {
    console.warn("[Bus] get_bus_trails error:", error.message);
    return [];
  }
  if (!data) return [];

  const rows = data as any[];
  console.log(`[Bus] Trails for ${date}: ${rows.length} buses`);
  return rows.map((row) => ({
    plateNumb: row.plate_numb,
    routeUid: row.route_uid ?? null,
    routeName: row.route_name ?? null,
    city: row.city ?? null,
    path: parseTrail(row.trail),
  }));
}
