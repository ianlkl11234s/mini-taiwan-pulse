import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { base64ToObjectUrl } from "./cwaImageryLoader";

/**
 * 水利署 IoT 累積雨量柵格 PNG
 *
 * 後端：gis-platform migration 150
 *   public.get_latest_precipitation_raster(p_cumulative_hours SMALLINT)
 *
 * cumulative_hours = 1 / 3 / 6 / 24（API 對應不同 raster）
 *
 * 視覺化：mapbox image source + raster layer（沿用 cwaImageryLayer helper）
 */

export interface PrecipRasterFrame {
  cumulativeHours: number;
  observedAtIso: string;
  observedAtMs: number; // epoch ms，timeline 比對用
  url: string;          // object URL（記得 revokeObjectURL）
  ulLat: number;
  ulLng: number;
  brLat: number;
  brLng: number;
  isEmpty: boolean;
}

interface RawRow {
  cumulative_hours: number;
  observed_at: string;
  image_b64: string;   // base64-encoded PNG（RPC 已 encode(image_bytes,'base64')）
  mime_type: string;
  ul_lat: number;
  ul_lng: number;
  br_lat: number;
  br_lng: number;
  is_empty: boolean;
}

function rowToFrame(r: RawRow): PrecipRasterFrame {
  return {
    cumulativeHours: r.cumulative_hours,
    observedAtIso: r.observed_at,
    observedAtMs: new Date(r.observed_at).getTime(),
    url: base64ToObjectUrl(r.image_b64, r.mime_type),
    ulLat: r.ul_lat,
    ulLng: r.ul_lng,
    brLat: r.br_lat,
    brLng: r.br_lng,
    isEmpty: r.is_empty,
  };
}

export async function fetchLatestPrecipRaster(
  cumulativeHours: 1 | 3 | 6 | 24,
): Promise<PrecipRasterFrame | null> {
  const { data, error } = await withLoading(
    `precip-raster-${cumulativeHours}h`,
    `累積雨量柵格 ${cumulativeHours}h`,
    supabase.rpc("get_latest_precipitation_raster", {
      p_cumulative_hours: cumulativeHours,
    }),
  );
  if (error) throw new Error(`get_latest_precipitation_raster(${cumulativeHours}): ${error.message}`);
  const rows = (data ?? []) as RawRow[];
  if (rows.length === 0) return null;
  return rowToFrame(rows[0]!);
}

/**
 * 時間窗內全部 frames（migration 160 的 get_precipitation_raster_frames）。
 * 依 observedAtMs 升序，timeline 歷史播放用。
 */
export async function fetchPrecipRasterFrames(
  cumulativeHours: 1 | 3 | 6 | 24,
  sinceIso: string,
  untilIso: string,
): Promise<PrecipRasterFrame[]> {
  const { data, error } = await withLoading(
    `precip-raster-frames-${cumulativeHours}h`,
    `累積雨量柵格 ${cumulativeHours}h`,
    supabase.rpc("get_precipitation_raster_frames", {
      p_cumulative_hours: cumulativeHours,
      p_since: sinceIso,
      p_until: untilIso,
    }),
  );
  if (error) throw new Error(`get_precipitation_raster_frames(${cumulativeHours}): ${error.message}`);
  const rows = (data ?? []) as RawRow[];
  return rows.map(rowToFrame).sort((a, b) => a.observedAtMs - b.observedAtMs);
}
