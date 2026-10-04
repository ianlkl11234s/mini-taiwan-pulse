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
const inFlight = new Map<number, Promise<CatalogResult>>();

/** missing = 讀取成功但 UCS 沒有這顆；error = 讀取失敗（兩者文案不同） */
export type CatalogResult =
  | { status: "ok"; row: CatalogRow }
  | { status: "missing" }
  | { status: "error"; reason: "unconfigured" | "rpc" };

type BatchResult =
  | { ok: true; rows: CatalogRow[] }
  | { ok: false; reason: "unconfigured" | "rpc" };

/** 取單顆。已 cache 就同步返回，否則合併到 batch */
export async function fetchCatalog(norad: number): Promise<CatalogResult> {
  const hit = cache.get(norad);
  if (hit) return { status: "ok", row: hit };
  const pending = inFlight.get(norad);
  if (pending) return pending;
  const p = fetchBatchResult([norad]).then((r): CatalogResult => {
    if (!r.ok) return { status: "error", reason: r.reason };
    const row = r.rows[0];
    return row ? { status: "ok", row } : { status: "missing" };
  });
  inFlight.set(norad, p);
  try {
    return await p;
  } finally {
    inFlight.delete(norad);
  }
}

/** 批次取多顆（百科卡 batch load 用）；失敗時回 []，要分辨失敗請用 fetchBatchResult */
export async function fetchBatch(norads: number[]): Promise<CatalogRow[]> {
  const r = await fetchBatchResult(norads);
  return r.ok ? r.rows : [];
}

async function fetchBatchResult(norads: number[]): Promise<BatchResult> {
  const uniq = Array.from(new Set(norads));
  const missing = uniq.filter((n) => !cache.has(n));
  if (missing.length === 0) {
    return { ok: true, rows: uniq.map((n) => cache.get(n)!).filter(Boolean) };
  }
  if (!supabaseConfigured) return { ok: false, reason: "unconfigured" };
  const { data, error } = await withLoading(
    `satellite:catalog:${missing.length}`,
    "衛星百科 UCS",
    supabase.rpc("get_satellite_catalog", { p_norads: missing }),
  );
  if (error) {
    console.warn("[satconsole] get_satellite_catalog failed:", error.message);
    return { ok: false, reason: "rpc" };
  }
  for (const row of (data ?? []) as CatalogRow[]) {
    cache.set(row.norad_number, row);
  }
  return {
    ok: true,
    rows: uniq.map((n) => cache.get(n)).filter((x): x is CatalogRow => !!x),
  };
}

/** "14 年 7 個月" 給百科卡 §E "已運作" 欄位用。anchorMs 預設為時間軸當下 */
export function formatOperatingSince(launchDate: string | null, anchorMs?: number): string {
  if (!launchDate) return "—";
  const launch = new Date(launchDate);
  if (Number.isNaN(launch.getTime())) return "—";
  const nowMs = anchorMs ?? Date.now();
  const ms = nowMs - launch.getTime();
  if (ms < 0) return "尚未發射";
  const totalMonths = Math.floor(ms / (30.44 * 86400 * 1000));
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} 個月`;
  if (m === 0) return `${y} 年`;
  return `${y} 年 ${m} 個月`;
}
