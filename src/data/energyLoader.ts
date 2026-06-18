import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * Energy MVP loader（layer 1-6 + KPI HUD）
 * - 來源：gis-platform Supabase migrations 212~216
 * - RPC：
 *   - get_power_dashboard()             — layer 2 HUD + layer 3 bars
 *   - get_power_plants_with_output()    — layer 1 POI + layer 4 beam
 *   - get_osm_substations()             — layer 5
 *   - get_ev_charging_stations()        — layer 6
 *   - get_lightning_recent() / get_nuclear_radiation_status() — 第四波保留，本檔不接
 */

// ── KPI / region demand ────────────────────────────────────────

/** 燈號 indicator 4 階：G/Y/O/R（綠/黃/橘/紅）+ undefined → 灰 */
export type ReserveIndicator = "G" | "Y" | "O" | "R" | string;

export interface PowerStatus {
  observed_at: string;
  curr_load_mw: number | null;
  curr_util_rate: number | null;
  supply_capacity_mw: number | null;
  peak_load_mw: number | null;
  reserve_capacity_mw: number | null;
  reserve_rate_pct: number | null;
  reserve_indicator: ReserveIndicator | null;
  peak_hour_range: string | null;
  realtime_supply_capacity_mw: number | null;
}

export interface PowerRegion {
  region: string; // 北部 / 中部 / 南部 / 東部
  observed_at: string;
  generation_mw: number | null;
  consumption_mw: number | null;
}

export interface PowerDashboard {
  status: PowerStatus | null;
  regions: PowerRegion[];
}

/** RPC：三本柱燈號 + 4 區 demand 一次拉 */
async function fetchPowerDashboardUncached(): Promise<PowerDashboard> {
  const { data, error } = await withLoading(
    "energy:dashboard",
    "供電燈號 + 區域用電",
    supabase.rpc("get_power_dashboard"),
  );
  if (error) throw new Error(`get_power_dashboard: ${error.message}`);
  const obj = (data ?? {}) as Partial<PowerDashboard>;
  return {
    status: obj.status ?? null,
    regions: obj.regions ?? [],
  };
}

/** 5 分鐘 TTL（cron 每 10 min 寫入） */
const fetchPowerDashboardCached = cachedOnce(fetchPowerDashboardUncached, 5 * 60_000);
export const fetchPowerDashboard = (): Promise<PowerDashboard> => fetchPowerDashboardCached();
/** 強制刷新（測試 / 手動 refresh） */
export const invalidatePowerDashboard = (): void => fetchPowerDashboardCached.invalidate();

// ── Plants + output ────────────────────────────────────────────

export interface PowerPlantRow {
  source_table: string;
  source_id: string | null;
  name: string;
  fuel_type: string | null;
  capacity_mw: number | null;
  output_mw: number | null;
  output_unit_count: number | null;
  output_load_rate: number | null; // 0~1.5
  output_observed_at: string | null;
  /** 'retired' = 已除役（核電廠 7 座），NULL = 運轉中 */
  status: string | null;
  status_note: string | null;
  lon: number;
  lat: number;
  attrs: Record<string, unknown> | null;
}

async function fetchPowerPlantsUncached(): Promise<PowerPlantRow[]> {
  const { data, error } = await withLoading(
    "energy:plants",
    "電廠 10,665 設施",
    supabase.rpc("get_power_plants_with_output"),
  );
  if (error) throw new Error(`get_power_plants_with_output: ${error.message}`);
  return (data ?? []) as PowerPlantRow[];
}
const fetchPowerPlantsCached = cachedOnce(fetchPowerPlantsUncached, 5 * 60_000);
export const fetchPowerPlants = (): Promise<PowerPlantRow[]> => fetchPowerPlantsCached();
export const invalidatePowerPlants = (): void => fetchPowerPlantsCached.invalidate();

// ── Plants at timestamp（217 RPC，timeline 跟隨用）────────────

/** 任意時間點電廠出力快照（uncached 版本，內部使用） */
async function fetchPowerPlantsAtUncached(tsSec: number | null): Promise<PowerPlantRow[]> {
  const { data, error } = await withLoading(
    `energy:plants:${tsSec ?? "latest"}`,
    `電廠出力快照`,
    supabase.rpc("get_power_plants_at", { ts_unix: tsSec }),
  );
  if (error) throw new Error(`get_power_plants_at: ${error.message}`);
  return (data ?? []) as PowerPlantRow[];
}

// key = "latest" 或 snapped ts string；15min TTL × LRU 24 個 key
// （24h 拉滿 144 個 10min boundary，但通常只逛幾個段）
const fetchPowerPlantsAtCached = cachedByKey(
  (key: string) => {
    const ts = key === "latest" ? null : Number(key);
    return fetchPowerPlantsAtUncached(ts);
  },
  15 * 60_000,
  24,
);

/** Snap ts 到 10 min 邊界；若 ts 在 wall clock 5 min 內視為 latest（吃 NULL fast path） */
export function fetchPowerPlantsForTime(tsSec: number): Promise<PowerPlantRow[]> {
  const wallNow = Math.floor(Date.now() / 1000);
  const isRecent = Math.abs(tsSec - wallNow) < 300;
  const snapped = Math.floor(tsSec / 600) * 600;
  const key = isRecent ? "latest" : String(snapped);
  return fetchPowerPlantsAtCached(key);
}

// ── 24h history per plant（217 RPC，popup sparkline 用）──────

export interface PlantOutputPoint {
  ts: number; // unix seconds
  output_mw: number | null;
  load_rate: number | null;
}

export async function fetchPlantOutput24h(plantName: string): Promise<PlantOutputPoint[]> {
  const { data, error } = await withLoading(
    `energy:plant24h:${plantName}`,
    `${plantName} 24h 出力`,
    supabase.rpc("get_power_plant_output_24h", { plant_name: plantName }),
  );
  if (error) throw new Error(`get_power_plant_output_24h: ${error.message}`);
  return (data ?? []) as PlantOutputPoint[];
}

// ── Substations / EV ───────────────────────────────────────────

export interface OsmSubstation {
  osm_id: number;
  name: string | null;
  operator: string | null;
  voltage: string | null;
  substation_type: string | null;
  lon: number;
  lat: number;
}

export interface EvChargingStation {
  station_id: string;
  name: string | null;
  operator_name: string | null;
  address: string | null;
  charging_points: number | null;
  spaces: number | null;
  source: string | null;
  lon: number;
  lat: number;
}

async function fetchOsmSubstationsUncached(): Promise<OsmSubstation[]> {
  const { data, error } = await withLoading(
    "energy:substations",
    "變電所 785",
    supabase.rpc("get_osm_substations"),
  );
  if (error) throw new Error(`get_osm_substations: ${error.message}`);
  return (data ?? []) as OsmSubstation[];
}
const fetchOsmSubstationsCached = cachedOnce(fetchOsmSubstationsUncached, 60 * 60_000);
export const fetchOsmSubstations = (): Promise<OsmSubstation[]> => fetchOsmSubstationsCached();

async function fetchEvChargingUncached(): Promise<EvChargingStation[]> {
  const { data, error } = await withLoading(
    "energy:ev",
    "充電站 3,060",
    supabase.rpc("get_ev_charging_stations"),
  );
  if (error) throw new Error(`get_ev_charging_stations: ${error.message}`);
  return (data ?? []) as EvChargingStation[];
}
const fetchEvChargingCached = cachedOnce(fetchEvChargingUncached, 60 * 60_000);
export const fetchEvCharging = (): Promise<EvChargingStation[]> => fetchEvChargingCached();

// ── 顏色與分級常數 ──────────────────────────────────────────────

/**
 * fuel_type 分色（涵蓋 all_power_plants_v 實際出現的值 + 變體）。
 * 未知值走 fallback (#9ca3af 灰)。
 */
export const FUEL_COLORS: Record<string, string> = {
  // 核能
  nuclear: "#facc15",
  核能: "#facc15",
  // 燃煤 / 油
  coal: "#374151",
  煤: "#374151",
  "煤/輕柴油": "#4b5563",
  oil: "#1f2937",
  重油: "#1f2937",
  // 燃氣
  natural_gas: "#94a3b8",
  天然氣: "#94a3b8",
  "天然氣/煤": "#64748b",
  燃氣: "#94a3b8",
  // 水力
  hydro: "#3b82f6",
  水: "#3b82f6",
  // 太陽光電
  solar: "#22c55e",
  // 風力
  wind: "#06b6d4",
  offshore_wind: "#0e7490",
  // 地熱
  geothermal: "#ef4444",
  // 生質
  biomass: "#a3a300",
  biogas: "#a3a300",
};
export const FUEL_FALLBACK_COLOR = "#9ca3af";

export function fuelColorOf(fuel: string | null | undefined): string {
  if (!fuel) return FUEL_FALLBACK_COLOR;
  return FUEL_COLORS[fuel] ?? FUEL_FALLBACK_COLOR;
}

/**
 * 容量分大小（quantile 實測：p50=13 / p80=44 / p95=88 / p99=120 MW）
 * 4 階半徑：迷你 / 小 / 中 / 大；NULL → 點。
 */
export const CAPACITY_BREAKS = { tiny: 1, small: 13, medium: 88, large: 500 } as const;
export const CAPACITY_RADIUS = { null: 2, tiny: 3, small: 4.5, medium: 7, large: 11 } as const;

export function radiusForCapacity(mw: number | null | undefined): number {
  if (mw == null) return CAPACITY_RADIUS.null;
  if (mw < CAPACITY_BREAKS.small) return CAPACITY_RADIUS.tiny;
  if (mw < CAPACITY_BREAKS.medium) return CAPACITY_RADIUS.small;
  if (mw < CAPACITY_BREAKS.large) return CAPACITY_RADIUS.medium;
  return CAPACITY_RADIUS.large;
}

/** 燈號 indicator 4 階顏色（台電官方燈號定義） */
export const RESERVE_INDICATOR_COLORS: Record<string, string> = {
  G: "#22c55e", // 充裕（綠）
  Y: "#eab308", // 注意（黃）
  O: "#f97316", // 吃緊（橘）
  R: "#ef4444", // 緊澀（紅）
};
export const RESERVE_INDICATOR_LABELS: Record<string, string> = {
  G: "供電充裕",
  Y: "供電稍緊",
  O: "供電吃緊",
  R: "限電警戒",
};
export function reserveIndicatorColor(ind: string | null | undefined): string {
  if (!ind) return FUEL_FALLBACK_COLOR;
  return RESERVE_INDICATOR_COLORS[ind.toUpperCase()] ?? FUEL_FALLBACK_COLOR;
}

/** 4 區質心座標（layer 3 region bars 用） */
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  北部: [121.55, 25.05], // 台北
  中部: [120.65, 24.15], // 台中
  南部: [120.30, 22.95], // 高雄/台南中段
  東部: [121.55, 23.95], // 花蓮
};

/** Mapbox circle color expression 用：[fuel, color, fuel, color, ..., fallback] */
export function fuelColorExpression(): unknown[] {
  const cases: unknown[] = ["match", ["get", "fuel_type"]];
  for (const [key, color] of Object.entries(FUEL_COLORS)) {
    cases.push(key, color);
  }
  cases.push(FUEL_FALLBACK_COLOR);
  return cases;
}
