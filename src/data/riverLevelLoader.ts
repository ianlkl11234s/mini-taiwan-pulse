import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 河川水位即時讀值（WRA，每 10 分鐘）
 *
 * 後端：gis-platform migration 055
 *   public.get_river_water_level_latest()
 *
 * NOTE：原 public.river_stations 含三級警戒水位但目前無資料，本 RPC JOIN
 * water_monitoring_stations 僅取座標。警戒水位視覺化需等上游 seed 補齊。
 *
 * 視覺策略：
 *   - 圓圈半徑：water_level_m 絕對值（大致反映「大河」vs「小溪」）
 *   - 顏色：單色青（#22d3ee）；check_result=0 時警示紅
 */

export interface RiverWaterLevel {
  station_id: string;
  station_name: string | null;
  county: string | null;
  lat: number;
  lng: number;
  water_level_m: number | null;
  check_result: number | null;
  observed_at: string | null;
}

export async function fetchRiverWaterLevelLatest(): Promise<RiverWaterLevel[]> {
  const { data, error } = await withLoading(
    "river-level-latest",
    "河川水位",
    supabase.rpc("get_river_water_level_latest"),
  );
  if (error) throw new Error(`get_river_water_level_latest: ${error.message}`);
  return (data ?? []) as RiverWaterLevel[];
}

export function buildRiverLevelGeoJSON(list: RiverWaterLevel[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
        properties: {
          station_id: r.station_id,
          station_name: r.station_name ?? "",
          county: r.county ?? "",
          water_level_m: r.water_level_m ?? 0,
          check_result: r.check_result ?? 1,
          observed_at: r.observed_at ?? "",
        },
      })),
  };
}
