import { supabase } from "../lib/supabase";
import { cachedByKey } from "../lib/loaderCache";

/**
 * 地層下陷單站時序（G19 測站 popup 趨勢圖）。
 *
 * 後端：gis-platform migration 474 `public.get_land_subsidence_timeseries(p_station_id, p_from, p_to, p_bucket)`
 *   p_from／p_to 皆 null ＝ 該站最新一筆往回 10 年；month 桶。
 *   value_kind：elevation_m（GNSS 橢球高 m）／ring_compression_mm（磁環，depth_layer_m＝環號）／
 *   pile_compression_unspecified（深層樁，單位上游未註明）。
 * bucket_start 是 date 字串（上游 observed_at 為台灣當地字面時間；月桶不受時區影響），不做 +8 換算。
 */
export interface LandSubsidenceRow {
  bucket_start: string;
  depth_layer_m: number | null;
  value: number;
  n: number;
  value_kind: "elevation_m" | "ring_compression_mm" | "pile_compression_unspecified";
}

async function fetchUncached(stationId: string): Promise<LandSubsidenceRow[]> {
  const { data, error } = await supabase.rpc("get_land_subsidence_timeseries", {
    p_station_id: stationId, p_from: null, p_to: null, p_bucket: "month",
  });
  if (error) throw new Error(`get_land_subsidence_timeseries(${stationId}): ${error.message}`);
  return ((data ?? []) as LandSubsidenceRow[]).map((row) => ({
    ...row,
    value: Number(row.value),
    depth_layer_m: row.depth_layer_m == null ? null : Number(row.depth_layer_m),
  })).filter((row) => Number.isFinite(row.value));
}

const cached = cachedByKey(fetchUncached, 30 * 60_000);

/** 單站 10 年月均時序；30 分快取（資料年更）。 */
export function fetchLandSubsidenceTimeseries(stationId: string): Promise<LandSubsidenceRow[]> {
  return cached(stationId);
}
