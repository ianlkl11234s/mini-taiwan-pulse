import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey, cachedOnce } from "../lib/loaderCache";
import {
  JMA_QUAKE_LOOKBACK_DAYS, JMA_WARNING_INACTIVE_STATUS, JMA_WARNING_LEVELS,
  jmaVolcanoLevel, jmaWarningLevel, normalizeJmaIntensity, type JmaWarningLevel,
} from "./jmaTypes";
import {
  JMA_PHENOLOGY_LAYER_PHENOMENA, JMA_RAINY_REGION_PREFS, envWbgtLevel, jmaDaysBetween, jmaDiffClass,
  jmaHourBucketIso, jmaJstDateKey, jmaMinuteBucketIso, jmaMonthDay, jmaRainyPhase, jmaSignedDays,
  type JmaPhenologyLayerKey, type JmaRainyPhase,
} from "./jmaPointTypes";

/**
 * 日本氣象廳（JMA）點位／區域圖層 loader，跟 Pulse 時間軸走（RPC 契約 gis-platform docs/jma-time-rpcs.md）。
 *
 *   時間軸停在「現在」（|t − now| ≤ 60 秒）：
 *     - jma_amedas_current（10 分）、jma_warnings_current、jma_quake_latest（近 7 天）、jma_volcano_current
 *     - WBGT／季節類直接呼叫 RPC 不帶時刻（＝now／今天 JST）
 *   往回拉：
 *     - get_jma_amedas_at／get_env_jp_wbgt_at（整點桶）、get_jma_warnings_at／get_jma_quakes_at（10 分桶）
 *     - get_jma_phenology_asof／get_jma_snowcap_asof／get_jma_rainy_season_asof（JST 日桶）
 *   火山只有當下快照（沒有歷史 RPC），時間軸往回拉仍畫現況，圖例明講。
 *
 * 未涵蓋：t 早於 get_jma_time_coverage() 的 coverage_from、或晚於現在 → 不查、狀態記 uncovered；
 * RPC 在涵蓋期外回 0 列 → 同樣記 uncovered（地震／警報 0 列是「沒有」，不算）。
 * 缺值一律保留 null（不補 0）；座標 NULL 的列不畫，筆數記在狀態裡讓圖例揭露。
 * 查詢失敗：狀態記 error、hook 清空 source，不畫舊資料。
 */

export type JmaPointKey =
  | "jmaAmedas" | "jmaQuakes" | "jmaVolcanoes"
  | "jmaWbgt" | "jmaSnowcap" | "jmaAutumnLeaves" | "jmaSakura";
export type JmaTimedKey = JmaPointKey | "jmaWarnings" | "jmaRainySeason";
export type JmaLiveKey = JmaTimedKey | "jmaLightning";

export type JmaUncoveredReason = "before" | "future" | "no_rows";

export interface JmaLiveStatus {
  state: "idle" | "loading" | "ok" | "error" | "uncovered";
  message?: string;
  loadedAt?: number;
  /** 查詢回傳列數（對帳用） */
  rows?: number;
  /** 有畫上地圖的筆數（警報＝對到市町村界的區域數；梅雨＝地方數） */
  drawn?: number;
  /** 座標 NULL 未畫（警報＝對不到市町村界的區域數） */
  noCoord?: number;
  latestAt?: string | null;
  /** live＝時間軸在現在；history＝往回拉 */
  mode?: "live" | "history";
  /** 這次查詢的時刻（ISO；季節類為 JST 日期 YYYY-MM-DD） */
  asOf?: string;
  uncovered?: JmaUncoveredReason;
  /** 該圖層的涵蓋起點（ISO） */
  coverageFrom?: string | null;
  /** 地震：時間窗起點早於收集起點，窗內可能不全 */
  incomplete?: boolean;
}

const statuses = new Map<JmaLiveKey, JmaLiveStatus>();
const listeners = new Set<() => void>();
const IDLE: JmaLiveStatus = { state: "idle" };

export function getJmaLiveStatus(key: JmaLiveKey): JmaLiveStatus {
  return statuses.get(key) ?? IDLE;
}
export function subscribeJmaLiveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function setJmaLiveStatus(key: JmaLiveKey, next: JmaLiveStatus) {
  statuses.set(key, next);
  for (const listener of listeners) listener();
}

type Row = Record<string, unknown>;
type PointFC = GeoJSON.FeatureCollection<GeoJSON.Point>;

export function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function maxIso(rows: Row[], field: string): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const v = row[field];
    if (typeof v !== "string") continue;
    const ms = Date.parse(v);
    if (Number.isFinite(ms) && ms > bestMs) { bestMs = ms; best = v; }
  }
  return best;
}

interface PgError { code?: string; message?: string }

/** 使用者看得懂的錯誤訊息（不印表名）。 */
function humanError(err: PgError | null | undefined): string {
  if (err?.code === "PGRST205" || err?.code === "PGRST202" || err?.code === "42P01" || err?.code === "42883") {
    return "資料表尚未上線（上游建置中），圖層開著會自動重試";
  }
  return "資料服務回應失敗，請稍後重新開啟圖層";
}

export class JmaQueryError extends Error {
  readonly human: string;
  constructor(view: string, err: PgError) {
    super(`${view}: ${err.message ?? err.code ?? "unknown"}`);
    this.human = humanError(err);
  }
}

export function jmaHumanError(err: unknown): string {
  return err instanceof JmaQueryError ? err.human : humanError(null);
}

async function query(view: string, label: string, build: (q: ReturnType<typeof supabase.from>) => PromiseLike<{ data: unknown; error: PgError | null }>): Promise<Row[]> {
  const { data, error } = await withLoading(`jma-live:${view}`, label, build(supabase.from(view)));
  if (error) throw new JmaQueryError(view, error);
  return (Array.isArray(data) ? data : []) as Row[];
}

async function rpc(fn: string, args: Record<string, unknown>, label: string): Promise<Row[]> {
  const { data, error } = await withLoading(`jma-time:${fn}:${JSON.stringify(args)}`, label, supabase.rpc(fn, args));
  if (error) throw new JmaQueryError(fn, error as PgError);
  return (Array.isArray(data) ? data : []) as Row[];
}

/** rows → Point FC（座標 NULL 不畫，不合成座標）。 */
export function rowsToPointFC(rows: Row[], toProps: (row: Row) => Record<string, unknown>): { fc: PointFC; noCoord: number } {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  let noCoord = 0;
  for (const row of rows) {
    const lon = finiteOrNull(row.lon);
    const lat = finiteOrNull(row.lat);
    if (lon == null || lat == null) { noCoord += 1; continue; }
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: toProps(row) });
  }
  return { fc: { type: "FeatureCollection", features }, noCoord };
}

// ── 涵蓋範圍（get_jma_time_coverage）───────────────────────────────
export type JmaCoverageLayer = "lightning" | "amedas" | "wbgt" | "warnings" | "quake" | "phenology" | "snowcap" | "rainy_season";

export interface JmaCoverage {
  fromIso: string | null;
  toIso: string | null;
  lastRecordAt: string | null;
}

export function parseJmaCoverage(rows: Row[]): Map<string, JmaCoverage> {
  const map = new Map<string, JmaCoverage>();
  for (const r of rows) {
    if (typeof r.layer !== "string") continue;
    map.set(r.layer, {
      fromIso: typeof r.coverage_from === "string" ? r.coverage_from : null,
      toIso: typeof r.coverage_to === "string" ? r.coverage_to : null,
      lastRecordAt: typeof r.last_record_at === "string" ? r.last_record_at : null,
    });
  }
  return map;
}

/** coverage_to 會隨時間前進 → 5 分鐘 TTL。 */
export const fetchJmaTimeCoverage = cachedOnce(async () => {
  const rows = await rpc("get_jma_time_coverage", {}, "日本氣象圖層涵蓋範圍");
  return parseJmaCoverage(rows);
}, 5 * 60_000);

/** 時間軸在現在 ±60 秒內＝live（與 isHistoryMode 同門檻）。 */
export const JMA_LIVE_THRESHOLD_SEC = 60;

/**
 * t 在不在涵蓋期：早於 coverage_from → before；晚於現在 → future。
 * 不拿 coverage_to 擋：AMeDAS 的 coverage_to 是最新整點，30 分前的 t 也該查（RPC 會給上一個整點）。
 * coverage 取不到（RPC 失敗）時不擋，交給圖層 RPC 自己回 0 列。
 */
export function jmaCoverageGate(cov: JmaCoverage | undefined, tSec: number, nowSec: number): "ok" | "before" | "future" {
  if (tSec > nowSec + JMA_LIVE_THRESHOLD_SEC) return "future";
  const fromMs = cov?.fromIso ? Date.parse(cov.fromIso) : NaN;
  if (Number.isFinite(fromMs) && tSec * 1000 < fromMs) return "before";
  return "ok";
}

// ── 時間桶請求 ──────────────────────────────────────────────────────
export interface JmaTimeRequest {
  key: JmaTimedKey;
  /** 快取鍵（同一桶不重查）："live" 或 ISO／日期 */
  cacheKey: string;
  history: boolean;
  /** 給 RPC 的時刻參數（ISO）或日期（YYYY-MM-DD）；live 的即時 view 為 null */
  at: string | null;
  /** 涵蓋檢查用的圖層；null＝不檢查（火山快照、live） */
  coverageLayer: JmaCoverageLayer | null;
  /** RPC 回 0 列時視為「未涵蓋」（地震／警報 0 列是「沒有」，不算） */
  emptyIsUncovered: boolean;
}

const COVERAGE_LAYER: Record<JmaTimedKey, JmaCoverageLayer | null> = {
  jmaAmedas: "amedas",
  jmaWbgt: "wbgt",
  jmaWarnings: "warnings",
  jmaQuakes: "quake",
  jmaVolcanoes: null,
  jmaSnowcap: "snowcap",
  jmaAutumnLeaves: "phenology",
  jmaSakura: "phenology",
  jmaRainySeason: "rainy_season",
};

const SEASONAL: ReadonlySet<JmaTimedKey> = new Set(["jmaSnowcap", "jmaAutumnLeaves", "jmaSakura", "jmaRainySeason"]);

export function jmaTimeRequest(key: JmaTimedKey, tSec: number, nowSec: number = Date.now() / 1000): JmaTimeRequest {
  const history = Math.abs(nowSec - tSec) > JMA_LIVE_THRESHOLD_SEC;
  const coverageLayer = COVERAGE_LAYER[key];
  if (key === "jmaVolcanoes") {
    return { key, cacheKey: "live", history, at: null, coverageLayer: null, emptyIsUncovered: false };
  }
  if (SEASONAL.has(key)) {
    // 季節類：live 也用今天 JST 日期當鍵（跨日自動換桶）
    const date = jmaJstDateKey(history ? tSec : nowSec);
    return { key, cacheKey: date, history, at: date, coverageLayer: history ? coverageLayer : null, emptyIsUncovered: true };
  }
  if (!history) {
    return { key, cacheKey: "live", history, at: null, coverageLayer: null, emptyIsUncovered: key === "jmaWbgt" };
  }
  const at = key === "jmaWarnings" || key === "jmaQuakes" ? jmaMinuteBucketIso(tSec, 10) : jmaHourBucketIso(tSec);
  return { key, cacheKey: at, history, at, coverageLayer, emptyIsUncovered: key === "jmaAmedas" || key === "jmaWbgt" };
}

export interface JmaTimedResult<T> {
  value: T;
  status: Pick<JmaLiveStatus, "rows" | "drawn" | "noCoord" | "latestAt" | "incomplete">;
}

// ── AMeDAS ─────────────────────────────────────────────────────────
const AMEDAS_NUMERIC = [
  "alt_m", "temp", "precip10m", "precip1h", "precip3h", "precip24h", "wind", "wind_dir", "gust",
  "humidity", "pressure", "sun1h", "snow", "snow1h", "snow6h", "snow12h", "snow24h",
] as const;

export function amedasProps(row: Row): Record<string, unknown> {
  const props: Record<string, unknown> = {
    station_id: row.station_id ?? null,
    station_name: row.station_name ?? null,
    station_name_en: row.station_name_en ?? null,
    observed_at: row.observed_at ?? null,
    has_snow_gauge: row.has_snow_gauge === true,
  };
  for (const field of AMEDAS_NUMERIC) props[field] = finiteOrNull(row[field]);
  return props;
}

const amedasCache = cachedByKey<JmaTimedResult<PointFC>>(async (cacheKey) => {
  const rows = cacheKey === "live"
    ? await query("jma_amedas_current", "日本 AMeDAS 即時觀測", (q) => q.select("*").limit(3000))
    : await rpc("get_jma_amedas_at", { p_at: cacheKey }, "日本 AMeDAS 整點觀測");
  const { fc, noCoord } = rowsToPointFC(rows, amedasProps);
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "observed_at") } };
}, 60_000, 48);

// ── WBGT（環境省）──────────────────────────────────────────────────
export function wbgtProps(row: Row): Record<string, unknown> {
  const wbgt = finiteOrNull(row.wbgt);
  return {
    station_id: row.station_id ?? null,
    station_name: row.station_name ?? null,
    observed_at: row.observed_at ?? null,
    wbgt,
    level: envWbgtLevel(wbgt),
  };
}

const wbgtCache = cachedByKey<JmaTimedResult<PointFC>>(async (cacheKey) => {
  const rows = await rpc("get_env_jp_wbgt_at", cacheKey === "live" ? {} : { p_at: cacheKey }, "日本暑さ指数 WBGT");
  const { fc, noCoord } = rowsToPointFC(rows, wbgtProps);
  // 高值畫在上面
  fc.features.sort((a, b) => Number(a.properties?.wbgt ?? -99) - Number(b.properties?.wbgt ?? -99));
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "observed_at") } };
}, 60_000, 48);

// ── 地震 ───────────────────────────────────────────────────────────
export function quakeProps(row: Row): Record<string, unknown> {
  const intensity = normalizeJmaIntensity(row.max_intensity);
  return {
    json_id: row.json_id ?? null,
    event_id: row.event_id ?? null,
    report_time: row.report_time ?? null,
    origin_time: row.origin_time ?? null,
    title: row.title ?? null,
    hypocenter_name: row.hypocenter_name ?? null,
    depth_km: finiteOrNull(row.depth_km),
    magnitude: finiteOrNull(row.magnitude),
    max_intensity: intensity,
    max_intensity_raw: row.max_intensity ?? null,
    intensity_by_pref: row.intensity_by_pref == null ? null : JSON.stringify(row.intensity_by_pref),
  };
}

const quakeCache = cachedByKey<JmaTimedResult<PointFC>>(async (cacheKey) => {
  let rows: Row[];
  if (cacheKey === "live") {
    const since = new Date(Date.now() - JMA_QUAKE_LOOKBACK_DAYS * 86_400_000).toISOString();
    rows = await query("jma_quake_latest", `日本地震（近 ${JMA_QUAKE_LOOKBACK_DAYS} 天）`, (q) => q
      .select("*")
      .gte("report_time", since)
      .order("report_time", { ascending: false })
      .limit(1000));
  } else {
    rows = await rpc("get_jma_quakes_at", { p_at: cacheKey, p_window_days: JMA_QUAKE_LOOKBACK_DAYS }, `日本地震（${JMA_QUAKE_LOOKBACK_DAYS} 天窗）`);
  }
  const { fc, noCoord } = rowsToPointFC(rows, quakeProps);
  // 大震畫在上面：依規模升冪（null 最先）
  fc.features.sort((a, b) => (Number(a.properties?.magnitude ?? -1)) - (Number(b.properties?.magnitude ?? -1)));
  const incomplete = rows.some((r) => r.window_complete === false);
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "report_time"), incomplete } };
}, 60_000, 48);

// ── 火山（只有當下快照）──────────────────────────────────────────────
export function volcanoProps(row: Row): Record<string, unknown> {
  return {
    volcano_code: row.volcano_code ?? null,
    volcano_name: row.volcano_name ?? null,
    level_code: row.level_code ?? null,
    level_name: row.level_name ?? null,
    warning_kind: row.warning_kind ?? null,
    report_time: row.report_time ?? null,
    level: jmaVolcanoLevel(row.level_name, row.level_code),
  };
}

const volcanoCache = cachedByKey<JmaTimedResult<PointFC>>(async () => {
  const rows = await query("jma_volcano_current", "日本火山噴火警戒", (q) => q.select("volcano_code,volcano_name,lat,lon,level_code,level_name,warning_kind,report_time").limit(500));
  const { fc, noCoord } = rowsToPointFC(rows, volcanoProps);
  fc.features.sort((a, b) => String(a.properties?.level).localeCompare(String(b.properties?.level)));
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: maxIso(rows, "report_time") } };
}, 60_000, 2);

// ── 山頂初冠雪 ─────────────────────────────────────────────────────
/** 地圖標籤：已觀測「10/3 +2」；未觀測「(10/3)」＝括號內為平年日 */
export function seasonalLabel(state: unknown, obsDate: unknown, diff: number | null, normalDate: unknown): string {
  if (state === "observed") {
    const md = jmaMonthDay(typeof obsDate === "string" ? obsDate : null);
    const d = jmaSignedDays(diff);
    return d ? `${md} ${d}` : md;
  }
  const normal = jmaMonthDay(typeof normalDate === "string" ? normalDate : null);
  return normal ? `(${normal})` : "";
}

/** 未觀測但 as-of 已過平年日 → 已晚幾天（未過或無平年 → null） */
export function daysPastNormal(state: unknown, normalDate: unknown, asOf: string): number | null {
  if (state === "observed" || typeof normalDate !== "string" || !normalDate) return null;
  const d = jmaDaysBetween(normalDate.slice(0, 10), asOf);
  return d > 0 ? d : null;
}

export function snowcapProps(row: Row, asOf: string): Record<string, unknown> {
  const diff = finiteOrNull(row.days_vs_normal);
  const state = row.state ?? null;
  return {
    mountain_code: row.mountain_code ?? null,
    mountain_name: row.mountain_name ?? null,
    observatory: row.observatory ?? null,
    season_year: finiteOrNull(row.season_year),
    judgement_method: row.judgement_method ?? null,
    state,
    first_snowcap_date: row.first_snowcap_date ?? null,
    status_text: row.status_text ?? null,
    status_class: row.status_class ?? null,
    status_time: row.status_time ?? null,
    elevation_m: finiteOrNull(row.elevation_m),
    normal_date: row.normal_date ?? null,
    days_vs_normal: diff,
    diff_class: state === "observed" ? jmaDiffClass(diff) : null,
    days_past_normal: daysPastNormal(state, row.normal_date, asOf),
    as_of: asOf,
    label: seasonalLabel(state, row.first_snowcap_date, diff, row.normal_date),
  };
}

const snowcapCache = cachedByKey<JmaTimedResult<PointFC>>(async (date) => {
  const rows = await rpc("get_jma_snowcap_asof", { p_date: date }, "日本山頂初冠雪");
  const { fc, noCoord } = rowsToPointFC(rows, (r) => snowcapProps(r, date));
  // 已觀測畫在上面
  fc.features.sort((a, b) => Number(a.properties?.state === "observed") - Number(b.properties?.state === "observed"));
  return { value: fc, status: { rows: rows.length, drawn: fc.features.length, noCoord, latestAt: date } };
}, 30 * 60_000, 32);

// ── 物候（櫻花／紅葉・黃葉）───────────────────────────────────────────
export function phenologyProps(row: Row, asOf: string): Record<string, unknown> {
  const state = row.state ?? null;
  const diff = finiteOrNull(row.diff_normal_days);
  return {
    station_no: row.station_no ?? null,
    station_name: row.station_name ?? null,
    phenomenon_code: row.phenomenon_code == null ? null : String(row.phenomenon_code),
    phenomenon_name: row.phenomenon_name ?? null,
    season_year: finiteOrNull(row.season_year),
    state,
    obs_date: row.obs_date ?? null,
    diff_normal_days: diff,
    diff_last_year_days: finiteOrNull(row.diff_last_year_days),
    normal_date: row.normal_date ?? null,
    alt_species: row.alt_species ?? null,
    diff_class: state === "observed" ? jmaDiffClass(diff) : null,
    days_past_normal: daysPastNormal(state, row.normal_date, asOf),
    as_of: asOf,
    label: seasonalLabel(state, row.obs_date, diff, row.normal_date),
  };
}

/** 一天一次全部現象（322 列），兩個物候圖層共用，再各自濾現象碼。 */
const phenologyRowsCache = cachedByKey<Row[]>(
  (date) => rpc("get_jma_phenology_asof", { p_date: date }, "日本生物季節觀測"),
  30 * 60_000, 32,
);

export function buildPhenologyFC(rows: Row[], key: JmaPhenologyLayerKey, asOf: string): JmaTimedResult<PointFC> {
  const codes = new Set(JMA_PHENOLOGY_LAYER_PHENOMENA[key].map((p) => p.value));
  const mine = rows.filter((r) => codes.has(String(r.phenomenon_code)));
  const { fc, noCoord } = rowsToPointFC(mine, (r) => phenologyProps(r, asOf));
  fc.features.sort((a, b) => Number(a.properties?.state === "observed") - Number(b.properties?.state === "observed"));
  return { value: fc, status: { rows: mine.length, drawn: fc.features.length, noCoord, latestAt: asOf } };
}

// ── 警報・注意報 ────────────────────────────────────────────────────
export interface JmaWarningRow {
  control_datetime: string | null;
  report_datetime: string | null;
  office_name: string | null;
  area_code: string;
  area_name: string | null;
  area_level: string | null;
  kind_code: string | null;
  kind_name: string | null;
  status: string | null;
  level: JmaWarningLevel;
  active: boolean;
}

export interface JmaWarningArea {
  /** class20 前 5 碼（JIS 市区町村コード） */
  code5: string;
  areaName: string | null;
  level: JmaWarningLevel;
  rows: JmaWarningRow[];
}

export interface JmaWarningsSnapshot {
  rows: JmaWarningRow[];
  /** 發表中、可對到市町村界的區域（key＝5 碼） */
  areas: Map<string, JmaWarningArea>;
  /** 政令市「分區」（如 横浜市北部）沒有對應的區界 → 以「縣碼 2 碼＋市名」對整個市（key 例：14横浜市） */
  cityNameKeys: Map<string, JmaWarningArea>;
  /** 發表中但不是市町村層級（class10/15 等）或代碼格式不明的列 */
  unmatched: JmaWarningRow[];
  controlDatetime: string | null;
}

const LEVEL_RANK = new Map<string, number>(JMA_WARNING_LEVELS.map((l) => [l.value, l.rank]));

function text(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

/** 政令市分區（如「横浜市北部」「静岡市南部」）→ 回傳市名；一般市町村或區（神戸市中央区）→ null。 */
export function designatedCityName(areaName: string | null, code5: string): string | null {
  if (!areaName) return null;
  if (code5[2] !== "1" || code5[4] !== "0") return null;
  const base = areaName.replace(/(東部|西部|南部|北部)$/, "");
  return /^[^区]+市$/.test(base) ? base : null;
}

export function buildJmaWarningsSnapshot(raw: Row[]): JmaWarningsSnapshot {
  const rows: JmaWarningRow[] = raw.map((r) => {
    const status = text(r.status);
    return {
      control_datetime: text(r.control_datetime),
      report_datetime: text(r.report_datetime),
      office_name: text(r.office_name),
      area_code: String(r.area_code ?? ""),
      area_name: text(r.area_name),
      area_level: text(r.area_level),
      kind_code: text(r.kind_code),
      kind_name: text(r.kind_name),
      status,
      level: jmaWarningLevel(text(r.kind_name)),
      active: status == null || !(JMA_WARNING_INACTIVE_STATUS as readonly string[]).includes(status),
    };
  });
  const areas = new Map<string, JmaWarningArea>();
  const cityNameKeys = new Map<string, JmaWarningArea>();
  const unmatched: JmaWarningRow[] = [];
  for (const row of rows) {
    if (!row.active) continue;
    // class20 = 7 碼數字（前 5 碼＝JIS 市区町村コード）；其他層級的代碼位數不同，不硬對
    const isClass20 = /^\d{7}$/.test(row.area_code) && (row.area_level == null || row.area_level === "class20");
    if (!isClass20) { unmatched.push(row); continue; }
    const code5 = row.area_code.slice(0, 5);
    let area = areas.get(code5);
    if (!area) { area = { code5, areaName: row.area_name, level: row.level, rows: [] }; areas.set(code5, area); }
    area.rows.push(row);
    if ((LEVEL_RANK.get(row.level) ?? 0) > (LEVEL_RANK.get(area.level) ?? 0)) area.level = row.level;
  }
  // 政令市分區（横浜市北部／南部同為 14100）已在同一個 5 碼 area 內合併；再掛一把「縣碼＋市名」的鑰匙給區界用
  for (const area of areas.values()) {
    const city = area.rows.map((r) => designatedCityName(r.area_name, area.code5)).find((c) => c != null);
    if (city) cityNameKeys.set(`${area.code5.slice(0, 2)}${city}`, area);
  }
  return { rows, areas, cityNameKeys, unmatched, controlDatetime: maxIso(raw, "control_datetime") };
}

/** 一列的種類鍵：優先種別碼，沒有就用名稱。 */
function warningKindKey(row: JmaWarningRow): string | null {
  return row.kind_code ?? row.kind_name;
}

/** 某區發布中的種類（去重；級別高→低，同級依名稱）。area.rows 只含發布中的列（解除已在建快照時排除）。 */
export function jmaWarningAreaKinds(area: JmaWarningArea): { key: string; name: string | null; level: JmaWarningLevel }[] {
  const kinds = new Map<string, { key: string; name: string | null; level: JmaWarningLevel }>();
  for (const row of area.rows) {
    const key = warningKindKey(row);
    if (key != null && !kinds.has(key)) kinds.set(key, { key, name: row.kind_name, level: row.level });
  }
  return [...kinds.values()].sort((a, b) =>
    (LEVEL_RANK.get(b.level) ?? 0) - (LEVEL_RANK.get(a.level) ?? 0) || String(a.name ?? a.key).localeCompare(String(b.name ?? b.key), "ja"));
}

export interface JmaWarningKindStat { key: string; name: string | null; level: JmaWarningLevel; areaCount: number }

/** 全快照各發布中種類的區域數（areas＋cityNameKeys 以區域物件去重；依區域數多→少）。 */
export function jmaWarningKindStats(snapshot: JmaWarningsSnapshot | null): JmaWarningKindStat[] {
  if (!snapshot) return [];
  const stats = new Map<string, JmaWarningKindStat>();
  for (const area of new Set([...snapshot.areas.values(), ...snapshot.cityNameKeys.values()])) {
    for (const k of jmaWarningAreaKinds(area)) {
      const cur = stats.get(k.key);
      if (cur) cur.areaCount += 1; else stats.set(k.key, { ...k, areaCount: 1 });
    }
  }
  return [...stats.values()].sort((a, b) =>
    b.areaCount - a.areaCount || (LEVEL_RANK.get(b.level) ?? 0) - (LEVEL_RANK.get(a.level) ?? 0) || a.key.localeCompare(b.key));
}

/** 只留有該種類的區域，區域級別改成該種類的級別（地圖用該種類的色）。kindCode 為 null → 原樣回傳。 */
export function filterJmaWarningsByKind(snapshot: JmaWarningsSnapshot | null, kindCode: string | null): JmaWarningsSnapshot | null {
  if (!snapshot || kindCode == null) return snapshot;
  const narrow = (src: Map<string, JmaWarningArea>) => {
    const out = new Map<string, JmaWarningArea>();
    for (const [key, area] of src) {
      const kind = jmaWarningAreaKinds(area).find((k) => k.key === kindCode);
      if (kind) out.set(key, { ...area, level: kind.level });
    }
    return out;
  };
  return { ...snapshot, areas: narrow(snapshot.areas), cityNameKeys: narrow(snapshot.cityNameKeys) };
}

let latestWarnings: JmaWarningsSnapshot | null = null;
/** popup／圖例用：地圖目前畫的那一份警報快照（未載入、未涵蓋或失敗 → null）。 */
export function getLatestJmaWarnings(): JmaWarningsSnapshot | null {
  return latestWarnings;
}
export function setLatestJmaWarnings(snapshot: JmaWarningsSnapshot | null): void {
  latestWarnings = snapshot;
}

const warningsCache = cachedByKey<JmaTimedResult<JmaWarningsSnapshot>>(async (cacheKey) => {
  const raw = cacheKey === "live"
    ? await query("jma_warnings_current", "日本警報・注意報", (q) => q.select("*").limit(20000))
    : await rpc("get_jma_warnings_at", { p_at: cacheKey }, "日本警報・注意報（歷史時刻）");
  const snapshot = buildJmaWarningsSnapshot(raw);
  return { value: snapshot, status: { rows: raw.length, drawn: snapshot.areas.size, noCoord: snapshot.unmatched.length, latestAt: snapshot.controlDatetime } };
}, 60_000, 48);

// ── 梅雨入り・明け ───────────────────────────────────────────────────
export interface JmaRainyRegion {
  region: string;
  year: number | null;
  phase: JmaRainyPhase;
  onsetState: string | null;
  onsetDate: string | null;
  onsetText: string | null;
  onsetClass: string | null;
  onsetDiff: number | null;
  onsetNormal: string | null;
  endState: string | null;
  endDate: string | null;
  endText: string | null;
  endClass: string | null;
  endDiff: number | null;
  endNormal: string | null;
  status: string | null;
}

export interface JmaRainySnapshot {
  asOf: string;
  regions: Map<string, JmaRainyRegion>;
  /** RPC 回了但前端沒有縣對照的地方名（應為空；有就是上游改名） */
  unmapped: string[];
}

export function buildJmaRainySnapshot(rows: Row[], asOf: string): JmaRainySnapshot {
  const regions = new Map<string, JmaRainyRegion>();
  const unmapped: string[] = [];
  for (const r of rows) {
    const region = text(r.region);
    if (!region) continue;
    if (!(region in JMA_RAINY_REGION_PREFS)) unmapped.push(region);
    const onsetState = text(r.onset_state);
    const endState = text(r.end_state);
    regions.set(region, {
      region,
      year: finiteOrNull(r.year),
      phase: jmaRainyPhase(onsetState, endState),
      onsetState, onsetDate: text(r.onset_date), onsetText: text(r.onset_text), onsetClass: text(r.onset_class),
      onsetDiff: finiteOrNull(r.onset_diff_normal_days), onsetNormal: text(r.onset_normal_date),
      endState, endDate: text(r.end_date), endText: text(r.end_text), endClass: text(r.end_class),
      endDiff: finiteOrNull(r.end_diff_normal_days), endNormal: text(r.end_normal_date),
      status: text(r.status),
    });
  }
  return { asOf, regions, unmapped };
}

let latestRainy: JmaRainySnapshot | null = null;
export function getLatestJmaRainy(): JmaRainySnapshot | null {
  return latestRainy;
}
export function setLatestJmaRainy(snapshot: JmaRainySnapshot | null): void {
  latestRainy = snapshot;
}

const rainyCache = cachedByKey<JmaTimedResult<JmaRainySnapshot>>(async (date) => {
  const rows = await rpc("get_jma_rainy_season_asof", { p_date: date }, "日本梅雨入り・明け");
  const snapshot = buildJmaRainySnapshot(rows, date);
  return { value: snapshot, status: { rows: rows.length, drawn: snapshot.regions.size, noCoord: snapshot.unmapped.length, latestAt: date } };
}, 30 * 60_000, 32);

// ── 對外入口 ────────────────────────────────────────────────────────
export function fetchJmaPointAt(key: JmaPointKey, cacheKey: string): Promise<JmaTimedResult<PointFC>> {
  switch (key) {
    case "jmaAmedas": return amedasCache(cacheKey);
    case "jmaWbgt": return wbgtCache(cacheKey);
    case "jmaQuakes": return quakeCache(cacheKey);
    case "jmaVolcanoes": return volcanoCache("live");
    case "jmaSnowcap": return snowcapCache(cacheKey);
    case "jmaAutumnLeaves":
    case "jmaSakura":
      return phenologyRowsCache(cacheKey).then((rows) => buildPhenologyFC(rows, key, cacheKey));
  }
}

export function fetchJmaWarningsAt(cacheKey: string): Promise<JmaTimedResult<JmaWarningsSnapshot>> {
  return warningsCache(cacheKey);
}

export function fetchJmaRainyAt(date: string): Promise<JmaTimedResult<JmaRainySnapshot>> {
  return rainyCache(date);
}

/** 輪詢時清掉這一桶（live 或今天）讓下一次重查。 */
export function invalidateJmaTimed(key: JmaTimedKey, cacheKey: string): void {
  switch (key) {
    case "jmaAmedas": return amedasCache.invalidate(cacheKey);
    case "jmaWbgt": return wbgtCache.invalidate(cacheKey);
    case "jmaQuakes": return quakeCache.invalidate(cacheKey);
    case "jmaVolcanoes": return volcanoCache.invalidate();
    case "jmaSnowcap": return snowcapCache.invalidate(cacheKey);
    case "jmaAutumnLeaves":
    case "jmaSakura": return phenologyRowsCache.invalidate(cacheKey);
    case "jmaWarnings": return warningsCache.invalidate(cacheKey);
    case "jmaRainySeason": return rainyCache.invalidate(cacheKey);
  }
}
