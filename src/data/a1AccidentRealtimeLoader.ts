import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

interface A1Row {
  dedup_hash: string;
  occurred_at: string;
  agency: string | null;
  location: string | null;
  lat: number | string;
  lon: number | string;
  weather: string | null;
  light: string | null;
  road_type: string | null;
  accident_type_major: string | null;
  accident_type_sub: string | null;
  cause_main_major: string | null;
  cause_main_sub: string | null;
  death_injury: string | null;
}

const TAIWAN_BBOX = { min_lon: 118.0, min_lat: 21.0, max_lon: 123.0, max_lat: 26.0 };

/** Build FeatureCollection 並把 occurred_ts (unix sec) 寫進 properties，由前端再算 age */
export async function fetchA1AccidentsRealtime(days = 30): Promise<GeoJSON.FeatureCollection> {
  const { data, error } = await withLoading(
    "a1AccidentRealtime",
    "A1 即時事故（30 天滾動）",
    supabase.rpc("get_a1_accidents_by_bbox", {
      p_min_lon: TAIWAN_BBOX.min_lon,
      p_min_lat: TAIWAN_BBOX.min_lat,
      p_max_lon: TAIWAN_BBOX.max_lon,
      p_max_lat: TAIWAN_BBOX.max_lat,
      p_days: days,
    }),
  );
  if (error) throw new Error(`get_a1_accidents_by_bbox: ${error.message}`);
  const rows = (data ?? []) as A1Row[];
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    const lng = Number(r.lon);
    const lat = Number(r.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const ts = Math.floor(Date.parse(r.occurred_at) / 1000);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        ...r,
        occurred_ts: Number.isFinite(ts) ? ts : 0,
      },
    });
  }
  return { type: "FeatureCollection", features };
}
