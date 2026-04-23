import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * CWA 即時雨量站（每 10 分鐘）
 *
 * 後端：gis-platform migration 054（latest）+ 057（當日時序，for timeline 回放）
 *   public.get_rain_gauge_latest()
 *   public.get_rain_gauge_day(target_date)
 *
 * 視覺化策略：
 *   - 圓圈半徑：precipitation_10min（瞬時降水強度）
 *   - 圓圈顏色：precipitation_1hr 依 CWA 分級（小雨 → 超大豪雨）
 *   - 0 mm 的站點淡化顯示（或過濾）
 *
 * Timeline 回放：
 *   一次 fetch 整天 × 每小時一筆 snapshot (~31k rows)，由 hook 在
 *   timeStore.subscribeThrottled 裡依 currentTime 切片渲染。
 */

/** get_rain_gauge_day 回傳列 */
export interface RainGaugeDayRow {
  station_id: string;
  station_name: string | null;
  county: string | null;
  town: string | null;
  lat: number;
  lng: number;
  bucket_at: string;
  observed_at: string;
  precipitation_10min: number | null;
  precipitation_1hr: number | null;
  precipitation_3hr: number | null;
  precipitation_24hr: number | null;
}

/** 當日雨量每小時時序（for timeline 回放） */
export async function fetchRainGaugeDay(dateKey: string): Promise<RainGaugeDayRow[]> {
  const { data, error } = await withLoading(
    `rain-gauge-day-${dateKey}`,
    `即時雨量 ${dateKey}`,
    supabase.rpc("get_rain_gauge_day", { target_date: dateKey }),
  );
  if (error) throw new Error(`get_rain_gauge_day(${dateKey}): ${error.message}`);
  return (data ?? []) as RainGaugeDayRow[];
}
