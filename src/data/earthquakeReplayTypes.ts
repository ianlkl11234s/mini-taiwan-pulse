/**
 * earthquakeReplayTypes.ts — 地震回放（earthquakeReplay）型別 + CWA 震度色階單一資料源
 *
 * 四邊共用（開發規則 §4a 規則 2）：
 *   1. `src/map/earthquakeReplayLayerFactory.ts` 的 fill/circle color step 表達式
 *   2. `src/components/LegendPanel.tsx` 的 EarthquakeReplayLegend
 *   3. `src/components/featureInfo/hazardPanels.tsx` 的測站 / 鄉鎮 panel
 *   4. `src/components/EarthquakeReplayPanel.tsx` 的事件清單 badge
 *
 * 資料鏈：CWA/NCDR/中研院 → Supabase（gis-platform migration 321）。
 * 契約與踩雷見 `../taipei-gis-analytics/docs/handoff/earthquake-replay.md`。
 */

// ── CWA 震度色階（0–7 級，含 5弱/5強/6弱/6強）────────────────────────────
//
// `intensity_value` 數值化規則（上游已算好，前端只消費）：
//   5弱 = 5.0 / 5強 = 5.5 / 6弱 = 6.0 / 6強 = 6.5
// 色系依 CWA 慣例由「無感灰 → 綠 → 黃 → 橙 → 紅 → 紫」推進。

export interface IntensityBand {
  /** 該級的下界（intensity_value）；step 表達式依此展開，必須嚴格遞增 */
  value: number;
  /** CWA 標示（「5弱」而非「5.0」） */
  label: string;
  color: string;
}

export const CWA_INTENSITY_BANDS: IntensityBand[] = [
  { value: 0,   label: "0級",  color: "#9ca3af" },
  { value: 1,   label: "1級",  color: "#4ade80" },
  { value: 2,   label: "2級",  color: "#a3e635" },
  { value: 3,   label: "3級",  color: "#fde047" },
  { value: 4,   label: "4級",  color: "#fbbf24" },
  { value: 5,   label: "5弱",  color: "#f97316" },
  { value: 5.5, label: "5強",  color: "#ea580c" },
  { value: 6,   label: "6弱",  color: "#ef4444" },
  { value: 6.5, label: "6強",  color: "#b91c1c" },
  { value: 7,   label: "7級",  color: "#a855f7" },
];

/** intensity_value → 色碼（給 popup / legend；paint 端走 step 表達式，見 factory） */
export function intensityColor(v: number): string {
  let out = CWA_INTENSITY_BANDS[0]!.color;
  for (const band of CWA_INTENSITY_BANDS) {
    if (v >= band.value) out = band.color;
  }
  return out;
}

/** intensity_value → CWA 標示（5.0 → 「5弱」） */
export function intensityLabel(v: number): string {
  let out = CWA_INTENSITY_BANDS[0]!.label;
  for (const band of CWA_INTENSITY_BANDS) {
    if (v >= band.value) out = band.label;
  }
  return out;
}

// ── CWA 7 碼 town_code → PMTiles 8 碼 TOWNCODE ─────────────────────────
//
// `public/base_map/township_boundary.pmtiles`（source-layer `township_boundary`）
// 的 TOWNCODE = 「內政部 COUNTYCODE(5) + 鄉鎮序號(2) + '0'」，
// 而 CWA town_code 是 7 碼且六都與其他縣市格式不對稱：
//   六都（前 3 碼 630/640/650/660/670/680，COUNTYCODE 實為 63000 等）
//       6300400 → 630 + '00' + '04' + '0' = 63000040
//   其他縣市（COUNTYCODE 本身就是前 5 碼）
//       1000204 → 10002 + '04' + '0'       = 10002040
// 368/368 已逐筆比對驗證。

const SIX_MUNICIPALITY_PREFIXES = new Set(["630", "640", "650", "660", "670", "680"]);

export function townCodeToPmtilesCode(townCode: string): string {
  const c = String(townCode);
  if (SIX_MUNICIPALITY_PREFIXES.has(c.slice(0, 3))) {
    return `${c.slice(0, 3)}00${c.slice(3, 5)}0`;
  }
  return `${c.slice(0, 5)}${c.slice(5, 7)}0`;
}

// ── 回放物理常數 ────────────────────────────────────────────────────
/** S 波近似速度（km/s）：測站/網格的「震後抵達秒數」= 震央距 ÷ 此值 */
export const S_WAVE_KM_S = 3.5;
/** NCDR 等震度網格解析度（度）；cell 以格點為中心 ±half 展開 */
export const SHAKEMAP_CELL_DEG = 0.025;

/** 兩點球面距離（km），用於網格 cell → 震央距離（DB 未存） */
export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ── 資料型別 ────────────────────────────────────────────────────────

/**
 * `public.earthquake_replay_events()` RPC 一列。
 *
 * ⚠️ 契約：`has_x === true ⟺ x 對應的 key 非 null ⟺ 用該 key **等值查詢**必有列。
 * ±90s / ±5s 時間窗配對已全做在 DB 端，前端一律等值查，禁止自己算時間窗。
 * `event_id` 為 opaque string（格式不對稱，不要 parse）。
 */
export interface EarthquakeReplayEvent {
  event_id: string;
  occurred_at: string;
  magnitude: number;
  depth_km: number;
  epicenter_lat: number;
  epicenter_lng: number;
  location: string;
  station_count: number;
  has_town: boolean;
  town_origin_time: string | null;
  has_grid: boolean;
  grid_event_time: string | null;
  has_tensor: boolean;
  tensor_origin_utc: string | null;
}

export interface EqReplayStation {
  station_id: string;
  lat: number;
  lon: number;
  epicenter_distance_km: number;
  intensity_value: number;
  pga_int: number;
  /** 震後抵達秒數（= epicenter_distance_km / S_WAVE_KM_S），loader 端算好 */
  arrivalSec: number;
}

export interface EqReplayTown {
  town_code: string;
  town_name: string;
  county_name: string;
  intensity: string;
  intensity_value: number;
  /** PMTiles feature id（promoteId: TOWNCODE） */
  pmtilesCode: string;
}

export interface EqReplayGridCell {
  lon: number;
  lat: number;
  pga: number;
  intensity: number;
  /** 震後抵達秒數（cell 中心到震央距離 ÷ S 波速），loader 端算好 */
  arrivalSec: number;
}

export interface EqReplayTensor {
  strike1: number;
  dip1: number;
  rake1: number;
  strike2: number;
  dip2: number;
  rake2: number;
  mw: number | null;
  centroid_depth: number | null;
  beachball_url: string | null;
  solution_type: string;
}

/**
 * 分層回放：
 * - Tier A（has_town && has_grid）：五步完整回放（震央→測站→網格波前→鄉鎮定格→沙灘球）
 * - Tier B（其餘）：三步簡化（震央→測站→沙灘球）
 */
export type EqReplayTier = "A" | "B";

export function eventTier(ev: EarthquakeReplayEvent): EqReplayTier {
  return ev.has_town && ev.has_grid ? "A" : "B";
}

export interface EqReplayDetail {
  event: EarthquakeReplayEvent;
  tier: EqReplayTier;
  stations: EqReplayStation[];
  towns: EqReplayTown[];
  grid: EqReplayGridCell[];
  /** A 解優先、fallback R 解；無機制解為 null */
  tensor: EqReplayTensor | null;
  /** 測站 + 網格的最遠震央距（km），回放長度由此反推 */
  maxDistKm: number;
}
