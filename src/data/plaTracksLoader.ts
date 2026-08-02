import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * 共機活動區 loader
 * - 來源：spatial.pla_tracks（migration 330）
 * - RPC：get_pla_track_dates(p_include_review) / get_pla_tracks_day(p_date, p_include_review)
 *
 * ⚠️ 這是**依國防部示意圖描繪的活動區域，不是精確航跡**。
 *    官方來源本身即為示意圖，精度以其為上限 —— 圖層說明與 popup 都必須標明。
 *
 * needs_review：守門（抽出形狀數 == 圖上表格期望數）未過的形狀仍入表，
 * 但兩支 RPC 預設排除。要顯示必須明確傳 includeReview，且 popup 會標「待核實」。
 */

export interface PlaTrackDateInfo {
  /** YYYY-MM-DD */
  day: string;
  shapeCount: number;
  /** 該日是否含未核實形狀 */
  needsReview: boolean;
}

export interface PlaTrack {
  shapeNo: number;
  geometry: GeoJSON.Polygon;
  /** rect=細長矩形走廊 / poly=大型不規則活動區 */
  shapeKind: "rect" | "poly";
  vertices: number | null;
  needsReview: boolean;
  /** 是否走過「已知目標數」引導重試（品質仍過門檻，但非基準參數） */
  guided: boolean;
  /** 圖上表格的期望形狀數（項次數扣掉空飄氣球） */
  tableItems: number | null;
  /** 當日空飄氣球項次數（不畫成多邊形，僅供 popup 說明） */
  balloonItems: number;
  chartUrl: string | null;
}

/** 當日通報數值（popup 用，讀 live.pla_activity_daily，不在 pla_tracks 重複存） */
export interface PlaDailyStat {
  reportDate: string;
  /** ⚠ null = 該日解析失敗，與「0 架次」語意不同，勿 ?? 0 */
  sorties: number | null;
  crossedMedian: number | null;
  planVessels: number | null;
  officialShips: number | null;
  chartUrl: string | null;
}

const TTL = 10 * 60_000;

// ── 日期清單 ────────────────────────────────────────────────

async function fetchDatesUncached(includeReview: boolean): Promise<PlaTrackDateInfo[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    `pla-tracks:dates:${includeReview ? "all" : "ok"}`,
    "共機活動區日期",
    supabase.rpc("get_pla_track_dates", { p_include_review: includeReview }),
  );
  if (error) {
    console.warn("[PlaTracks] get_pla_track_dates failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    day: String(r.day),
    shapeCount: Number(r.shape_count ?? 0),
    needsReview: Boolean(r.needs_review),
  }));
}

const fetchDatesCached = cachedByKey(
  (key: string) => fetchDatesUncached(key === "all"),
  TTL,
);

/** 有共機活動區資料的日期清單。10min TTL，toggle 不重抓 */
export function fetchPlaTrackDates(includeReview = false): Promise<PlaTrackDateInfo[]> {
  return fetchDatesCached(includeReview ? "all" : "ok");
}

// ── 當日形狀 ────────────────────────────────────────────────

async function fetchDayUncached(key: string): Promise<PlaTrack[]> {
  if (!supabaseConfigured) return [];
  const [date, mode] = key.split("|");
  const includeReview = mode === "all";
  const { data, error } = await withLoading(
    `pla-tracks:${key}`,
    `共機活動區 ${date}`,
    supabase.rpc("get_pla_tracks_day", {
      p_date: date,
      p_include_review: includeReview,
    }),
  );
  if (error) {
    console.warn(`[PlaTracks] get_pla_tracks_day(${date}) failed:`, error.message);
    return [];
  }
  const out: PlaTrack[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    // RPC 回 jsonb，supabase-js 已解析成物件；仍防守字串形式
    let geometry: GeoJSON.Polygon | null = null;
    const raw = r.geom_geojson;
    if (typeof raw === "string") {
      try {
        geometry = JSON.parse(raw) as GeoJSON.Polygon;
      } catch {
        geometry = null;
      }
    } else if (raw && typeof raw === "object") {
      geometry = raw as GeoJSON.Polygon;
    }
    if (!geometry || geometry.type !== "Polygon") continue;
    out.push({
      shapeNo: Number(r.shape_no ?? 0),
      geometry,
      shapeKind: r.shape_kind === "poly" ? "poly" : "rect",
      vertices: r.vertices === null || r.vertices === undefined ? null : Number(r.vertices),
      needsReview: Boolean(r.needs_review),
      guided: Boolean(r.guided),
      tableItems:
        r.table_items === null || r.table_items === undefined ? null : Number(r.table_items),
      balloonItems: Number(r.balloon_items ?? 0),
      chartUrl: (r.chart_url as string | null) ?? null,
    });
  }
  return out;
}

const fetchDayCached = cachedByKey(fetchDayUncached, TTL);

/** 取指定日期的活動區形狀。10min TTL，toggle 不重抓 */
export function fetchPlaTracksDay(date: string, includeReview = false): Promise<PlaTrack[]> {
  return fetchDayCached(`${date}|${includeReview ? "all" : "ok"}`);
}

// ── 當日通報數值（popup 用）─────────────────────────────────

async function fetchDailyStatsUncached(): Promise<Map<string, PlaDailyStat>> {
  if (!supabaseConfigured) return new Map();
  // 沿用 migration 326 的區間 RPC，一次抓完整期間後在前端 index by date
  // （表僅 730 列、~60KB，另開 by-date RPC 不划算）
  const { data, error } = await withLoading(
    "pla-tracks:daily-stats",
    "共機通報數值",
    supabase.rpc("get_pla_activity_range", { p_days: 800 }),
  );
  const map = new Map<string, PlaDailyStat>();
  if (error) {
    console.warn("[PlaTracks] get_pla_activity_range failed:", error.message);
    return map;
  }
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const d = String(r.report_date);
    map.set(d, {
      reportDate: d,
      sorties: num(r.sorties),
      crossedMedian: num(r.crossed_median),
      planVessels: num(r.plan_vessels),
      officialShips: num(r.official_ships),
      chartUrl: (r.chart_url as string | null) ?? null,
    });
  }
  return map;
}

/** 通報數值 by date（popup 用）。一次抓齊後快取 */
export const fetchPlaDailyStats = cachedOnce(fetchDailyStatsUncached, TTL);

// ── GeoJSON ────────────────────────────────────────────────

export const PLA_KIND_COLORS: Record<PlaTrack["shapeKind"], string> = {
  rect: "#38bdf8", // 走廊
  poly: "#a855f7", // 不規則活動區
};

export const PLA_KIND_LABELS: Record<PlaTrack["shapeKind"], string> = {
  rect: "活動走廊 Corridor",
  poly: "活動區 Activity Area",
};

export function tracksToGeoJSON(
  tracks: PlaTrack[],
  date: string,
  stat?: PlaDailyStat,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: tracks.map((t) => ({
      type: "Feature" as const,
      geometry: t.geometry,
      properties: {
        report_date: date,
        shape_no: t.shapeNo,
        shape_kind: t.shapeKind,
        kind_label: PLA_KIND_LABELS[t.shapeKind],
        kind_color: PLA_KIND_COLORS[t.shapeKind],
        vertices: t.vertices,
        needs_review: t.needsReview ? 1 : 0,
        guided: t.guided ? 1 : 0,
        table_items: t.tableItems,
        balloon_items: t.balloonItems,
        chart_url: t.chartUrl,
        // 通報數值攤平進 properties，popup 不必再打一次 RPC
        sorties: stat?.sorties ?? null,
        crossed_median: stat?.crossedMedian ?? null,
        plan_vessels: stat?.planVessels ?? null,
        official_ships: stat?.officialShips ?? null,
      },
    })),
  };
}
