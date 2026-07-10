/**
 * 台灣好行 (Tourist Shuttle) 資料載入 — 靜態路線 + Supabase 即時位置 + 歷史軌跡
 *
 * 架構完全沿用 busLoader 的公路客運 (InterCity) 段，差異：
 *   - current RPC 無參數（get_tourist_shuttle_current()）
 *   - 全國單一資料源，無 city / sub_authorities 過濾
 */

import type { BusRouteData, BusRouteGeometry, BusPosition, BusDateInfo, BusTrail, TrailPoint } from "../types";
import { TOURIST_SHUTTLE_ROUTES_JSON } from "../types";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { dedupRpc } from "../lib/rpcDebounce";

let routeCache: BusRouteData | null = null;
let routeFetching: Promise<BusRouteData> | null = null;

// 即時位置：只有初次載入顯示 loading，背景 30s tick 靜默
const currentLoadedOnce = new Set<string>();

/** 解析 trail string → TrailPoint[]（與 busLoader / shipLoader 同格式） */
function parseTrail(trail: string): TrailPoint[] {
  const segments = trail.split(";");
  const result: TrailPoint[] = new Array(segments.length);
  for (let i = 0; i < segments.length; i++) {
    const parts = segments[i]!.split(",");
    result[i] = [+parts[0]!, +parts[1]!, 0, +parts[2]!];
  }
  return result;
}

/** 載入台灣好行靜態路線幾何（全國單一檔，lazy） */
export async function loadTouristShuttleRoutes(): Promise<BusRouteData> {
  if (routeCache) return routeCache;
  if (routeFetching) return routeFetching;

  routeFetching = withLoading(
    "tourist-shuttle-routes",
    "台灣好行路線",
    fetch(TOURIST_SHUTTLE_ROUTES_JSON).then((r) => {
      if (!r.ok) throw new Error(`Tourist shuttle routes: ${r.status}`);
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

    console.log(`[TouristShuttle] Loaded ${routes.size} route shapes`);
    const result: BusRouteData = { routes, routeIndex };
    routeCache = result;
    routeFetching = null;
    return result;
  }).catch((err) => {
    console.warn("[TouristShuttle] Failed to load routes:", err);
    routeFetching = null;
    const empty: BusRouteData = { routes: new Map(), routeIndex: new Map() };
    return empty;
  });

  return routeFetching;
}

/** 拉取台灣好行即時位置（25s 內重複呼叫直接複用；RPC 無參數） */
export async function fetchTouristShuttleCurrent(): Promise<BusPosition[]> {
  if (!supabaseConfigured) return [];

  const firstLoad = !currentLoadedOnce.has("get_tourist_shuttle_current");

  return dedupRpc("get_tourist_shuttle_current", async () => {
    const rpc = supabase.rpc("get_tourist_shuttle_current");
    const { data, error } = await (firstLoad
      ? withLoading("get_tourist_shuttle_current", "台灣好行即時", rpc)
      : rpc);
    currentLoadedOnce.add("get_tourist_shuttle_current");
    if (error) {
      console.warn("[TouristShuttle] RPC error:", error.message);
      return [];
    }
    if (!data) return [];

    return (data as any[]).map((row) => ({
      plateNumb: row.plate_numb,
      routeUid: row.route_uid,
      routeName: row.route_name,
      direction: row.direction,
      // city 欄位借用來顯示業者代號（tooltip 用）
      city: row.operator_id ?? "",
      lat: row.bus_lat,
      lng: row.bus_lng,
      speed: row.speed ?? 0,
      collectedAt: new Date(row.collected_at).getTime() / 1000,
    }));
  }, 25_000);
}

/** 取得台灣好行可用日期清單 */
export async function fetchTouristShuttleDates(): Promise<BusDateInfo[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "tourist-shuttle:dates",
    "台灣好行日期",
    supabase.rpc("get_tourist_shuttle_dates"),
  );
  if (error) {
    console.warn("[TouristShuttle] get_tourist_shuttle_dates error:", error.message);
    return [];
  }
  if (!data) return [];
  return (data as any[]).map((d) => ({
    day: d.day,
    records: Number(d.records),
    buses: Number(d.buses),
  }));
}

/** 載入台灣好行指定日期歷史軌跡（全國單一 RPC 呼叫） */
export async function fetchTouristShuttleTrails(date: string): Promise<BusTrail[]> {
  if (!supabaseConfigured) return [];

  const result = await withLoading(
    `tourist-shuttle-trails:${date}`,
    `台灣好行軌跡 ${date}`,
    supabase.rpc("get_tourist_shuttle_trails", { target_date: date }),
  );

  if (result.error) {
    console.warn("[TouristShuttle] get_tourist_shuttle_trails error:", result.error.message);
    return [];
  }
  if (!result.data) return [];

  const trails: BusTrail[] = (result.data as any[]).map((row) => ({
    plateNumb: row.plate_numb,
    routeUid: row.route_uid ?? null,
    routeName: row.route_name ?? null,
    direction: row.direction ?? 0,
    city: row.operator_id ?? null,
    path: parseTrail(row.trail),
  }));

  console.log(`[TouristShuttle] Trails for ${date}: ${trails.length} buses`);
  return trails;
}
