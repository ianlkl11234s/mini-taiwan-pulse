import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import { classifyErCongestion } from "./erCongestionTypes";

/**
 * 急診壅塞 er_hospital loader（RPC 283）
 *
 * 四支 public RPC（前端一律走 public，禁直打 realtime.*）：
 *   - get_er_hospital_latest()          → 59 家急診即時量能快照
 *   - get_er_hospital_24h(p_hosp_id)    → 單一醫院 24h ~96 點折線（popup 用）
 *   - get_er_hospital_24h_all()         → 59 家 24h 打包（monitor 卡片網格用，實測 26ms）
 *   - get_er_wait_total_14d()           → 全台 14 天每小時等一般病床總數（RPC 320，實測 67ms，
 *     最多 336 rows；第一筆是 rolling window 邊界的部分小時，前端須捨棄首桶）
 *
 * 特殊點：RPC 不回座標。座標從 public/geo/medical_hospitals.geojson
 * 以 properties.facility_id === hosp_id join（實測 57/59 命中）。
 * 2 家未命中（聯醫仁愛 / 大甲光田）走 COORD_OVERRIDES（座標取自同一份
 * geojson 的對應院區，見常數註解）。名單會隨年度急診評定變動 → loader log 未命中數。
 *
 * 此層是「當下快照」（比照核安 LIVE 模式，不做 timeline scrub、不接 timeStore）。
 */

export interface ErHospitalLatest {
  hosp_id: string;
  hosp_name: string;
  area_no: string;
  area_name: string;
  level_name: string;
  inform: string | null;      // Y/N 旗標，語意未證實 → 僅 popup 顯示原文
  wait_see_cnt: number | null;
  wait_bed_cnt: number | null;
  wait_general_cnt: number | null;
  wait_icu_cnt: number | null;
  observed_ts: number;        // bigint unix 秒
}

export interface ErHospital24hRow {
  observed_ts: number;
  wait_see_cnt: number | null;
  wait_bed_cnt: number | null;
  wait_general_cnt: number | null;
  wait_icu_cnt: number | null;
}

/** [observed_ts 秒, wait_see, wait_bed, wait_general, wait_icu]，欄位順序同 ErHospital24hRow */
export type ErHospital24hPoint = [
  number, number | null, number | null, number | null, number | null,
];

export interface ErHospital24hAllRow {
  hosp_id: string;
  hosp_name: string;
  area_name: string;
  /** 時間升冪，每家約 84 點 */
  points: ErHospital24hPoint[];
}

export interface ErWaitTotal14dRow {
  bucket_ts: number;   // epoch 秒 UTC，升冪，每小時
  total_wait: number;  // 全台等一般病床總數
  hosp_cnt: number;    // 該小時有回報院數
}

/**
 * facility_id 未命中的 2 家 override 座標。
 * 座標取自 public/geo/medical_hospitals.geojson 內對應院區（同資料源，權威）：
 *   0101020017 聯醫仁愛 = 「臺北市立聯合醫院仁愛院區」→ [121.545129, 25.037371]
 *   1536030075 大甲光田 = 「光田綜合醫院大甲院區」  → [120.616875, 24.346551]
 * 佐證日期：2026-07-10。
 */
const COORD_OVERRIDES: Record<string, [number, number]> = {
  "0101020017": [121.545129, 25.037371],
  "1536030075": [120.616875, 24.346551],
};

// ── 座標對照表（medical_hospitals.geojson facility_id → [lng,lat]）─────────────
const GEOJSON_URL = `${import.meta.env.BASE_URL ?? "/"}geo/medical_hospitals.geojson`;

async function loadCoordMapUncached(): Promise<Map<string, [number, number]>> {
  const map = new Map<string, [number, number]>();
  try {
    const resp = await fetch(GEOJSON_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const fc = (await resp.json()) as GeoJSON.FeatureCollection<GeoJSON.Point>;
    for (const f of fc.features ?? []) {
      const fid = (f.properties?.facility_id as string | undefined) ?? "";
      const coords = f.geometry?.coordinates;
      if (fid && Array.isArray(coords) && coords.length >= 2) {
        map.set(fid, [coords[0]!, coords[1]!]);
      }
    }
  } catch (e) {
    console.warn("[erHospital] 座標 geojson 載入失敗:", e);
  }
  return map;
}
const loadCoordMap = cachedOnce(loadCoordMapUncached, 60 * 60_000); // 靜態，1h

// ── latest 快照 ────────────────────────────────────────────────────────────
async function fetchLatestUncached(): Promise<ErHospitalLatest[]> {
  const { data, error } = await withLoading(
    "er:latest",
    "急診壅塞 59 院即時量能",
    supabase.rpc("get_er_hospital_latest"),
  );
  if (error) throw new Error(`get_er_hospital_latest: ${error.message}`);
  return (data ?? []) as ErHospitalLatest[];
}
const fetchLatestCached = cachedOnce(fetchLatestUncached, 60_000); // 快照 60s cache
export const fetchErHospitalLatest = (): Promise<ErHospitalLatest[]> => fetchLatestCached();
export const invalidateErHospitalLatest = (): void => fetchLatestCached.invalidate();

/** 座標 join → circle 層用 GeoJSON FeatureCollection */
export async function fetchErHospitalFC(): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
  const [rows, coords] = await Promise.all([fetchErHospitalLatest(), loadCoordMap()]);
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let missing = 0;
  for (const r of rows) {
    const xy = coords.get(r.hosp_id) ?? COORD_OVERRIDES[r.hosp_id];
    if (!xy) { missing++; continue; }
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [xy[0], xy[1]] },
      properties: {
        ...r,
        level: classifyErCongestion(r.wait_general_cnt),
        has_icu: (r.wait_icu_cnt ?? 0) > 0 ? 1 : 0,
      },
    });
  }
  if (missing > 0) {
    console.warn(`[erHospital] ${missing} 家醫院無座標（facility_id 未命中且無 override）— 名單隨年度評定變動，需補 COORD_OVERRIDES`);
  }
  return { type: "FeatureCollection", features };
}

// ── 單一醫院 24h 折線 ───────────────────────────────────────────────────────
export async function fetchErHospital24h(hospId: string): Promise<ErHospital24hRow[]> {
  if (!hospId) return [];
  const { data, error } = await withLoading(
    `er:24h:${hospId}`,
    `急診 24h · ${hospId}`,
    supabase.rpc("get_er_hospital_24h", { p_hosp_id: hospId }),
  );
  if (error) throw new Error(`get_er_hospital_24h: ${error.message}`);
  return (data ?? []) as ErHospital24hRow[];
}

// ── 全院 24h 打包（monitor ERCard 網格）───────────────────────────────────────
async function fetch24hAllUncached(): Promise<ErHospital24hAllRow[]> {
  const { data, error } = await withLoading(
    "er:24h:all",
    "急診 59 院 24h 趨勢",
    supabase.rpc("get_er_hospital_24h_all"),
  );
  if (error) throw new Error(`get_er_hospital_24h_all: ${error.message}`);
  return (data ?? []) as ErHospital24hAllRow[];
}
const fetch24hAllCached = cachedOnce(fetch24hAllUncached, 60_000);
export const fetchErHospital24hAll = (): Promise<ErHospital24hAllRow[]> => fetch24hAllCached();

// ── 全台 14 天等床趨勢（monitor ERCard 卡片內趨勢圖，RPC 320）───────────────────
async function fetchWaitTotal14dUncached(): Promise<ErWaitTotal14dRow[]> {
  const { data, error } = await withLoading(
    "er:wait-total-14d",
    "急診全台 14 天等床趨勢",
    supabase.rpc("get_er_wait_total_14d"),
  );
  if (error) throw new Error(`get_er_wait_total_14d: ${error.message}`);
  return (data ?? []) as ErWaitTotal14dRow[];
}
const fetchWaitTotal14dCached = cachedOnce(fetchWaitTotal14dUncached, 30 * 60_000); // 每小時才變，快取 30min
export const fetchErWaitTotal14d = (): Promise<ErWaitTotal14dRow[]> => fetchWaitTotal14dCached();
