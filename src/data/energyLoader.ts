import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

/**
 * Energy MVP loader（layer 1-6 + KPI HUD）
 * - 來源：gis-platform Supabase migrations 212~216
 * - RPC：
 *   - get_power_dashboard()             — layer 2 HUD + layer 3 bars
 *   - get_ssot_power_plants_with_output() — layer 1 POI + layer 4 beam（Phase 8 SSOT）
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
  /** Phase 8 SSOT：energy.power_facilities.facility_id（取代多源 source_id） */
  facility_id?: string | null;
  name: string;
  fuel_type: string | null;
  capacity_mw: number | null;
  output_mw: number | null;
  output_unit_count: number | null;
  output_load_rate: number | null; // 0~1.5
  output_observed_at: string | null;
  /** 'retired' / 'mothballed' / 'cancelled' / 'shelved'，NULL = 運轉中 */
  status: string | null;
  status_note: string | null;
  lon: number;
  lat: number;
  attrs: Record<string, unknown> | null;
}

async function fetchPowerPlantsUncached(): Promise<PowerPlantRow[]> {
  const { data, error } = await withLoading(
    "energy:plants",
    "電廠（SSOT facilities_overview）",
    supabase.rpc("get_ssot_power_plants_with_output", { p_authoritative_only: true }),
  );
  if (error) throw new Error(`get_ssot_power_plants_with_output: ${error.message}`);
  return (data ?? []) as PowerPlantRow[];
}
const fetchPowerPlantsCached = cachedOnce(fetchPowerPlantsUncached, 5 * 60_000);
export const fetchPowerPlants = (): Promise<PowerPlantRow[]> => fetchPowerPlantsCached();
export const invalidatePowerPlants = (): void => fetchPowerPlantsCached.invalidate();

// ── 24h preload of all plants（219 RPC，3D beam 用）─────────
// 一次拉 14 廠 × 24h timeseries (~45 KB)，scrub 走 client binary search 零延遲

/** 單廠 24h 時序：每點是 [ts_unix, output_mw] tuple，按 ts 升序 */
export interface PlantSeries {
  plant_name: string;
  fuel_type: string | null;
  capacity_mw: number | null;
  lon: number;
  lat: number;
  points: [number, number][];
}

export interface PowerGenerationDay {
  plants: PlantSeries[];
  ts_range: { lo: number; hi: number };
}

async function fetchPowerGeneration24hUncached(): Promise<PowerGenerationDay> {
  const { data, error } = await withLoading(
    `energy:gen24h`,
    `機組 24h 出力預載`,
    supabase.rpc("get_power_generation_24h"),
  );
  if (error) throw new Error(`get_power_generation_24h: ${error.message}`);
  const obj = (data ?? {}) as Partial<PowerGenerationDay>;
  return {
    plants: obj.plants ?? [],
    ts_range: obj.ts_range ?? { lo: 0, hi: 0 },
  };
}

// 一次拉、cache 10 min（cron 寫入 10min 後資料才有新點）
const fetchPowerGeneration24hCached = cachedOnce(fetchPowerGeneration24hUncached, 10 * 60_000);
export const fetchPowerGeneration24h = (): Promise<PowerGenerationDay> => fetchPowerGeneration24hCached();
export const invalidatePowerGeneration24h = (): void => fetchPowerGeneration24hCached.invalidate();

/** Resolved snapshot at a specific ts，提供給 BeamScene */
export interface PowerGenerationRow {
  plant_name: string;
  fuel_type: string | null;
  capacity_mw: number | null;
  output_mw: number;
  output_load_rate: number | null;
  observed_at_ts: number;
  lon: number;
  lat: number;
}

/** 從預載資料 binary search 出 ts 對應的 14 廠快照（client side，零 round-trip） */
export function resolvePowerGenerationAt(
  day: PowerGenerationDay,
  tsSec: number,
): PowerGenerationRow[] {
  const out: PowerGenerationRow[] = [];
  for (const p of day.plants) {
    const pts = p.points;
    if (pts.length === 0) continue;
    // binary search 找 ts <= target 的最後一筆
    let lo = 0, hi = pts.length - 1, best = -1;
    if (pts[0]![0] > tsSec) continue; // ts 在資料窗口之前
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid]![0] <= tsSec) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (best < 0) continue;
    const [obsTs, mw] = pts[best]!;
    const cap = p.capacity_mw;
    const rate = cap && cap > 0 ? Math.max(0, Math.min(1.5, mw / cap)) : null;
    out.push({
      plant_name: p.plant_name,
      fuel_type: p.fuel_type,
      capacity_mw: cap,
      output_mw: mw,
      output_load_rate: rate,
      observed_at_ts: obsTs,
      lon: p.lon,
      lat: p.lat,
    });
  }
  return out;
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

// ── OSM 高壓電網（Energy v2 Phase C）──────────────────────────

/** OSM 高壓輸電線 2,305（migration 228） */
export interface OsmPowerLine {
  osm_id: number;
  line_type: string | null;  // "line" / "minor_line" / "cable"
  voltage: string | null;    // "161000" or "161000;69000"（雙迴路分號）
  circuits: string | null;
  operator: string | null;
  frequency: string | null;
  location: string | null;
  geom_json: GeoJSON.LineString;
}

/** OSM 高壓鐵塔 26,589（migration 228） */
export interface OsmPowerTower {
  osm_id: number;
  voltage: string | null;
  operator: string | null;
  material: string | null;
  design: string | null;
  ref: string | null;
  lon: number;
  lat: number;
}

async function fetchOsmPowerLinesUncached(): Promise<OsmPowerLine[]> {
  const { data, error } = await withLoading(
    "energy:powerLines",
    "高壓輸電線 2,305",
    supabase.rpc("get_osm_power_lines"),
  );
  if (error) throw new Error(`get_osm_power_lines: ${error.message}`);
  return (data ?? []) as OsmPowerLine[];
}
const fetchOsmPowerLinesCached = cachedOnce(fetchOsmPowerLinesUncached, 60 * 60_000);
export const fetchOsmPowerLines = (): Promise<OsmPowerLine[]> => fetchOsmPowerLinesCached();

async function fetchOsmPowerTowersUncached(): Promise<OsmPowerTower[]> {
  // 26.6k rows 超過 PostgREST max-rows=20000，RPC 回傳單筆 jsonb array 繞過
  const { data, error } = await withLoading(
    "energy:powerTowers",
    "高壓鐵塔 26,589",
    supabase.rpc("get_osm_power_towers"),
  );
  if (error) throw new Error(`get_osm_power_towers: ${error.message}`);
  return (data ?? []) as unknown as OsmPowerTower[];
}
const fetchOsmPowerTowersCached = cachedOnce(fetchOsmPowerTowersUncached, 60 * 60_000);
export const fetchOsmPowerTowers = (): Promise<OsmPowerTower[]> => fetchOsmPowerTowersCached();

/**
 * 解析 OSM voltage 欄位 → kV 陣列（升序）。
 * - "161000"           → [161]
 * - "161000;69000"     → [69, 161]   雙迴路分號
 * - "161000;161000"    → [161, 161]  雙迴路同電壓
 * - ""/null/非數字     → []
 */
export function parseVoltageKv(voltage: string | null | undefined): number[] {
  if (!voltage) return [];
  const out: number[] = [];
  for (const part of voltage.split(";")) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n / 1000));
  }
  return out.sort((a, b) => a - b);
}

/** 取 voltage 主色用的 tier：345 / 161 / 69 / 0(mixed) */
export function powerLineTierKv(voltage: string | null | undefined): 345 | 161 | 69 | 0 {
  const kvs = parseVoltageKv(voltage);
  if (kvs.length === 0) return 0;
  const max = kvs[kvs.length - 1]!;
  if (max >= 300) return 345;
  if (max >= 150) return 161;
  if (max >= 60) return 69;
  return 0;
}

/** 高壓電網色階（cyan 系，align openinframap 夜間配色） */
export const POWER_LINE_VOLTAGE_COLORS = {
  345: "#67e8f9",   // cyan-300 最亮主幹
  161: "#22d3ee",   // cyan-400 次幹
  69:  "#0ea5e9",   // sky-500 配電骨幹
  mixed: "#475569", // slate-600 unknown/mixed 低調
} as const;

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
  oil_gas: "#64748b", // SSOT 油氣混合（協和 / 興達 / 大林等）
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
  // 生質 / 焚化
  biomass: "#a3a300",
  biogas: "#a3a300",
  bioenergy: "#a3a300", // SSOT 統一標籤
  waste: "#84cc16",     // SSOT 焚化發電（黃綠）
  // 儲能
  storage: "#a855f7",   // SSOT 儲能（紫）
  other: "#9ca3af",
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
