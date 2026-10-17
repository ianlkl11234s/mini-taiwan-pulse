import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import { cemsFacilityStatus, NUSC_GAMMA_HIGH_USVH } from "./environmentLayerTypes";

/**
 * 環境即時 4 層 loader（gis-platform migration 419–422；前端一律走 public RPC，禁直打 live.*／realtime.*）。
 *
 *   - get_nusc_gamma_latest(p_stale_minutes)            核安會環境輻射 63 站（15 分鐘）
 *   - get_water_effluent_latest(p_stale_hours, …, p_cno) 放流水連線自動監測（1 小時）
 *   - get_cems_stack_latest(p_stale_hours, …, p_cno)     固定污染源 CEMS 煙道（1 小時，上游延遲 4–5 小時）
 *   - get_cwa_uv_latest(p_stale_days)                    氣象署紫外線「前一天最大值」（每日）
 *
 * 四層都是「當下快照」：不接 timeStore、不做 timeline scrub（比照 erHospital／核安 LIVE）。
 * 座標 NULL 的列一律不畫（不合成座標），筆數記在狀態裡讓圖例揭露。
 * RPC 失敗：withLoading 會發 fail 事件（右上載入狀態條顯示失敗），狀態記 error，hook 清空 source，不畫舊資料或假資料。
 */

export type EnvLiveKey = "nuscGammaRadiation" | "waterEffluentLive" | "cemsStackLive" | "cwaUvDaily";

export interface EnvLiveStatus {
  state: "idle" | "loading" | "ok" | "error";
  /** 失敗原因（人類可讀），只在 state=error 時有值 */
  message?: string;
  /** 最近一次成功載入的瀏覽器時間（ms） */
  loadedAt?: number;
  /** 有畫上地圖的筆數 */
  drawn?: number;
  /** RPC 有回但座標 NULL 未畫的筆數 */
  noCoord?: number;
  /** 最新觀測時間（ISO），用來在圖例顯示資料時間 */
  latestObservedAt?: string | null;
}

// ── 狀態 store（圖例用 useSyncExternalStore 訂閱）────────────────────────
const statuses = new Map<EnvLiveKey, EnvLiveStatus>();
const listeners = new Set<() => void>();
const IDLE: EnvLiveStatus = { state: "idle" };

export function getEnvLiveStatus(key: EnvLiveKey): EnvLiveStatus {
  return statuses.get(key) ?? IDLE;
}
export function subscribeEnvLiveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function setStatus(key: EnvLiveKey, next: EnvLiveStatus) {
  statuses.set(key, next);
  for (const listener of listeners) listener();
}

type Row = Record<string, unknown>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point>;

function finite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function maxIso(rows: Row[], field: string): string | null {
  let best: string | null = null;
  for (const row of rows) {
    const v = row[field];
    if (typeof v === "string" && (best == null || v > best)) best = v;
  }
  return best;
}

async function rpcRows(loadingId: string, fn: string, label: string, args: Record<string, unknown>): Promise<Row[]> {
  const { data, error } = await withLoading(`env-live:${loadingId}`, label, supabase.rpc(fn, args));
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** 共用：rows → Point FC（座標 NULL 不畫），並更新狀態 store。 */
async function loadFC(
  key: EnvLiveKey,
  fetchRows: () => Promise<Row[]>,
  toProps: (row: Row) => Record<string, unknown>,
  observedField: string,
): Promise<PointFC> {
  const prev = getEnvLiveStatus(key);
  setStatus(key, { ...prev, state: "loading", message: undefined });
  try {
    const rows = await fetchRows();
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    let noCoord = 0;
    for (const row of rows) {
      const lon = finite(row.lon);
      const lat = finite(row.lat);
      if (lon == null || lat == null) { noCoord += 1; continue; }
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: toProps(row) });
    }
    setStatus(key, {
      state: "ok", loadedAt: Date.now(), drawn: features.length, noCoord,
      latestObservedAt: maxIso(rows, observedField),
    });
    return { type: "FeatureCollection", features };
  } catch (err) {
    // 對使用者只說人話（不印 RPC 名稱等內部識別碼）；技術細節由 hook 的 console.warn 留存。
    setStatus(key, { state: "error", message: "資料服務回應失敗，請稍後重新開啟圖層" });
    throw err;
  }
}

// ── 環境輻射（核安會）────────────────────────────────────────────────
const fetchGamma = cachedOnce(() => loadFC(
  "nuscGammaRadiation",
  () => rpcRows("nuscGammaRadiation", "get_nusc_gamma_latest", "環境輻射（核安會）即時值", { p_stale_minutes: 30 }),
  (row) => {
    const dose = finite(row.dose_usvh);
    return {
      station_id: row.station_id, station_name: row.station_name, dose_usvh: dose,
      observed_at: row.observed_at, is_stale: row.is_stale === true, updated_at: row.updated_at,
      is_high: dose != null && dose >= NUSC_GAMMA_HIGH_USVH,
    };
  },
  "observed_at",
), 60_000);

// ── 放流水連線監測 ─────────────────────────────────────────────────
/** 顏色優先序：資料逾時 > 有超限 > 有異常 > 正常（逾時的超限仍在 popup 顯示）。 */
export function waterEffluentStatus(row: { is_stale?: unknown; exceed_count?: unknown; abnormal_count?: unknown }): string {
  if (row.is_stale === true) return "stale";
  if ((finite(row.exceed_count) ?? 0) > 0) return "exceed";
  if ((finite(row.abnormal_count) ?? 0) > 0) return "abnormal";
  return "normal";
}

const fetchEffluent = cachedOnce(() => loadFC(
  "waterEffluentLive",
  () => rpcRows("waterEffluentLive", "get_water_effluent_latest", "放流水連線監測（環境部）", { p_stale_hours: 3, p_include_items: false }),
  (row) => ({
    cno: row.cno, facility_name: row.facility_name, county: row.county,
    observed_at: row.observed_at, is_stale: row.is_stale === true,
    item_count: finite(row.item_count), exceed_count: finite(row.exceed_count), abnormal_count: finite(row.abnormal_count),
    coord_source: row.coord_source, status: waterEffluentStatus(row),
  }),
  "observed_at",
), 60_000);

// ── CEMS 煙道 ───────────────────────────────────────────────────
/** 地圖要依 code2 首碼分運轉狀態，需要全部測項；算完設施層級狀態就把 items 丟掉，不進 feature properties。 */
function summarizeCemsItems(items: unknown): { leads: string[]; summary: string } {
  const counts = new Map<string, number>();
  if (Array.isArray(items)) {
    for (const item of items) {
      const code2 = typeof (item as Row)?.code2 === "string" ? ((item as Row).code2 as string) : "";
      const lead = code2.slice(0, 1);
      if (lead) counts.set(lead, (counts.get(lead) ?? 0) + 1);
    }
  }
  const leads = [...counts.keys()];
  const summary = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lead, n]) => `${lead}×${n}`).join("、");
  return { leads, summary };
}

const fetchCems = cachedOnce(() => loadFC(
  "cemsStackLive",
  () => rpcRows("cemsStackLive", "get_cems_stack_latest", "CEMS 煙道連續監測（環境部）", { p_stale_hours: 6, p_include_items: true }),
  (row) => {
    const exceed = finite(row.exceed_count) ?? 0;
    const { leads, summary } = summarizeCemsItems(row.items);
    return {
      cno: row.cno, facility_name: row.facility_name, county: row.county,
      sources: Array.isArray(row.sources) ? (row.sources as string[]).join("、") : "",
      observed_at: row.observed_at, is_stale: row.is_stale === true,
      item_count: finite(row.item_count), exceed_count: exceed,
      status: row.is_stale === true ? "stale" : cemsFacilityStatus(exceed, leads),
      code2_summary: summary, coord_source: row.coord_source,
    };
  },
  "observed_at",
), 60_000);

// ── 紫外線（前一天最大值）────────────────────────────────────────────
const fetchUv = cachedOnce(() => loadFC(
  "cwaUvDaily",
  () => rpcRows("cwaUvDaily", "get_cwa_uv_latest", "紫外線指數（前一天最大值）", { p_stale_days: 2 }),
  (row) => ({
    station_id: row.station_id, station_name: row.station_name, county: row.county,
    obs_date: row.obs_date, uv_index: finite(row.uv_index), uv_level: row.uv_level ?? null,
    is_stale: row.is_stale === true, collected_at: row.collected_at,
  }),
  "obs_date",
), 60_000);

const FETCHERS: Record<EnvLiveKey, ReturnType<typeof cachedOnce<PointFC>>> = {
  nuscGammaRadiation: fetchGamma,
  waterEffluentLive: fetchEffluent,
  cemsStackLive: fetchCems,
  cwaUvDaily: fetchUv,
};

export function fetchEnvLiveFC(key: EnvLiveKey): Promise<PointFC> {
  return FETCHERS[key]();
}
export function invalidateEnvLive(key: EnvLiveKey): void {
  FETCHERS[key].invalidate();
}

// ── popup 明細（點開時用 p_cno 拉該設施全部測項）──────────────────────────
export interface EffluentItem {
  outlet_no: string | null; item: string | null; value: number | null; unit: string | null;
  status: string | null; is_exceed: boolean | null; std1: number | null; std2: number | null;
  std_note: string | null; observed_at: string | null;
}
export interface CemsItem {
  source: string | null; point_no: string | null; item_code: string | null; item: string | null;
  value: number | null; unit: string | null; std_value: number | null; std_law: string | null;
  code2: string | null; code2_desc: string | null; is_exceed: boolean | null; observed_at: string | null;
}

export async function fetchWaterEffluentItems(cno: string): Promise<EffluentItem[]> {
  const rows = await rpcRows(`waterEffluentLive:${cno}`, "get_water_effluent_latest", `放流水測項明細 ${cno}`, { p_stale_hours: 3, p_cno: cno, p_include_items: true });
  return (Array.isArray(rows[0]?.items) ? rows[0]!.items : []) as EffluentItem[];
}

export async function fetchCemsItems(cno: string): Promise<CemsItem[]> {
  const rows = await rpcRows(`cemsStackLive:${cno}`, "get_cems_stack_latest", `CEMS 測項明細 ${cno}`, { p_stale_hours: 6, p_cno: cno, p_include_items: true });
  return (Array.isArray(rows[0]?.items) ? rows[0]!.items : []) as CemsItem[];
}
