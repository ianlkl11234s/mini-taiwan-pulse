/**
 * Satellite Console §E — UCS catalog（衛星百科卡）
 *
 * 對應 gis-platform migration 169: get_satellite_catalog(p_norads INT[])
 * 28 欄 UCS Satellite Database（purpose/launch/contractor/mass/...）。
 *
 * 以 NORAD 為 key 的記憶體 cache，避免來回切衛星時重打 RPC。
 */
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

export interface CatalogRow {
  norad_number: number;
  name: string | null;
  official_name: string | null;
  country_un: string | null;
  country_operator: string | null;
  operator: string | null;
  users: string | null;
  purpose: string | null;
  detailed_purpose: string | null;
  orbit_class: string | null;
  orbit_type: string | null;
  perigee_km: number | null;
  apogee_km: number | null;
  eccentricity: number | null;
  inclination_deg: number | null;
  period_min: number | null;
  launch_mass_kg: number | null;
  dry_mass_kg: number | null;
  power_watts: number | null;
  launch_date: string | null;
  expected_lifetime_yrs: number | null;
  contractor: string | null;
  country_contractor: string | null;
  launch_site: string | null;
  launch_vehicle: string | null;
  cospar_number: string | null;
  comments: string | null;
}

const cache = new Map<number, CatalogRow>();
const inFlight = new Map<number, Promise<CatalogRow | null>>();

/** 取單顆。已 cache 就同步返回，否則合併到 batch */
export async function fetchCatalog(norad: number): Promise<CatalogRow | null> {
  if (cache.has(norad)) return cache.get(norad) ?? null;
  if (inFlight.has(norad)) return inFlight.get(norad) ?? null;
  const p = fetchBatch([norad]).then((rows) => rows[0] ?? null);
  inFlight.set(norad, p);
  try {
    return await p;
  } finally {
    inFlight.delete(norad);
  }
}

/** 批次取多顆（百科卡 batch load 用） */
export async function fetchBatch(norads: number[]): Promise<CatalogRow[]> {
  const uniq = Array.from(new Set(norads));
  const missing = uniq.filter((n) => !cache.has(n));
  if (missing.length === 0) {
    return uniq.map((n) => cache.get(n)!).filter(Boolean);
  }
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    `satellite:catalog:${missing.length}`,
    "衛星百科 UCS",
    supabase.rpc("get_satellite_catalog", { p_norads: missing }),
  );
  if (error) {
    console.warn("[satconsole] get_satellite_catalog failed:", error.message);
    return [];
  }
  for (const row of (data ?? []) as CatalogRow[]) {
    cache.set(row.norad_number, row);
  }
  return uniq.map((n) => cache.get(n)).filter((x): x is CatalogRow => !!x);
}

/** "14 年 7 個月" 給百科卡 §E "已運作" 欄位用 */
export function formatOperatingSince(launchDate: string | null): string {
  if (!launchDate) return "—";
  const launch = new Date(launchDate);
  if (Number.isNaN(launch.getTime())) return "—";
  const ms = Date.now() - launch.getTime();
  const totalMonths = Math.floor(ms / (30.44 * 86400 * 1000));
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} 個月`;
  if (m === 0) return `${y} 年`;
  return `${y} 年 ${m} 個月`;
}
