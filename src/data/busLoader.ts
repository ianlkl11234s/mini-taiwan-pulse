/**
 * 公車資料載入 — 靜態路線 + Supabase 即時位置
 */

import type { BusRouteData, BusRouteGeometry, BusPosition } from "../types";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

let cachedRoutes: BusRouteData | null = null;

/** 載入靜態路線幾何（lazy，有快取） */
export async function loadBusRoutes(): Promise<BusRouteData> {
  if (cachedRoutes) return cachedRoutes;

  const raw: Record<string, BusRouteGeometry> = await withLoading(
    "bus-routes",
    "公車路線",
    fetch("./bus/taipei_bus_routes.json").then((r) => {
      if (!r.ok) throw new Error(`Bus routes: ${r.status}`);
      return r.json();
    }),
  );

  const routes = new Map<string, BusRouteGeometry>();
  const routeIndex = new Map<string, string[]>();

  for (const [key, val] of Object.entries(raw)) {
    routes.set(key, val);
    const uid = val.routeUid;
    if (!routeIndex.has(uid)) routeIndex.set(uid, []);
    routeIndex.get(uid)!.push(key);
  }

  console.log(`[Bus] Loaded ${routes.size} route shapes`);
  cachedRoutes = { routes, routeIndex };
  return cachedRoutes;
}

/** 從 Supabase 拉取即時公車位置 */
export async function fetchBusCurrent(): Promise<BusPosition[]> {
  if (!supabaseConfigured) return [];

  const { data, error } = await supabase.rpc("get_bus_current_taipei");
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
    lat: row.bus_lat,
    lng: row.bus_lng,
    speed: row.speed ?? 0,
    collectedAt: new Date(row.collected_at).getTime() / 1000,
  }));
}
