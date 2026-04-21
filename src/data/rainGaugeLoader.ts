import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * CWA 即時雨量站（每 10 分鐘）
 *
 * 後端：gis-platform migration 054
 *   public.get_rain_gauge_latest()
 *
 * 視覺化策略：
 *   - 圓圈半徑：precipitation_10min（瞬時降水強度）
 *   - 圓圈顏色：precipitation_1hr 依 CWA 分級（小雨 → 超大豪雨）
 *   - 0 mm 的站點淡化顯示（或過濾）
 */

export interface RainGauge {
  station_id: string;
  station_name: string | null;
  county: string | null;
  town: string | null;
  lat: number;
  lng: number;
  precipitation_10min: number | null;
  precipitation_1hr: number | null;
  precipitation_3hr: number | null;
  precipitation_6hr: number | null;
  precipitation_12hr: number | null;
  precipitation_24hr: number | null;
  observed_at: string | null;
}

export async function fetchRainGaugeLatest(): Promise<RainGauge[]> {
  const { data, error } = await withLoading(
    "rain-gauge-latest",
    "即時雨量",
    supabase.rpc("get_rain_gauge_latest"),
  );
  if (error) throw new Error(`get_rain_gauge_latest: ${error.message}`);
  return (data ?? []) as RainGauge[];
}

/** CWA 雨量分級（以 1hr 累積 mm 對應顏色） */
export const RAIN_LEVEL_COLORS = {
  none: "#6b7280",    // 無雨或無資料（灰）
  light: "#93c5fd",   // < 2.5 mm/hr 小雨
  moderate: "#3b82f6",// 2.5-15 中雨
  heavy: "#22c55e",   // 15-40 大雨
  torrential: "#fbbf24", // 40-80 豪雨
  extreme: "#f97316", // 80-200 大豪雨
  superExtreme: "#ef4444", // >200 超大豪雨
};

/** 將 1 筆 rain gauge feature 轉 GeoJSON feature */
export function rainGaugeToFeature(r: RainGauge): GeoJSON.Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    properties: {
      station_id: r.station_id,
      station_name: r.station_name ?? "",
      county: r.county ?? "",
      town: r.town ?? "",
      precipitation_10min: r.precipitation_10min ?? 0,
      precipitation_1hr: r.precipitation_1hr ?? 0,
      precipitation_3hr: r.precipitation_3hr ?? 0,
      precipitation_24hr: r.precipitation_24hr ?? 0,
      observed_at: r.observed_at ?? "",
    },
  };
}

export function buildRainGaugeGeoJSON(list: RainGauge[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list
      .filter((r) => r.lat != null && r.lng != null)
      .map(rainGaugeToFeature),
  };
}
