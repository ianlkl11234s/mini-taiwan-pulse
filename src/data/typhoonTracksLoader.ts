// 颱風軌跡 loader（from public.typhoon_positions，migration 261）
// time-point decomposed schema：一筆 row = 一個颱風在一個時刻的位置
//   point_type='observed' → 過去軌跡實線
//   point_type='forecast' → 未來預報虛線（取最新 advisory_number）
import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export interface TyphoonPoint {
  storm_id: string;
  source: string;            // 'jma' / 'jtwc'
  point_type: "observed" | "forecast";
  advisory_number: number | null;
  valid_ts: number;          // unix seconds
  name_en: string;
  name_local: string;
  center_lat: number;
  center_lon: number;
  center_pressure: number | null;
  max_wind_kt: number | null;
}

interface RawRow {
  storm_id: string;
  source: string;
  valid_at: string;
  point_type: string;
  advisory_number: number | null;
  name_local: string | null;
  name_en: string | null;
  center_lat: number | null;
  center_lon: number | null;
  center_pressure_hpa: number | null;
  max_wind_kt: number | null;
}

async function fetchTyphoonPointsUncached(): Promise<TyphoonPoint[]> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    "typhoon-positions",
    "颱風軌跡 JMA/JTWC",
    supabase
      .from("typhoon_positions")
      .select(
        "storm_id,source,valid_at,point_type,advisory_number,name_local,name_en,center_lat,center_lon,center_pressure_hpa,max_wind_kt",
      )
      .order("valid_at", { ascending: true })
      .limit(5000),
  );
  if (error) throw new Error(`Supabase typhoon_positions: ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const pts: TyphoonPoint[] = [];
  for (const r of rows) {
    if (r.center_lat == null || r.center_lon == null) continue;
    pts.push({
      storm_id: r.storm_id,
      source: r.source,
      point_type: r.point_type === "forecast" ? "forecast" : "observed",
      advisory_number: r.advisory_number,
      valid_ts: Math.floor(new Date(r.valid_at).getTime() / 1000),
      name_en: r.name_en ?? "",
      name_local: r.name_local ?? "",
      center_lat: Number(r.center_lat),
      center_lon: Number(r.center_lon),
      center_pressure: r.center_pressure_hpa == null ? null : Number(r.center_pressure_hpa),
      max_wind_kt: r.max_wind_kt == null ? null : Number(r.max_wind_kt),
    });
  }
  console.log(`[TyphoonTracks] Loaded ${pts.length} points in ${(performance.now() - t0).toFixed(0)}ms`);
  return pts;
}

const fetchTyphoonPointsCached = cachedOnce(fetchTyphoonPointsUncached, 10 * 60_000);

export function fetchTyphoonPoints(): Promise<TyphoonPoint[]> {
  return fetchTyphoonPointsCached();
}

/**
 * 把 point 陣列轉成兩種 feature：
 * - LineString per (storm_id, source, point_type) — 觀測 / 預報各一條
 * - Point per row — 給 hover popup
 */
export function typhoonPointsToGeoJSON(
  pts: TyphoonPoint[],
): { lines: GeoJSON.FeatureCollection; points: GeoJSON.FeatureCollection } {
  const groups = new Map<string, TyphoonPoint[]>();
  for (const p of pts) {
    const key = `${p.storm_id}::${p.source}::${p.point_type}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }
  const lineFeatures: GeoJSON.Feature[] = [];
  for (const [key, arr] of groups) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => a.valid_ts - b.valid_ts);
    const [stormId, source, pointType] = key.split("::");
    const head = arr[0]!;
    lineFeatures.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: arr.map((p) => [p.center_lon, p.center_lat]),
      },
      properties: {
        storm_id: stormId,
        source,
        point_type: pointType,
        name_en: head.name_en,
        name_local: head.name_local,
      },
    });
  }
  const pointFeatures: GeoJSON.Feature[] = pts.map((p) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.center_lon, p.center_lat] },
    properties: {
      storm_id: p.storm_id,
      source: p.source,
      point_type: p.point_type,
      advisory_number: p.advisory_number,
      valid_ts: p.valid_ts,
      name_en: p.name_en,
      name_local: p.name_local,
      center_pressure: p.center_pressure,
      max_wind_kt: p.max_wind_kt,
    },
  }));
  return {
    lines: { type: "FeatureCollection", features: lineFeatures },
    points: { type: "FeatureCollection", features: pointFeatures },
  };
}
