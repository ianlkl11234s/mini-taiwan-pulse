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
