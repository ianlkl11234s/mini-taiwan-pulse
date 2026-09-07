import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export interface PrisonDay {
  observed_date: string;
  total_inmates: number | null;
  male_inmates: number | null;
  female_inmates: number | null;
  approved_capacity: number | null;
  over_capacity_pct: number | null;
  new_in_count: number | null;
  new_out_count: number | null;
}

export const fetchPrisonPopulation = cachedOnce(async (): Promise<PrisonDay[]> => {
  const { data, error } = await withLoading("monitor:prison", "在監人口", supabase.rpc("get_prison_population_window", { p_days: 365 }));
  if (error) throw error;
  return (data ?? []) as PrisonDay[];
}, 30 * 60_000);
