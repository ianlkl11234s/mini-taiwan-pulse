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

/**
 * 同一 storm×source×point_type×時刻若有多點（JMA preTyphoon/typhoon/analysis 段
 * 用同時間戳），合成單一質心點，消除軌跡鋸齒與堆疊點。
 */
function dedupeSameTimestamp(pts: TyphoonPoint[]): TyphoonPoint[] {
  const acc = new Map<string, { lat: number; lon: number; n: number; wind: number | null; press: number | null; base: TyphoonPoint }>();
  for (const p of pts) {
    if (p.center_lat == null || p.center_lon == null) continue;
    const key = `${p.storm_id}::${p.source}::${p.point_type}::${p.valid_ts}`;
    const cur = acc.get(key);
    if (!cur) {
      acc.set(key, { lat: p.center_lat, lon: p.center_lon, n: 1, wind: p.max_wind_kt, press: p.center_pressure, base: p });
    } else {
      cur.lat += p.center_lat; cur.lon += p.center_lon; cur.n += 1;
      if (p.max_wind_kt != null) cur.wind = Math.max(cur.wind ?? 0, p.max_wind_kt);
      if (p.center_pressure != null) cur.press = Math.min(cur.press ?? Infinity, p.center_pressure);
    }
  }
  return [...acc.values()].map((a) => ({
    ...a.base,
    center_lat: a.lat / a.n,
    center_lon: a.lon / a.n,
    max_wind_kt: a.wind,
    center_pressure: a.press === Infinity ? null : a.press,
  }));
}

export function typhoonPointsToGeoJSON(
  rawPts: TyphoonPoint[],
): { lines: GeoJSON.FeatureCollection; points: GeoJSON.FeatureCollection; current: GeoJSON.FeatureCollection } {
  const pts = dedupeSameTimestamp(rawPts);
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

// ══════════════════════════════════════════════════════════════════
//  Monitor 颱風卡摘要（查 public.typhoons_active view；無活躍颱風回 null）
// ══════════════════════════════════════════════════════════════════
//
// view（migration 261）＝ DISTINCT ON (storm_id, source) 的最新觀測點
// + valid_at ≥ now()-24h：活躍判定以**牆鐘**為基準 —— typhoon_positions 無 retention，
// 若改以「資料內最新點」當基準，颱風季後 collector 停寫時舊颱風會永遠滿足窗（幽靈卡）。
// DISTINCT ON 也天然解掉 JMA 同 valid_ts 多點時代表點不定的問題。

export interface TyphoonSummary {
  storm_id: string;
  name_local: string;
  name_en: string;
  center_lat: number;
  center_lon: number;
  center_pressure: number | null;
  max_wind_kt: number | null;
  /** 中心至台灣本島最近錨點距離（km） */
  distance_km: number;
  /** 回報此颱風的來源（大寫，如 JMA / JTWC） */
  sources: string[];
  /** 最新觀測時刻 unix 秒 */
  valid_ts: number;
}

/** `public.typhoons_active` 的一列 */
export interface TyphoonActiveRow {
  storm_id: string;
  source: string;
  valid_at: string;
  name_local: string | null;
  name_en: string | null;
  center_lat: number | null;
  center_lon: number | null;
  center_pressure_hpa: number | null;
  max_wind_kt: number | null;
}

// 台灣本島四極 + 中心錨點，取最近距離當「距台灣」
const TW_ANCHORS: [number, number][] = [
  [121.5, 25.15], // 北 · 基隆
  [120.9, 23.9],  // 中
  [120.7, 22.0],  // 南 · 恆春
  [121.6, 23.9],  // 東 · 花蓮
  [120.2, 23.5],  // 西 · 雲嘉海岸
];

function distToTaiwanKm(lon: number, lat: number): number {
  let min = Infinity;
  for (const [alon, alat] of TW_ANCHORS) {
    const d = haversineKm([lon, lat], [alon, alat]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * view 只濾了 valid_at 的**下界**（now-24h），沒有上界 —— 上游 JTWC 實測有 valid_at
 * 落在三週後的壞列（2026-08 觀察到 valid_at=2026-08-31 的殘列）。這種列每天都滿足
 * 「近 24h」，會變成永遠不消失的幽靈來源，故在前端補上界。
 */
const FUTURE_TOLERANCE_SEC = 6 * 3600;

/**
 * 跨來源補值（氣壓 / 風速 / 名稱 / 來源徽章）只吃「離代表點夠近」的列。
 * 同一個名字在不同來源可能對到**不同的**低壓系統（實測 JTWC 有同名 storm 落在
 * 3000km 外），無條件取 min(氣壓) / max(風速) 會把別的風暴數值貼到這張卡上。
 */
const CROSS_SOURCE_RADIUS_KM = 500;

/**
 * 挑目前最靠近台灣的活躍颱風（純函式，給測試用）。
 * JMA / JTWC 同一颱風 storm_id 不同、名稱相同 → 依名稱聚合來源。
 */
export function pickActiveTyphoon(
  rawRows: TyphoonActiveRow[],
  nowTs: number,
): TyphoonSummary | null {
  const rows = rawRows.filter(
    (r) =>
      r.center_lat != null && r.center_lon != null &&
      Math.floor(new Date(r.valid_at).getTime() / 1000) <= nowTs + FUTURE_TOLERANCE_SEC,
  );
  if (rows.length === 0) return null;

  // 依名稱聚合（同颱風不同來源）
  const groups = new Map<string, TyphoonActiveRow[]>();
  for (const r of rows) {
    const k = (r.name_en || r.name_local || r.storm_id).toLowerCase();
    const arr = groups.get(k);
    if (arr) arr.push(r);
    else groups.set(k, [r]);
  }

  // 每組取離台灣最近的來源列為代表，再挑整體最近的一組
  let best: { rep: TyphoonActiveRow; group: TyphoonActiveRow[]; dist: number } | null = null;
  for (const group of groups.values()) {
    let rep = group[0]!;
    let repDist = distToTaiwanKm(Number(rep.center_lon), Number(rep.center_lat));
    for (const r of group) {
      const d = distToTaiwanKm(Number(r.center_lon), Number(r.center_lat));
      if (d < repDist) { rep = r; repDist = d; }
    }
    if (!best || repDist < best.dist) best = { rep, group, dist: repDist };
  }
  if (!best) return null;

  // 只留「與代表點同一個系統」的列（見 CROSS_SOURCE_RADIUS_KM）
  const repCoord: [number, number] = [Number(best.rep.center_lon), Number(best.rep.center_lat)];
  const sameStorm = best.group.filter(
    (r) => haversineKm(repCoord, [Number(r.center_lon), Number(r.center_lat)]) <= CROSS_SOURCE_RADIUS_KM,
  );

  // 名稱 / 氣壓 / 風速跨來源補齊（單一來源最新觀測點常缺值：氣壓取最低、風速取最大）
  let nameEn = "";
  let nameLocal = "";
  let pressure: number | null = null;
  let wind: number | null = null;
  for (const r of sameStorm) {
    if (!nameEn && r.name_en) nameEn = r.name_en;
    if (!nameLocal && r.name_local) nameLocal = r.name_local;
    if (r.center_pressure_hpa != null) {
      const p = Number(r.center_pressure_hpa);
      pressure = pressure == null ? p : Math.min(pressure, p);
    }
    if (r.max_wind_kt != null) {
      const w = Number(r.max_wind_kt);
      wind = wind == null ? w : Math.max(wind, w);
    }
  }

  return {
    storm_id: best.rep.storm_id,
    name_local: nameLocal,
    name_en: nameEn,
    center_lat: Number(best.rep.center_lat),
    center_lon: Number(best.rep.center_lon),
    center_pressure: pressure,
    max_wind_kt: wind,
    distance_km: Math.round(best.dist),
    sources: [...new Set(sameStorm.map((r) => r.source.toUpperCase()))].sort(),
    valid_ts: Math.floor(new Date(best.rep.valid_at).getTime() / 1000),
  };
}

// 刻意不包 withLoading：這是 Monitor 面板的背景輪詢（30min 一次），
// 不是圖層載入 —— 灌 LOADING 面板會讓牆面每半小時閃一次。
// 比照 loadingRegistryContract.test.ts 對 airportPaxLoader 的豁免理由；
// 該 ratchet 只掃 supabase.rpc/staticRpc，`.from()` 不在掃描範圍，故無需登記。
async function fetchTyphoonSummaryUncached(): Promise<TyphoonSummary | null> {
  const { data, error } = await supabase
    .from("typhoons_active")
    .select(
      "storm_id,source,valid_at,name_local,name_en,center_lat,center_lon,center_pressure_hpa,max_wind_kt",
    );
  if (error) throw new Error(`Supabase typhoons_active: ${error.message}`);
  return pickActiveTyphoon((data ?? []) as TyphoonActiveRow[], Math.floor(Date.now() / 1000));
}

const fetchTyphoonSummaryCached = cachedOnce(fetchTyphoonSummaryUncached, 10 * 60_000);

/** 給 Monitor 颱風卡：最靠近台灣的活躍颱風；無活躍颱風回 null */
export function fetchTyphoonSummary(): Promise<TyphoonSummary | null> {
  return fetchTyphoonSummaryCached();
}

export const invalidateTyphoonSummary = (): void => fetchTyphoonSummaryCached.invalidate();
