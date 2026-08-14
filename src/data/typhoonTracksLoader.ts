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

/**
 * observed 列的「未來容忍度」。上游 JTWC 實測有 `point_type='observed'` 卻 `valid_at`
 * 落在三週後的壞列（2026-08 觀察到 valid_at=2026-08-31 的 wp1226 Dolphin /
 * ep0726 Genevieve 殘列）。**兩處共用同一套判準**：
 *   ① 軌跡 loader 解析階段（見 fetchTyphoonPointsUncached）
 *   ② Monitor 卡的 `public.typhoons_active`（view 只濾了下界 now-24h、沒有上界，
 *      這種列每天都滿足「近 24h」→ 變成永遠不消失的幽靈來源，見 pickActiveTyphoon）
 * forecast 列不受此限 —— 其 valid_at 本來就是未來（實測最遠 +5 天，合法），
 * 由查詢上界 FORECAST_HORIZON_SEC 把關。
 */
const FUTURE_TOLERANCE_SEC = 6 * 3600;

// ── 查詢窗 ────────────────────────────────────────────────────────────
// `live.typhoon_positions` 無 retention（2026-08 已累積 2.3 萬筆），裸 `limit` 一定
// 撈錯批：升冪 = 撈到**最舊**那批（實測窗 2026-06-14 ~ 07-06，8 月資料 0 筆，
// 於是「現在位置」光圈凍在 5 週前）。改成明確時間窗：
//   · 下界 now-14d —— 與地震預設一致；observed 軌跡尺度也就這個量級
//   · 上界 now+7d  —— 放行合法預報（最遠 +5 天），擋掉 8/31 那種離譜壞列
// order 改**降冪**是**在有上界的前提下**才安全：沒有上界的降冪會先撈到 8/31 幽靈，
// 把真實的 Nangka 擠出 limit（畫面只剩兩個假光圈）。有上界後，降冪的好處是萬一
// 真的截斷，掉的是窗內**最舊**的一段，最新軌跡一定留得住。
// limit 12000：實測 14 天窗約 8.3k 列（JMA 同一 valid_at 會寫多列，dedupe 後僅 ~960 點）。
const LOOKBACK_SEC = 14 * 24 * 3600;
const FORECAST_HORIZON_SEC = 7 * 24 * 3600;
const MAX_ROWS = 12000;

async function fetchTyphoonPointsUncached(): Promise<TyphoonPoint[]> {
  const t0 = performance.now();
  const nowSec = Math.floor(Date.now() / 1000);
  const sinceIso = new Date((nowSec - LOOKBACK_SEC) * 1000).toISOString();
  const untilIso = new Date((nowSec + FORECAST_HORIZON_SEC) * 1000).toISOString();
  const { data, error } = await withLoading(
    "typhoon-positions",
    "颱風軌跡 JMA/JTWC",
    supabase
      .from("typhoon_positions")
      .select(
        "storm_id,source,valid_at,point_type,advisory_number,name_local,name_en,center_lat,center_lon,center_pressure_hpa,max_wind_kt",
      )
      .gte("valid_at", sinceIso)
      .lte("valid_at", untilIso)
      .order("valid_at", { ascending: false })
      .limit(MAX_ROWS),
  );
  if (error) throw new Error(`Supabase typhoon_positions: ${error.message}`);

  const rows = (data ?? []) as RawRow[];
  const pts: TyphoonPoint[] = [];
  let dropped = 0;
  for (const r of rows) {
    if (r.center_lat == null || r.center_lon == null) continue;
    const pointType = r.point_type === "forecast" ? "forecast" : "observed";
    const validTs = Math.floor(new Date(r.valid_at).getTime() / 1000);
    // 第二道防線：SQL 上界之外，observed 再用 Monitor 卡同一判準擋一次
    // （上界放寬到 +7d 是為了讓 forecast 過，壞列剛好也是 observed）
    if (pointType === "observed" && validTs > nowSec + FUTURE_TOLERANCE_SEC) {
      dropped += 1;
      continue;
    }
    pts.push({
      storm_id: r.storm_id,
      source: r.source,
      point_type: pointType,
      advisory_number: r.advisory_number,
      valid_ts: validTs,
      name_en: r.name_en ?? "",
      name_local: r.name_local ?? "",
      center_lat: Number(r.center_lat),
      center_lon: Number(r.center_lon),
      center_pressure: r.center_pressure_hpa == null ? null : Number(r.center_pressure_hpa),
      max_wind_kt: r.max_wind_kt == null ? null : Number(r.max_wind_kt),
    });
  }
  console.log(
    `[TyphoonTracks] Loaded ${pts.length} points in ${(performance.now() - t0).toFixed(0)}ms` +
      (dropped ? ` (dropped ${dropped} future-observed rows)` : ""),
  );
  return pts;
}

const fetchTyphoonPointsCached = cachedOnce(fetchTyphoonPointsUncached, 10 * 60_000);

export function fetchTyphoonPoints(): Promise<TyphoonPoint[]> {
  return fetchTyphoonPointsCached();
}

/**
 * 把 point 陣列轉成三種 feature（全部帶時間欄位，讓圖層用 setFilter 跟著時間軸走）：
 * - LineString：**相鄰兩點一段**，帶 `seg_start_ts` / `seg_end_ts`
 *   （不是整條軌跡一個 feature —— Mapbox filter 是 per-feature 全有全無，
 *     切成段才能「已過去的畫、還沒到的不畫」）
 * - Point per row — 給 hover popup，帶 `valid_ts`
 * - Current：每個觀測點帶 `[valid_ts, valid_until)` 有效區間，由 filter 挑出
 *   「區間包住 currentTime」的那一點當現在位置光圈
 */

/**
 * 「現在位置」光圈的滯留秒數：某 storm×source 的觀測點往後撐這麼久仍算「現在在這」
 * （相鄰點間隔更短時以下一點為準，見 typhoonPointsToGeoJSON）。
 *
 * 判準基準已從「抓到的資料內最大觀測時間」(globalMaxObs) 改成**時間軸 currentTime**：
 *   ① 拉時間軸 → 光圈沿軌跡移動到當時位置
 *   ② currentTime = now（Live）時自動退化成**牆鐘** —— 5 週前消散的颱風區間早就
 *      結束，不會再畫光圈（舊版 globalMaxObs 會跟著舊資料一起漂，於是光圈凍在
 *      5 週前還照畫）
 *
 * 與 Monitor 卡的 `typhoons_active`（下界 now-24h）刻意不同門檻：那張卡只回報
 * 「此刻最靠近台灣的活躍颱風」，寧可嚴一點；軌跡圖層則要容忍觀測間隔的空窗。
 */
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

interface TrackSegment {
  coords: number[][];
  /** 段起點時刻（unix 秒） */
  t0: number;
  /** 段終點時刻（unix 秒） */
  t1: number;
}

/**
 * 把時序點陣列切成「相鄰兩點一段」。跳躍不合理的那一對直接略過 ＝ 在該處斷線
 * （原 splitOnJumps 的效果；改成逐段是為了讓時間軸能逐段揭露）。
 */
function pairSegments(arr: TyphoonPoint[]): TrackSegment[] {
  const segments: TrackSegment[] = [];
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1]!;
    const p = arr[i]!;
    const dtHr = Math.max(0.5, (p.valid_ts - prev.valid_ts) / 3600);
    const maxKm = MAX_STORM_KMH * dtHr + JUMP_BUFFER_KM;
    if (haversineKm([prev.center_lon, prev.center_lat], [p.center_lon, p.center_lat]) > maxKm) continue;
    segments.push({
      coords: [
        [prev.center_lon, prev.center_lat],
        [p.center_lon, p.center_lat],
      ],
      t0: prev.valid_ts,
      t1: p.valid_ts,
    });
  }
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
  for (const arr of groups.values()) arr.sort((a, b) => a.valid_ts - b.valid_ts);

  const lineFeatures: GeoJSON.Feature[] = [];
  // 現在位置：每個觀測點帶有效區間 [valid_ts, valid_until)，由圖層 filter 挑
  // 「區間包住 currentTime」的那一點（見 ACTIVE_WINDOW_SEC）
  const currentFeatures: GeoJSON.Feature[] = [];
  for (const [key, arr] of groups) {
    const [stormId, source, pointType] = key.split("::");
    const head = arr[0]!;
    // 在不合理跳點處斷開（避免 JMA preTyphoon 時間戳交錯畫出穿越假線）
    for (const seg of pairSegments(arr)) {
      lineFeatures.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: seg.coords },
        properties: {
          storm_id: stormId,
          source,
          point_type: pointType,
          name_en: head.name_en,
          name_local: head.name_local,
          seg_start_ts: seg.t0,
          seg_end_ts: seg.t1,
        },
      });
    }

    if (pointType !== "observed") continue;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i]!;
      const next = arr[i + 1];
      // 觀測空窗過大時不硬撐（撐滿 ACTIVE_WINDOW_SEC 就斷），避免光圈長時間凍住
      const validUntil = Math.min(
        next ? next.valid_ts : Infinity,
        p.valid_ts + ACTIVE_WINDOW_SEC,
      );
      currentFeatures.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.center_lon, p.center_lat] },
        properties: {
          storm_id: p.storm_id,
          source: p.source,
          point_type: p.point_type,
          valid_ts: p.valid_ts,
          valid_until: validUntil,
          name_en: p.name_en,
          name_local: p.name_local,
          center_pressure: p.center_pressure,
          max_wind_kt: p.max_wind_kt,
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

// view 只濾了 valid_at 的**下界**（now-24h），沒有上界 → 用檔頭的 FUTURE_TOLERANCE_SEC
// 在前端補上界（與軌跡 loader 共用同一判準，見該常數註解）。

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
