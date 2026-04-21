import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 水庫完整上下文 RPC 包裝
 *
 * 後端：gis-platform migration 052
 *   public.get_reservoir_context(p_compare_id INTEGER) RETURNS JSONB
 *
 * 回傳結構（任一 key 皆可能為 null）：
 *   reservoir      水庫基本屬性 + 容量 + 淤積
 *   latest_status  最新一筆水情（蓄水率 / 警示燈號 / 進出水量 / 集水區雨量）
 *   watershed      集水區 polygon + 面積 + 管理單位
 *   basin          水庫所在流域
 *   nearest_river  最近河川線（<= 5 km）
 *
 * 前端用途：點擊水庫 → 一次 RPC → 同時顯示 panel + 疊層
 */

export interface ReservoirInfo {
  compare_id: number;
  res_name: string | null;
  eng_name: string | null;
  county: string | null;
  status: string | null;
  org_mng: string | null;
  meta_basin: string | null;
  meta_river: string | null;
  lat: number | null;
  lng: number | null;
  dam_height_m: number | null;
  capacity_total_m3: number | null;
  capacity_effective_m3: number | null;
  basin_area_km2: number | null;
  dam_class: number | null;
  latest_measured_capacity_wan: number | null;
  latest_sediment_wan: number | null;
  latest_measured_at: string | null;
  silt_ratio_pct: number | null;
}

export interface ReservoirLatestStatus {
  snapshot_at: string | null;
  water_level_m: number | null;
  effective_storage_wan_m3: number | null;
  storage_ratio_pct: number | null;
  alert_level: string | null;
  inflow_cms: number | null;
  total_outflow_cms: number | null;
  basin_rainfall_mm: number | null;
}

export interface ReservoirWatershed {
  primary_name: string | null;
  full_name: string | null;
  class: string | null;
  state: string | null;
  unit: string | null;
  area_km2: number | null;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface ReservoirBasin {
  basin_no: string | null;
  basin_name: string | null;
  area_km2: number | null;
}

export interface ReservoirNearestRiver {
  river_name: string | null;
  river_type: string | null;
  river_code: string | null;
  dist_m: number | null;
  geojson: GeoJSON.LineString | GeoJSON.MultiLineString;
}

export interface ReservoirContext {
  reservoir: ReservoirInfo | null;
  latest_status: ReservoirLatestStatus | null;
  watershed: ReservoirWatershed | null;
  basin: ReservoirBasin | null;
  nearest_river: ReservoirNearestRiver | null;
}

const cache = new Map<number, ReservoirContext>();
const inflight = new Map<number, Promise<ReservoirContext>>();

export async function fetchReservoirContext(compareId: number): Promise<ReservoirContext> {
  const cached = cache.get(compareId);
  if (cached) return cached;

  const pending = inflight.get(compareId);
  if (pending) return pending;

  const task = (async () => {
    const { data, error } = await withLoading(
      `reservoir-context:${compareId}`,
      `水庫資料 ${compareId}`,
      supabase.rpc("get_reservoir_context", { p_compare_id: compareId }),
    );
    if (error) throw new Error(`get_reservoir_context(${compareId}): ${error.message}`);
    const ctx = (data ?? {}) as ReservoirContext;
    cache.set(compareId, ctx);
    return ctx;
  })();

  inflight.set(compareId, task);
  try {
    return await task;
  } finally {
    inflight.delete(compareId);
  }
}

/** 測試 / 除錯用：清空 cache 讓下次 fetch 重打 */
export function clearReservoirContextCache(): void {
  cache.clear();
}

// ─────────────────────────────────────────────────────────────
// 集水區內完整河網（migration 053 / public.get_reservoir_watershed_rivers）
// 配合 context 用：context.nearest_river 只回 KNN 最近 1 條（會踩 outlier
// MultiLineString 導致「全台都亮」），本 RPC 用 ST_Intersection 裁剪集水區
// polygon 內的所有河川線，避開 outlier 污染
// ─────────────────────────────────────────────────────────────

const riversCache = new Map<number, GeoJSON.FeatureCollection>();
const riversInflight = new Map<number, Promise<GeoJSON.FeatureCollection>>();

export async function fetchReservoirWatershedRivers(
  compareId: number,
): Promise<GeoJSON.FeatureCollection> {
  const cached = riversCache.get(compareId);
  if (cached) return cached;

  const pending = riversInflight.get(compareId);
  if (pending) return pending;

  const task = (async () => {
    const { data, error } = await withLoading(
      `reservoir-watershed-rivers:${compareId}`,
      `集水區河網 ${compareId}`,
      supabase.rpc("get_reservoir_watershed_rivers", { p_compare_id: compareId }),
    );
    if (error) {
      throw new Error(`get_reservoir_watershed_rivers(${compareId}): ${error.message}`);
    }
    const fc = (data as GeoJSON.FeatureCollection | null) ?? {
      type: "FeatureCollection",
      features: [],
    };
    riversCache.set(compareId, fc);
    return fc;
  })();

  riversInflight.set(compareId, task);
  try {
    return await task;
  } finally {
    riversInflight.delete(compareId);
  }
}
