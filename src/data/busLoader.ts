/**
 * 公車資料載入 — 靜態路線 + Supabase 即時位置
 */

import type { BusRouteData, BusRouteGeometry, BusPosition, BusDateInfo, BusTrail, TrailPoint } from "../types";
import { BusCity, BUS_CITY_CONFIG, BUS_INTERCITY_ROUTES_JSON } from "../types";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { dedupRpc } from "../lib/rpcDebounce";

// Per-city route cache
const cityRouteCache = new Map<BusCity, BusRouteData>();
const cityRouteFetching = new Map<BusCity, Promise<BusRouteData>>();

// 公車即時位置：只有初次載入顯示 loading，背景 30s tick 靜默（避免 loading UI 每次閃）
const busCurrentLoadedOnce = new Set<string>();

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
  const firstLoad = !busCurrentLoadedOnce.has(dedupKey);

  return dedupRpc(dedupKey, async () => {
    const rpc = supabase.rpc("get_bus_current", { cities });
    const { data, error } = await (firstLoad
      ? withLoading(dedupKey, `公車即時 ${cities.join("/")}`, rpc)
      : rpc);
    busCurrentLoadedOnce.add(dedupKey);
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
      city: row.city,
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
  const { data, error } = await withLoading(
    "bus:dates",
    "公車日期",
    supabase.rpc("get_bus_dates"),
  );
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

/** 單一城市 fetch，內部使用 */
async function fetchBusTrailsForCity(date: string, city: BusCity): Promise<BusTrail[]> {
  const { data, error } = await supabase.rpc("get_bus_trails", {
    target_date: date,
    cities: [city],
  });
  if (error) {
    console.warn(`[Bus] get_bus_trails error (${city}):`, error.message);
    return [];
  }
  if (!data) return [];

  return (data as any[]).map((row) => ({
    plateNumb: row.plate_numb,
    routeUid: row.route_uid ?? null,
    routeName: row.route_name ?? null,
    direction: row.direction ?? 0,
    city: row.city ?? null,
    path: parseTrail(row.trail),
  }));
}

/**
 * 載入指定日期的公車歷史軌跡
 * 分 city 平行 fetch 後合併，避免單次 response 超過 Supabase ~4MB 限制
 */
export async function fetchBusTrails(date: string, cities: BusCity[]): Promise<BusTrail[]> {
  if (!supabaseConfigured) return [];
  if (cities.length === 0) return [];

  const results = await withLoading(
    `bus-trails:${date}`,
    `公車軌跡 ${date}`,
    Promise.all(cities.map((city) => fetchBusTrailsForCity(date, city))),
  );

  const merged = results.flat();
  console.log(`[Bus] Trails for ${date}: ${merged.length} buses (${cities.join("+")})`);
  return merged;
}

// ============================================================
// 公路客運 (InterCity) ─ 全國單一資料源，無 city 切換
// ============================================================

let intercityRouteCache: BusRouteData | null = null;
let intercityRouteFetching: Promise<BusRouteData> | null = null;

/** 載入公路客運靜態路線幾何（全國單一檔，lazy） */
export async function loadBusIntercityRoutes(): Promise<BusRouteData> {
  if (intercityRouteCache) return intercityRouteCache;
  if (intercityRouteFetching) return intercityRouteFetching;

  intercityRouteFetching = withLoading(
    "bus-routes-intercity",
    "公路客運路線",
    fetch(BUS_INTERCITY_ROUTES_JSON).then((r) => {
      if (!r.ok) throw new Error(`Bus intercity routes: ${r.status}`);
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

    console.log(`[BusIntercity] Loaded ${routes.size} route shapes`);
    const result: BusRouteData = { routes, routeIndex };
    intercityRouteCache = result;
    intercityRouteFetching = null;
    return result;
  }).catch((err) => {
    console.warn("[BusIntercity] Failed to load routes:", err);
    intercityRouteFetching = null;
    const empty: BusRouteData = { routes: new Map(), routeIndex: new Map() };
    return empty;
  });

  return intercityRouteFetching;
}

/** 拉取公路客運即時位置（25s 內重複呼叫直接複用） */
export async function fetchBusIntercityCurrent(): Promise<BusPosition[]> {
  if (!supabaseConfigured) return [];

  const firstLoad = !busCurrentLoadedOnce.has("get_bus_intercity_current");

  return dedupRpc("get_bus_intercity_current", async () => {
    // 無 city 過濾：sub_authorities=NULL 取全部
    const rpc = supabase.rpc("get_bus_intercity_current", { sub_authorities: null });
    const { data, error } = await (firstLoad
      ? withLoading("get_bus_intercity_current", "公路客運即時", rpc)
      : rpc);
    busCurrentLoadedOnce.add("get_bus_intercity_current");
    if (error) {
      console.warn("[BusIntercity] RPC error:", error.message);
      return [];
    }
    if (!data) return [];

    return (data as any[]).map((row) => ({
      plateNumb: row.plate_numb,
      routeUid: row.route_uid,
      routeName: row.route_name,
      direction: row.direction,
      city: row.city,
      lat: row.bus_lat,
      lng: row.bus_lng,
      speed: row.speed ?? 0,
      collectedAt: new Date(row.collected_at).getTime() / 1000,
    }));
  }, 25_000);
}

/** 取得公路客運可用日期清單 */
export async function fetchBusIntercityDates(): Promise<BusDateInfo[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "bus-intercity:dates",
    "公路客運日期",
    supabase.rpc("get_bus_intercity_dates"),
  );
  if (error) {
    console.warn("[BusIntercity] get_bus_intercity_dates error:", error.message);
    return [];
  }
  if (!data) return [];
  return (data as any[]).map((d) => ({
    day: d.day,
    records: Number(d.records),
    buses: Number(d.buses),
  }));
}

/** 載入公路客運指定日期歷史軌跡（全國單一 RPC 呼叫） */
export async function fetchBusIntercityTrails(date: string): Promise<BusTrail[]> {
  if (!supabaseConfigured) return [];

  const result = await withLoading(
    `bus-intercity-trails:${date}`,
    `公路客運軌跡 ${date}`,
    supabase.rpc("get_bus_intercity_trails", {
      target_date: date,
      sub_authorities: null,
    }),
  );

  if (result.error) {
    console.warn("[BusIntercity] get_bus_intercity_trails error:", result.error.message);
    return [];
  }
  if (!result.data) return [];

  const trails: BusTrail[] = (result.data as any[]).map((row) => ({
    plateNumb: row.plate_numb,
    routeUid: row.route_uid ?? null,
    routeName: row.route_name ?? null,
    direction: row.direction ?? 0,
    city: row.city ?? null,
    path: parseTrail(row.trail),
  }));

  console.log(`[BusIntercity] Trails for ${date}: ${trails.length} buses`);
  return trails;
}
