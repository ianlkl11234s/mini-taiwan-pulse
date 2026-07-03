import { supabase } from "../lib/supabase";
import { staticRpc } from "./staticRpc";
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

// ── 24h preload of all plants（238 SSOT RPC，3D beam 用）──────
// 一次拉 ~23 廠（14 台電 + 6 離岸風場 + 3 離島）× 24h timeseries，scrub 走 client binary search

/** 單廠 24h 時序：每點是 [ts_unix, output_mw] tuple，按 ts 升序 */
export interface PlantSeries {
  facility_id?: string;
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
    supabase.rpc("get_ssot_facility_output_24h"),
  );
  if (error) throw new Error(`get_ssot_facility_output_24h: ${error.message}`);
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
  facility_id?: string;
  plant_name: string;
  fuel_type: string | null;
  capacity_mw: number | null;
  output_mw: number;
  output_load_rate: number | null;
  observed_at_ts: number;
  lon: number;
  lat: number;
}

/** 從預載資料 binary search 出 ts 對應的廠快照（client side，零 round-trip） */
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
      facility_id: p.facility_id,
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

// ── Phase 8 SSOT 6-layer 重構 ────────────────────────────────
// 取代既有單一 powerPlants layer：L1 運轉中 / L2 離岸 polygon / L3 規劃 / L4 歷史 / L5 次要 / L6 OSM 補充

export interface FacilityPoint {
  facility_id: string;
  name: string;
  name_zh: string | null;
  fuel_type: string | null;
  total_capacity_mw: number | null;
  status: string | null;
  is_offshore: boolean | null;
  county: string | null;
  owner: string | null;
  source_priority: number | null;
  lng: number;
  lat: number;
  size_tier?: string | null;
  /** 是否有台電即時出力資料對應（L1 用：14 大型廠 / 廠級匯總，作為視覺大小區分） */
  has_realtime?: boolean;
}
export interface FacilityZone {
  facility_id: string;
  name: string;
  name_zh: string | null;
  total_capacity_mw: number | null;
  status: string | null;
  owner: string | null;
  footprint_geojson: string; // GeoJSON.MultiPolygon 字串
}

/** L1 主要電廠（運轉中）209 — 火/核/水/大型風/大型光電
 *  順手 join realtime 標記 has_realtime（台電 14 廠 + 廠級匯總）→ 前端用作大小差異
 */
const _l1Cached = cachedOnce(async () => {
  const [primaryRes, rtRes] = await Promise.all([
    withLoading(
      "energy:facPrimary", "主要電廠 209",
      supabase.rpc("get_ssot_facilities_primary_operating"),
    ),
    supabase.rpc("get_ssot_realtime_facility_output"),
  ]);
  if (primaryRes.error) throw new Error(`get_ssot_facilities_primary_operating: ${primaryRes.error.message}`);
  const rows = (primaryRes.data ?? []) as FacilityPoint[];
  const rtIds = new Set<string>(
    ((rtRes.data ?? []) as { facility_id: string }[]).map((r) => r.facility_id),
  );
  for (const r of rows) r.has_realtime = rtIds.has(r.facility_id);
  return rows;
}, 60 * 60_000);
export const fetchFacPrimary = (): Promise<FacilityPoint[]> => _l1Cached();

/** L2 離岸風電場址 polygon 8 — 大彰化/Formosa/Hai Long footprint */
const _l2Cached = cachedOnce(async () => {
  const { data, error } = await withLoading(
    "energy:facOffshore", "離岸風電場址 8",
    staticRpc("get_ssot_facilities_offshore_zones"),
  );
  if (error) throw new Error(`get_ssot_facilities_offshore_zones: ${error.message}`);
  return (data ?? []) as FacilityZone[];
}, 60 * 60_000);
export const fetchFacOffshore = (): Promise<FacilityZone[]> => _l2Cached();

/** L3 規劃 / 未來電廠 35 (pre-construction + announced) */
const _l3Cached = cachedOnce(async () => {
  const { data, error } = await withLoading(
    "energy:facPlanned", "規劃電廠 35",
    staticRpc("get_ssot_facilities_planned"),
  );
  if (error) throw new Error(`get_ssot_facilities_planned: ${error.message}`);
  return (data ?? []) as FacilityPoint[];
}, 60 * 60_000);
export const fetchFacPlanned = (): Promise<FacilityPoint[]> => _l3Cached();

/** L4 歷史 — 退役 / 擱置 15 */
const _l4Cached = cachedOnce(async () => {
  const { data, error } = await withLoading(
    "energy:facHistorical", "歷史電廠 15",
    staticRpc("get_ssot_facilities_historical"),
  );
  if (error) throw new Error(`get_ssot_facilities_historical: ${error.message}`);
  return (data ?? []) as FacilityPoint[];
}, 60 * 60_000);
export const fetchFacHistorical = (): Promise<FacilityPoint[]> => _l4Cached();

/** L5 次要 341（焚化+地熱+小水力+中小光電/風電）*/
const _l5Cached = cachedOnce(async () => {
  const { data, error } = await withLoading(
    "energy:facSecondary", "次要電廠 341",
    staticRpc("get_ssot_facilities_secondary_small"),
  );
  if (error) throw new Error(`get_ssot_facilities_secondary_small: ${error.message}`);
  return (data ?? []) as FacilityPoint[];
}, 60 * 60_000);
export const fetchFacSecondary = (): Promise<FacilityPoint[]> => _l5Cached();

/** L6 OSM 補充 1,215（source_priority=5 無名單機） */
const _l6Cached = cachedOnce(async () => {
  const { data, error } = await withLoading(
    "energy:facOsmSupplement", "OSM 補充 1,215",
    staticRpc("get_ssot_facilities_osm_supplement"),
  );
  if (error) throw new Error(`get_ssot_facilities_osm_supplement: ${error.message}`);
  return (data ?? []) as FacilityPoint[];
}, 60 * 60_000);
export const fetchFacOsmSupplement = (): Promise<FacilityPoint[]> => _l6Cached();

/** Facilities 6-layer 共用 fuel → color（霓虹 / 賽博龐克調色）
 *  高飽和、深底發光、hue 之間拉開避免混淆。
 */
export const FACILITY_FUEL_COLORS: Record<string, string> = {
  coal:       "#F2622E",
  oil_gas:    "#F2D64B",
  nuclear:    "#d100ff",
  hydro:      "#3C92A6",
  solar:      "#F2E085",
  wind:       "#1F4373",
  bioenergy:  "#8C7C4A",
  geothermal: "#8C5D42",
  waste:      "#D9863D",
  storage:    "#F2EBC4",
  other:      "#94a3b8",
};
export function facilityFuelColor(fuel: string | null | undefined): string {
  if (!fuel) return "#9ca3af";
  return FACILITY_FUEL_COLORS[fuel] ?? "#9ca3af";
}

// ── Facility provenance（migration 236）─────────────────────
// Popup 點電廠時 lazy fetch 該廠的完整原始來源 metadata。

export interface FacilityProvenance {
  facility_id: string;
  name: string | null;
  name_zh: string | null;
  fuel_type: string | null;
  county: string | null;
  total_capacity_mw: number | null;
  status: string | null;
  source_priority: number | null;
  /** 中文層級標籤（即時 / 官方 / 台電 / GEM / OSM） */
  tier_label: string | null;
  source_code: string | null;
  source_platform: string | null;           // 例：data.gov.tw / Global Energy Monitor
  source_native_id: string | null;          // 上游原始 ID
  source_dataset_name: string | null;       // 中文資料集名（含資料表名）
  source_dataset_url: string | null;        // 資料集首頁
  source_download_url: string | null;       // 下載連結
  source_license: string | null;            // OGDL-1.0 / CC BY 4.0 / ODbL 1.0
  source_format: string | null;             // CSV / GeoJSON / API
  source_fetch_method: string | null;       // manual_download / api_pull / scrape
  source_refresh_cadence: string | null;    // annual / monthly / realtime
  source_last_refreshed: string | null;     // YYYY-MM-DD
  cross_refs: Record<string, unknown> | null;
  notes: string | null;
  last_updated_at: string | null;           // SSOT 庫上 row 最後 update
  agent_intervention_count: number;         // Agent 校正次數
}

const _provenanceCache = new Map<string, Promise<FacilityProvenance | null>>();
async function _fetchProvenance(facility_id: string): Promise<FacilityProvenance | null> {
  const { data, error } = await supabase.rpc("get_ssot_facility_provenance", {
    p_facility_id: facility_id,
  });
  if (error) throw new Error(`get_ssot_facility_provenance: ${error.message}`);
  return (data ?? null) as FacilityProvenance | null;
}
export function fetchFacilityProvenance(facility_id: string): Promise<FacilityProvenance | null> {
  const cached = _provenanceCache.get(facility_id);
  if (cached) return cached;
  const p = _fetchProvenance(facility_id);
  _provenanceCache.set(facility_id, p);
  return p;
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

// ── Facility units drill-down（239 RPC）─────────────────────────

export interface FacilityUnit {
  unit_id: string;
  unit_name: string;
  unit_seq: number | null;
  capacity_mw: number | null;
  taipower_unit_code: string | null;
  net_gen_mw: number | null;
  util_rate: number | null;
  observed_at: string | null;
}

export async function fetchFacilityUnits(facilityId: string): Promise<FacilityUnit[]> {
  const { data, error } = await supabase
    .rpc("get_ssot_facility_units", { p_facility_id: facilityId });
  if (error) throw new Error(`get_ssot_facility_units: ${error.message}`);
  return (data ?? []) as FacilityUnit[];
}

// ── Substations / EV ───────────────────────────────────────────

/** 變電所電網層級分類（migration 235） */
export type SubstationClass =
  | "EHV_SWITCH"  // 超高壓開閉所（345 kV 切換）
  | "EHV"         // 超高壓變電所 E/S（345→161 kV）
  | "PS"          // 一次變電所 P/S（161→69 kV）
  | "DPS"         // 一次配電變電所 D/S（161→22.8 kV）
  | "SS"          // 二次變電所 S/S（69→22.8 kV）
  | "TRACTION"    // 鐵路牽引變電所
  | "OTHER";      // 未分類

/** class → 顏色 + 預設半徑（zoom 11 基準）
 *  色票位移：EHV 改白色突顯、PS/SS 各取代原 EHV/PS 色 */
export const SUBSTATION_CLASS_COLORS: Record<SubstationClass, string> = {
  EHV_SWITCH: "#ef4444", // 紅 — 超高壓開閉節點（最頂層 5 個，白邊框）
  EHV:        "#ffffff", // 白 — 345 kV 超高壓變電所（最醒目）
  PS:         "#f97316", // 橙 — 161 kV 一次變電所
  DPS:        "#14b8a6", // 青綠 — 一次配電
  SS:         "#facc15", // 黃 — 69 kV 二次變電所
  TRACTION:   "#3b82f6", // 藍 — 鐵路牽引
  OTHER:      "#6b7280", // 淡灰 — 未分類
};
export const SUBSTATION_CLASS_LABELS: Record<SubstationClass, string> = {
  EHV_SWITCH: "超高壓開閉所",
  EHV:        "超高壓變電所 E/S",
  PS:         "一次變電所 P/S",
  DPS:        "一次配電變電所 D/S",
  SS:         "二次變電所 S/S",
  TRACTION:   "鐵路牽引變電所",
  OTHER:      "未分類",
};

export interface OsmSubstation {
  osm_id: number;
  name: string | null;
  operator: string | null;
  voltage: string | null;
  substation_type: string | null;
  class: SubstationClass | null;
  class_label: string | null;
  class_rank: number | null;
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
    staticRpc("get_osm_substations"),
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
    staticRpc("get_osm_power_lines"),
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
    staticRpc("get_osm_power_towers"),
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

/** 高壓電網色階（用戶指定色票） */
export const POWER_LINE_VOLTAGE_COLORS = {
  345: "#1AB6D9",   // 青藍 — 345 kV 最高壓主幹
  161: "#62D9AD",   // 薄荷綠 — 161 kV 次幹
  69:  "#468BA6",   // 藍綠 — 69 kV 配電骨幹
  mixed: "#DFE0DC", // 淡灰白 — 未標 / 混合
} as const;

// ── OSM 風光電 3 件套（Energy v2 Phase D.1） ─────────────────

/** OSM 風機 812（migration 229） */
export interface OsmWindTurbine {
  osm_id: number;
  name: string | null;
  operator: string | null;
  manufacturer: string | null;
  model: string | null;
  height_m: number | null;
  rotor_diameter_m: number | null;
  capacity_mw: number | null;
  is_offshore: boolean | null;
  lon: number;
  lat: number;
}

/** OSM 光電廠 734（migration 229） */
export interface OsmSolarFarm {
  osm_id: number;
  name: string | null;
  operator: string | null;
  plant_source: string | null;
  plant_method: string | null;
  capacity_mw: number | null;
  modules: number | null;
  area_m2: number | null;
  lon: number;
  lat: number;
}

/** OSM 電廠 POI 513（migration 229，補 IPP/小型） */
export interface OsmPowerPlantStatic {
  osm_id: number;
  name: string | null;
  power: string | null;
  plant_source: string | null;
  plant_method: string | null;
  generator_source: string | null;
  operator: string | null;
  capacity_mw: number | null;
  lon: number;
  lat: number;
}

async function fetchOsmWindTurbinesUncached(): Promise<OsmWindTurbine[]> {
  const { data, error } = await withLoading(
    "energy:windTurbines",
    "風機 812",
    staticRpc("get_osm_wind_turbines"),
  );
  if (error) throw new Error(`get_osm_wind_turbines: ${error.message}`);
  return (data ?? []) as OsmWindTurbine[];
}
const fetchOsmWindTurbinesCached = cachedOnce(fetchOsmWindTurbinesUncached, 60 * 60_000);
export const fetchOsmWindTurbines = (): Promise<OsmWindTurbine[]> => fetchOsmWindTurbinesCached();

async function fetchOsmSolarFarmsUncached(): Promise<OsmSolarFarm[]> {
  const { data, error } = await withLoading(
    "energy:solarFarms",
    "光電廠 734",
    staticRpc("get_osm_solar_farms"),
  );
  if (error) throw new Error(`get_osm_solar_farms: ${error.message}`);
  return (data ?? []) as OsmSolarFarm[];
}
const fetchOsmSolarFarmsCached = cachedOnce(fetchOsmSolarFarmsUncached, 60 * 60_000);
export const fetchOsmSolarFarms = (): Promise<OsmSolarFarm[]> => fetchOsmSolarFarmsCached();

async function fetchOsmPowerPlantsStaticUncached(): Promise<OsmPowerPlantStatic[]> {
  const { data, error } = await withLoading(
    "energy:powerPlantsStatic",
    "OSM 電廠 513",
    staticRpc("get_osm_power_plants_static"),
  );
  if (error) throw new Error(`get_osm_power_plants_static: ${error.message}`);
  return (data ?? []) as OsmPowerPlantStatic[];
}
const fetchOsmPowerPlantsStaticCached = cachedOnce(fetchOsmPowerPlantsStaticUncached, 60 * 60_000);
export const fetchOsmPowerPlantsStatic = (): Promise<OsmPowerPlantStatic[]> => fetchOsmPowerPlantsStaticCached();

// ── 離岸風電 / 離島 / 化石 / 地熱 / 北市再生（Energy v2 Phase D.2 + D.3） ──

/** 離岸風電潛力場址 36（MultiPolygon，migration 230） */
export interface OffshoreWindZone {
  zone_code: string | null;
  zone_name: string | null;
  zone_type: string | null;
  phase: string | null;
  developer: string | null;
  capacity_mw: number | null;
  award_year: number | null;
  cod_year: number | null;
  depth_min_m: number | null;
  depth_max_m: number | null;
  distance_km: number | null;
  geom_json: GeoJSON.MultiPolygon;
}

/** 離島電網 14（migration 230） */
export interface IslandPowerFacility {
  island: string | null;
  facility_type: string | null;
  name: string | null;
  operator: string | null;
  fuel_type: string | null;
  capacity_mw: number | null;
  online_year: number | null;
  voltage_kv: number | null;
  address: string | null;
  source: string | null;
  lon: number;
  lat: number;
}

/** 化石燃料設施 9（migration 230） */
export interface FossilFuelFacility {
  facility_type: string | null;
  name: string | null;
  operator: string | null;
  content: string | null;
  capacity_tonnes: number | null;
  capacity_kl: number | null;
  daily_throughput_kbpd: number | null;
  address: string | null;
  online_year: number | null;
  status: string | null;
  lon: number;
  lat: number;
}

/** 地熱井 36（migration 230） */
export interface GeothermalWell {
  county_code: string | null;
  geothermal_area: string | null;
  report_name: string | null;
  figure_content: string | null;
  report_url: string | null;
  figure_url: string | null;
  lon: number;
  lat: number;
}

/** 北市再生能源設置許可 438（migration 230） */
export interface RenewablePermitTaipei {
  natural_key: string | null;
  category: string | null;
  installation_name: string | null;
  capacity_kw: number | null;
  district: string | null;
  address: string | null;
  installed_at: string | null;
  lon: number;
  lat: number;
}

async function fetchOffshoreWindZonesUncached(): Promise<OffshoreWindZone[]> {
  const { data, error } = await withLoading(
    "energy:offshoreWind",
    "離岸風電潛力場址 36",
    staticRpc("get_offshore_wind_zones"),
  );
  if (error) throw new Error(`get_offshore_wind_zones: ${error.message}`);
  return (data ?? []) as OffshoreWindZone[];
}
const fetchOffshoreWindZonesCached = cachedOnce(fetchOffshoreWindZonesUncached, 60 * 60_000);
export const fetchOffshoreWindZones = (): Promise<OffshoreWindZone[]> => fetchOffshoreWindZonesCached();

async function fetchIslandPowerGridUncached(): Promise<IslandPowerFacility[]> {
  const { data, error } = await withLoading(
    "energy:islandGrid",
    "離島電網 14",
    staticRpc("get_island_power_grid"),
  );
  if (error) throw new Error(`get_island_power_grid: ${error.message}`);
  return (data ?? []) as IslandPowerFacility[];
}
const fetchIslandPowerGridCached = cachedOnce(fetchIslandPowerGridUncached, 60 * 60_000);
export const fetchIslandPowerGrid = (): Promise<IslandPowerFacility[]> => fetchIslandPowerGridCached();

async function fetchFossilFuelInfraUncached(): Promise<FossilFuelFacility[]> {
  const { data, error } = await withLoading(
    "energy:fossilFuel",
    "化石燃料設施 9",
    staticRpc("get_fossil_fuel_infrastructure"),
  );
  if (error) throw new Error(`get_fossil_fuel_infrastructure: ${error.message}`);
  return (data ?? []) as FossilFuelFacility[];
}
const fetchFossilFuelInfraCached = cachedOnce(fetchFossilFuelInfraUncached, 60 * 60_000);
export const fetchFossilFuelInfra = (): Promise<FossilFuelFacility[]> => fetchFossilFuelInfraCached();

async function fetchGeothermalWellsUncached(): Promise<GeothermalWell[]> {
  const { data, error } = await withLoading(
    "energy:geothermal",
    "地熱井 36",
    staticRpc("get_geothermal_wells"),
  );
  if (error) throw new Error(`get_geothermal_wells: ${error.message}`);
  return (data ?? []) as GeothermalWell[];
}
const fetchGeothermalWellsCached = cachedOnce(fetchGeothermalWellsUncached, 60 * 60_000);
export const fetchGeothermalWells = (): Promise<GeothermalWell[]> => fetchGeothermalWellsCached();

async function fetchRenewablePermitsTaipeiUncached(): Promise<RenewablePermitTaipei[]> {
  const { data, error } = await withLoading(
    "energy:taipeiRE",
    "北市再生能源 438",
    staticRpc("get_renewable_permits_taipei"),
  );
  if (error) throw new Error(`get_renewable_permits_taipei: ${error.message}`);
  return (data ?? []) as RenewablePermitTaipei[];
}
const fetchRenewablePermitsTaipeiCached = cachedOnce(fetchRenewablePermitsTaipeiUncached, 60 * 60_000);
export const fetchRenewablePermitsTaipei = (): Promise<RenewablePermitTaipei[]> => fetchRenewablePermitsTaipeiCached();

/** 北市再生能源 category 6 色 */
export const TAIPEI_RE_CATEGORY_COLORS: Record<string, string> = {
  學校: "#fbbf24",       // amber
  國有房地: "#94a3b8",   // slate
  機關: "#a78bfa",       // violet
  焚化發電: "#ef4444",   // red
  沼氣發電: "#a3a300",   // olive
  水力發電: "#3b82f6",   // blue
};

/** 化石燃料 3 type 顏色 */
export const FOSSIL_FUEL_COLORS: Record<string, string> = {
  gas_power_plant: "#94a3b8", // 灰
  lng_terminal:    "#22d3ee", // cyan（LNG 冷物質感）
  oil_refinery:    "#F97316", // 橘色
};

async function fetchEvChargingUncached(): Promise<EvChargingStation[]> {
  const { data, error } = await withLoading(
    "energy:ev",
    "充電站 3,060",
    staticRpc("get_ev_charging_stations"),
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
  nuclear: "#d100ff",
  核能: "#d100ff",
  // 燃煤 / 油
  coal: "#F2622E",
  煤: "#F2622E",
  "煤/輕柴油": "#E07A4A",
  oil: "#A8502A",
  重油: "#A8502A",
  // 燃氣
  natural_gas: "#F2D64B",
  天然氣: "#F2D64B",
  "天然氣/煤": "#E8B83C",
  燃氣: "#F2D64B",
  oil_gas: "#F2D64B",
  // 水力
  hydro: "#3C92A6",
  水: "#3C92A6",
  // 太陽光電
  solar: "#F2E085",
  // 風力
  wind: "#1F4373",
  offshore_wind: "#2F5A99",
  // 地熱
  geothermal: "#8C5D42",
  // 生質 / 焚化
  biomass: "#8C7C4A",
  biogas: "#8C7C4A",
  bioenergy: "#8C7C4A",
  waste: "#D9863D",
  // 儲能
  storage: "#F2EBC4",
  other: "#94a3b8",
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
