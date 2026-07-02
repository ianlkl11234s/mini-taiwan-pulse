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
/** 活躍門檻：storm 最新觀測點若落後「全體最新觀測」超過此秒數，視為已消散，不標現在位置。 */
const ACTIVE_WINDOW_SEC = 48 * 3600;

// 颱風前進最快約 120 km/h；相鄰點距離超過「120×時距 + 緩衝」視為資料異常（JMA preTyphoon
// 時間戳與主軌跡交錯造成的跳點），在此斷開 LineString，避免畫出穿越整張圖的假線。
const MAX_STORM_KMH = 120;
const JUMP_BUFFER_KM = 250;

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 把時序點陣列切成多段（相鄰點跳躍不合理處斷開），每段回傳座標陣列。 */
function splitOnJumps(arr: TyphoonPoint[]): number[][][] {
  const segments: number[][][] = [];
  let cur: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i]!;
    const coord = [p.center_lon, p.center_lat];
    if (cur.length > 0) {
      const prev = arr[i - 1]!;
      const dtHr = Math.max(0.5, (p.valid_ts - prev.valid_ts) / 3600);
      const maxKm = MAX_STORM_KMH * dtHr + JUMP_BUFFER_KM;
      if (haversineKm([prev.center_lon, prev.center_lat], [p.center_lon, p.center_lat]) > maxKm) {
        if (cur.length >= 2) segments.push(cur);
        cur = [];
      }
    }
    cur.push(coord);
  }
  if (cur.length >= 2) segments.push(cur);
  return segments;
}

export function typhoonPointsToGeoJSON(
  pts: TyphoonPoint[],
): { lines: GeoJSON.FeatureCollection; points: GeoJSON.FeatureCollection; current: GeoJSON.FeatureCollection } {
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
    // 在不合理跳點處斷開成多段（避免 JMA preTyphoon 時間戳交錯畫出穿越假線）
    for (const coords of splitOnJumps(arr)) {
      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {
          storm_id: stormId,
          source,
          point_type: pointType,
          name_en: head.name_en,
          name_local: head.name_local,
        },
      });
    }
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
  // 現在位置：每個「活躍」storm×source 的最新觀測點（畫成醒目圈圈）
  const latestByStorm = new Map<string, TyphoonPoint>();
  let globalMaxObs = 0;
  for (const p of pts) {
    if (p.point_type !== "observed") continue;
    globalMaxObs = Math.max(globalMaxObs, p.valid_ts);
    const key = `${p.storm_id}::${p.source}`;
    const cur = latestByStorm.get(key);
    if (!cur || p.valid_ts > cur.valid_ts) latestByStorm.set(key, p);
  }
  const currentFeatures: GeoJSON.Feature[] = [];
  for (const p of latestByStorm.values()) {
    if (globalMaxObs - p.valid_ts > ACTIVE_WINDOW_SEC) continue; // 已消散
    currentFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.center_lon, p.center_lat] },
      properties: {
        storm_id: p.storm_id,
        source: p.source,
        point_type: p.point_type,
        valid_ts: p.valid_ts,
        name_en: p.name_en,
        name_local: p.name_local,
        center_pressure: p.center_pressure,
        max_wind_kt: p.max_wind_kt,
      },
    });
  }

  return {
    lines: { type: "FeatureCollection", features: lineFeatures },
    points: { type: "FeatureCollection", features: pointFeatures },
    current: { type: "FeatureCollection", features: currentFeatures },
  };
}
