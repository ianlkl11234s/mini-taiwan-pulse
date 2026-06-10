import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * 都市淹水感知器 USWG（每 10 分鐘，全國 1,999 站）
 *
 * 後端：gis-platform migration 148（站點 + 時序）+ 151（時序 RPC）
 *   public.get_uswg_latest(p_county_code, p_hours, p_min_value)
 *   public.get_uswg_timeseries(p_iow_station_id, p_hours)  ← popup sparkline 用
 *
 * 視覺化策略：
 *   - 點：每站最新淹水深度（cm），>0 染紅，=0 灰底淡化
 *   - 同心圓 buffer：500m + 1km 影響範圍提示（純前端 mapbox circle，依 zoom 內插）
 *   - 不接 timeline 回放（即時警示場景，非當日回放）
 */

export interface FloodSensorRow {
  iow_station_id: string;
  name: string | null;
  county_name: string | null;
  town_name: string | null;
  admin_name: string | null;
  lat: number;
  lng: number;
  si_unit: string | null;
  value: number | null;       // 淹水深度 (cm)
  observed_at: string;
}

export interface FloodSensorTimeseriesRow {
  observed_at: string;
  value: number | null;
  si_unit: string | null;
}

async function fetchFloodSensorLatestUncached(): Promise<FloodSensorRow[]> {
  const { data, error } = await withLoading(
    "flood-sensor-latest",
    "淹水感測器 即時",
    supabase.rpc("get_uswg_latest", {
      p_county_code: null,
      p_hours: 6,
      p_min_value: null,
    }),
  );
  if (error) throw new Error(`get_uswg_latest: ${error.message}`);
  return (data ?? []) as FloodSensorRow[];
}

const fetchFloodSensorLatestCached = cachedOnce(fetchFloodSensorLatestUncached, 5 * 60_000);

/** 全國最新淹水深度（預設過去 6 小時內有讀值的站）。5min TTL 快取，toggle 不重抓 */
export function fetchFloodSensorLatest(): Promise<FloodSensorRow[]> {
  return fetchFloodSensorLatestCached();
}

export interface FloodSensorDayRow {
  iow_station_id: string;
  name: string | null;
  county_name: string | null;
  town_name: string | null;
  lat: number;
  lng: number;
  bucket_at: string;
  observed_at: string;
  value: number | null;
  si_unit: string | null;
}

/**
 * 當日 USWG 每小時 snapshot（for timeline 回放）
 *
 * USWG 全國 ~1940 站 × 24 buckets ≈ 33k rows/day，超過 PostgREST
 * max-rows=20000。RPC 內部 LIMIT 19999、接受 p_offset → 前端連續拉直到 < PAGE。
 */
const USWG_PAGE = 19999;
async function fetchFloodSensorDayUncached(dateKey: string): Promise<FloodSensorDayRow[]> {
  const all: FloodSensorDayRow[] = [];
  for (let offset = 0, i = 0; i < 6; i++, offset += USWG_PAGE) {
    const { data, error } = await withLoading(
      `flood-sensor-day-${dateKey}-${i}`,
      `淹水感測器 ${dateKey} (${i + 1})`,
      supabase.rpc("get_uswg_day", { target_date: dateKey, p_offset: offset }),
    );
    if (error) throw new Error(`get_uswg_day(${dateKey}) offset ${offset}: ${error.message}`);
    const rows = (data ?? []) as FloodSensorDayRow[];
    for (const r of rows) all.push(r);
    if (rows.length < USWG_PAGE) break; // EOF
  }
  return all;
}

const fetchFloodSensorDayCached = cachedByKey(fetchFloodSensorDayUncached, 10 * 60_000);

/**
 * 當日 USWG 每小時 snapshot（for timeline 回放）
 *
 * USWG 全國 ~1940 站 × 24 buckets ≈ 33k rows/day，超過 PostgREST
 * max-rows=20000。RPC 內部 LIMIT 19999、接受 p_offset → 前端連續拉直到 < PAGE。
 * 10min TTL 快取，toggle 不重抓。
 */
export function fetchFloodSensorDay(dateKey: string): Promise<FloodSensorDayRow[]> {
  return fetchFloodSensorDayCached(dateKey);
}

/** 單站過去 N 小時時序（給 popup sparkline 用） */
export async function fetchFloodSensorTimeseries(
  iowStationId: string,
  hours = 24,
): Promise<FloodSensorTimeseriesRow[]> {
  const { data, error } = await supabase.rpc("get_uswg_timeseries", {
    p_iow_station_id: iowStationId,
    p_hours: hours,
  });
  if (error) throw new Error(`get_uswg_timeseries(${iowStationId}): ${error.message}`);
  return (data ?? []) as FloodSensorTimeseriesRow[];
}
