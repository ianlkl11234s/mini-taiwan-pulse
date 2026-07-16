import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

/**
 * 北市圖即時座位 librarySeats loader（gis-platform migration 290/291）
 *
 * 兩支 public RPC（前端一律走 public，禁直打 realtime.*）：
 *   - get_tpml_seat_current()          → 固定 29 閱覽區即時座位快照
 *   - get_tpml_seat_24h(p_area_id)     → 單一閱覽區 24h ~90-144 點折線
 *
 * 資料 10 分鐘更新，只覆蓋 6 分館（總館/文山/士林/西湖/稻香/廣慈），
 * 非北市圖全體。29 區共用 6 分館座標 → 前端按 branch_name 聚合成 6 個分館 marker。
 *
 * ⭐ is_closed=true 必須顯示「休館中」，絕不能顯示成「0 空位」
 *    （閉館快照 free_count 無意義）。聚合時閉館區不計入 open_free/open_total。
 *
 * RPC 直接回 lat/lng（不需座標 join）。此層是「當下快照」（比照 er-hospital，
 * 不接 timeStore、不碰 currentTime）。
 */

export interface LibrarySeatCurrent {
  area_id: number;
  branch_name: string;    // 6 值：總館/文山/士林/西湖/稻香/廣慈
  floor_name: string;
  area_name: string;
  free_count: number;
  total_count: number;
  is_closed: boolean;
  observed_ts: number;    // bigint unix 秒
  lat: number;
  lng: number;
}

export interface LibrarySeat24hRow {
  observed_ts: number;    // bigint unix 秒
  free_count: number;
  total_count: number;
  is_closed: boolean;
}

/** 聚合 feature 內攜帶的各閱覽區明細（Mapbox properties 存 JSON 字串，panel 端 parse）。 */
export interface LibrarySeatArea {
  area_id: number;
  floor_name: string;
  area_name: string;
  free_count: number;
  total_count: number;
  is_closed: boolean;
}

// ── current 快照 ────────────────────────────────────────────────────────────
async function fetchCurrentUncached(): Promise<LibrarySeatCurrent[]> {
  const { data, error } = await withLoading(
    "librarySeats:current",
    "北市圖即時座位",
    supabase.rpc("get_tpml_seat_current"),
  );
  if (error) throw new Error(`get_tpml_seat_current: ${error.message}`);
  return (data ?? []) as LibrarySeatCurrent[];
}
const fetchCurrentCached = cachedOnce(fetchCurrentUncached, 5 * 60_000); // 資料 10min 更新 → 5min cache
export const fetchLibrarySeatsCurrent = (): Promise<LibrarySeatCurrent[]> => fetchCurrentCached();
export const invalidateLibrarySeatsCurrent = (): void => fetchCurrentCached.invalidate();

/** branch_name 聚合 → 6 個分館 Point feature（circle 層用 GeoJSON FeatureCollection）。 */
export async function fetchLibrarySeatsFC(): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const rows = await fetchLibrarySeatsCurrent();
  const byBranch = new Map<string, LibrarySeatCurrent[]>();
  for (const r of rows) {
    const arr = byBranch.get(r.branch_name);
    if (arr) arr.push(r);
    else byBranch.set(r.branch_name, [r]);
  }

  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const [branch, areas] of byBranch) {
    const first = areas[0]!;
    let openFree = 0;
    let openTotal = 0;
    let closedCount = 0;
    let maxTs = 0;
    const detail: LibrarySeatArea[] = [];
    for (const a of areas) {
      if (a.is_closed) {
        closedCount++;
      } else {
        openFree += a.free_count;
        openTotal += a.total_count;
      }
      if (a.observed_ts > maxTs) maxTs = a.observed_ts;
      detail.push({
        area_id: a.area_id,
        floor_name: a.floor_name,
        area_name: a.area_name,
        free_count: a.free_count,
        total_count: a.total_count,
        is_closed: a.is_closed,
      });
    }
    const allClosed = closedCount === areas.length;
    // 全閉館 → -1（paint 先判 all_closed，不會用到 ratio）；否則空位率（0=滿 / 1=全空）
    const freeRatio = allClosed ? -1 : openTotal > 0 ? openFree / openTotal : 0;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [first.lng, first.lat] },
      properties: {
        branch_name: branch,
        open_free: openFree,
        open_total: openTotal,
        area_count: areas.length,
        closed_count: closedCount,
        all_closed: allClosed ? 1 : 0,   // Mapbox paint 讀 number 慣例
        free_ratio: freeRatio,
        observed_ts: maxTs,
        areas: JSON.stringify(detail),   // nested → JSON 字串，panel 端 JSON.parse
      },
    });
  }
  return { type: "FeatureCollection", features };
}

// ── 單一閱覽區 24h 折線 ──────────────────────────────────────────────────────
export async function fetchLibrarySeats24h(areaId: number): Promise<LibrarySeat24hRow[]> {
  const { data, error } = await withLoading(
    `librarySeats:24h:${areaId}`,
    `北市圖座位 24h · ${areaId}`,
    supabase.rpc("get_tpml_seat_24h", { p_area_id: areaId }),
  );
  if (error) throw new Error(`get_tpml_seat_24h: ${error.message}`);
  return (data ?? []) as LibrarySeat24hRow[];
}
