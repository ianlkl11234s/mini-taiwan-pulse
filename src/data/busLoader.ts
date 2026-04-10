/**
 * 公車資料載入 — 靜態路線 + Supabase 即時位置
 */

import type { BusRouteData, BusRouteGeometry, BusPosition, BusDateInfo, BusTrail, TrailPoint } from "../types";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { dedupRpc } from "../lib/rpcDebounce";

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

/** 從 Supabase 拉取即時公車位置（25s 內重複呼叫直接複用） */
export async function fetchBusCurrent(): Promise<BusPosition[]> {
  if (!supabaseConfigured) return [];

  return dedupRpc("get_bus_current_taipei", async () => {
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
export async function fetchBusTrails(date: string): Promise<BusTrail[]> {
  if (!supabaseConfigured) return [];

  const { data, error } = await withLoading(
    `bus-trails:${date}`,
    `公車軌跡 ${date}`,
    supabase.rpc("get_bus_trails", { target_date: date }),
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
