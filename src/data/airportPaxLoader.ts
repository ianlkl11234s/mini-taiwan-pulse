import { supabase } from "../lib/supabase";

export interface AirportPaxBucket {
  hour_bucket: string;
  pax_in: number;
  pax_out: number;
  pax_transit: number;
}

export async function fetchAirportHourlyPax(
  airport: string,
  hours = 24,
): Promise<AirportPaxBucket[]> {
  if (!airport) return [];
  const { data, error } = await supabase.rpc("get_airport_hourly_pax", {
    p_airport: airport,
    p_hours: hours,
  });
  if (error) throw new Error(`get_airport_hourly_pax: ${error.message}`);
  return (data ?? []) as AirportPaxBucket[];
}

/**
 * 以最新一桶往前 `hours` 小時為預期視窗，任一整點桶缺席（整列不存在）即回 true。
 * 此時小計只是下限，不能標成完整 24 小時總數。沒有任何可解析的桶時回 false（交給「無資料」處理）。
 */
export function hasMissingHourBuckets(rows: readonly AirportPaxBucket[], hours = 24): boolean {
  const HOUR = 3600_000;
  const present = new Set<number>();
  let latest = -Infinity;
  for (const r of rows) {
    const t = Date.parse(r.hour_bucket);
    if (!Number.isFinite(t)) continue;
    present.add(Math.floor(t / HOUR));
    if (t > latest) latest = t;
  }
  if (!Number.isFinite(latest)) return false;
  const end = Math.floor(latest / HOUR);
  for (let h = end - hours + 1; h <= end; h++) if (!present.has(h)) return true;
  return false;
}
