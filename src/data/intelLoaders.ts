/**
 * Intel Panel — Supabase loader（來源健康 + 升溫排行）
 *
 * 對應 migration 167 (get_source_health) + 166 (get_news_trending)
 */
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey, keyedThunkCache } from "../lib/loaderCache";

// TTL：對齊 60s polling interval，讓 IntelPanel + MonitorPanel 同 tick 共享一次 fetch、減輕連線池。
const TTL_FAST = 55_000;   // 即時值（pressure / market / alertSummary）— 約每次輪詢實打一次
const TTL_SLOW = 115_000;  // 慢變（source health / trending / signals timeline / yt live）— 約每兩次輪詢才實打一次
const TTL_DAILY = 60 * 60_000;  // 每日一次（pla activity）
const TTL_WEEKLY = 5 * 60_000;  // 5 分鐘（health weekly / alert series 24h）

// ── Source health ────────────────────────────────────────────────

export type SourceStatus = "ok" | "lagging" | "degraded" | "unknown";

export interface SourceHealthRow {
  feed_url: string;
  source: string;
  county_hint: string | null;
  status: SourceStatus;
  lag_sec: number | null;
  consecutive_fail: number;
  last_error: string | null;
  last_success_at: string | null;
}

export interface SourceHealthSummary {
  total: number;
  ok: number;
  lagging: number;
  degraded: number;
  unknown: number;
  rows: SourceHealthRow[];
}

function summarize(rows: SourceHealthRow[]): SourceHealthSummary {
  const acc = { total: rows.length, ok: 0, lagging: 0, degraded: 0, unknown: 0 };
  for (const r of rows) acc[r.status] += 1;
  return { ...acc, rows };
}

async function _fetchSourceHealthRaw(): Promise<SourceHealthSummary> {
  if (!supabaseConfigured) return summarize([]);
  const { data, error } = await withLoading(
    "intel:source-health",
    "新聞來源健康",
    supabase.rpc("get_source_health"),
  );
  if (error) {
    console.warn("[Intel] get_source_health failed:", error.message);
    return summarize([]);
  }
  return summarize((data ?? []) as SourceHealthRow[]);
}
export const fetchSourceHealth = cachedOnce(_fetchSourceHealthRaw, TTL_SLOW);

// ── Trending（升溫）─────────────────────────────────────────────

export interface TrendingRow {
  county: string;
  category: string;
  cnt: number;
  baseline_avg: number;
  surge_ratio: number | null;
}

async function _fetchNewsTrendingRaw(
  windowHours: number,
  limit: number,
): Promise<TrendingRow[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "intel:trending",
    "新聞升溫排行",
    supabase.rpc("get_news_trending", {
      p_window_hours: windowHours,
      p_limit: limit,
    }),
  );
  if (error) {
    console.warn("[Intel] get_news_trending failed:", error.message);
    return [];
  }
  return (data ?? []) as TrendingRow[];
}
const _trendingCache = keyedThunkCache<TrendingRow[]>(TTL_SLOW);
export function fetchNewsTrending(windowHours = 1, limit = 30): Promise<TrendingRow[]> {
  return _trendingCache(`${windowHours}|${limit}`, () =>
    _fetchNewsTrendingRaw(windowHours, limit),
  );
}

/** 把 trending rows 攤平成 Set<"county|category"> 給卡片快速判 🔥 */
export function trendingKeys(rows: TrendingRow[], threshold = 2): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (r.surge_ratio != null && r.surge_ratio >= threshold) {
      s.add(`${r.county}|${r.category}`);
    }
  }
  return s;
}

// ── Monitor Phase 2 ──────────────────────────────────────────────

/** 壓力指數 0-100 + 10 signal 細節（get_pressure_index_now()） */
export interface PressureSignal {
  id: string;
  label: string;
  en: string;
  weight: number;
  raw: number;          // 0-100
  contribution: number; // weight * raw
  note: string | null;
}

export interface PressureIndexNow {
  composite: number;     // 0-100 加權後
  level: string | null;  // peace / notice / alert / emergency
  vs_baseline: number;   // 與「平常同時段」差
  vs_1h_ago: number;     // 與 1h 前差
  per_signal: PressureSignal[];
  asof: string | null;   // ISO
}

const EMPTY_PRESSURE: PressureIndexNow = {
  composite: 0, level: null, vs_baseline: 0, vs_1h_ago: 0, per_signal: [], asof: null,
};

async function _fetchPressureIndexRaw(): Promise<PressureIndexNow> {
  if (!supabaseConfigured) return EMPTY_PRESSURE;
  const { data, error } = await withLoading(
    "intel:pressure-index",
    "壓力指數",
    supabase.rpc("get_pressure_index_now"),
  );
  if (error) {
    console.warn("[Intel] get_pressure_index_now failed:", error.message);
    return EMPTY_PRESSURE;
  }
  // RPC 可能回 single row 或 array，做防呆攤平
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_PRESSURE;
  return {
    composite: Number(row.composite ?? 0),
    level: row.level ?? null,
    vs_baseline: Number(row.vs_baseline ?? 0),
    vs_1h_ago: Number(row.vs_1h_ago ?? 0),
    per_signal: (row.per_signal ?? []) as PressureSignal[],
    asof: row.asof ?? null,
  };
}
export const fetchPressureIndex = cachedOnce(_fetchPressureIndexRaw, TTL_FAST);

/** 多軌 signal 時間序列（給 TimelineDock Phase 2 multi-track） */
export interface SignalsTimelinePoint {
  signal: string;
  hour: string;     // ISO hour bucket
  score: number;    // 0-100
  level: string | null;
}

async function _fetchSignalsTimelineRaw(
  hours: number,
  signals: string[] | undefined,
): Promise<SignalsTimelinePoint[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "intel:signals-timeline",
    "信號時間軸",
    supabase.rpc("get_signals_timeline", {
      p_hours: hours,
      p_signals: signals ?? null,
    }),
  );
  if (error) {
    console.warn("[Intel] get_signals_timeline failed:", error.message);
    return [];
  }
  return (data ?? []) as SignalsTimelinePoint[];
}
const _signalsCache = keyedThunkCache<SignalsTimelinePoint[]>(TTL_SLOW);
export function fetchSignalsTimeline(
  hours = 24,
  signals?: string[],
): Promise<SignalsTimelinePoint[]> {
  const key = `${hours}|${signals ? signals.slice().sort().join(",") : "*"}`;
  return _signalsCache(key, () => _fetchSignalsTimelineRaw(hours, signals));
}

/** TWSE 加權指數 — realtime.market_index_current（取最新一列） */
export interface MarketIndex {
  index: number;
  prev_close: number;
  open: number;
  high: number;
  low: number;
  change: number;
  change_pct: number;
  turnover: string | null;  // 顯示用成交量「1365.1 萬張」（migration 325 起；上游欄位實為成交股數）
  time: string | null;      // "13:33"
  status: string | null;    // 盤中 / 收盤 / 休市
}

const EMPTY_MARKET: MarketIndex = {
  index: 0, prev_close: 0, open: 0, high: 0, low: 0,
  change: 0, change_pct: 0, turnover: null, time: null, status: null,
};

async function _fetchMarketIndexRaw(): Promise<MarketIndex> {
  if (!supabaseConfigured) return EMPTY_MARKET;
  // realtime.* 不能直接打，走 public RPC wrapper（後端已上線 get_market_index_now）
  const { data, error } = await withLoading(
    "intel:market-index",
    "加權指數",
    supabase.rpc("get_market_index_now"),
  );
  if (error) {
    console.warn("[Intel] get_market_index_now failed:", error.message);
    return EMPTY_MARKET;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_MARKET;
  const index = Number(row.index ?? row.idx ?? 0);
  const prev = Number(row.prev_close ?? row.y ?? 0);
  const change = Number(row.change ?? (index - prev).toFixed(2));
  const pct = Number(row.change_pct ?? (prev ? +((change / prev) * 100).toFixed(2) : 0));
  return {
    index,
    prev_close: prev,
    open: Number(row.open ?? 0),
    high: Number(row.high ?? 0),
    low: Number(row.low ?? 0),
    change,
    change_pct: pct,
    turnover: row.turnover ?? null,
    time: row.time ?? null,
    status: row.status ?? null,
  };
}
export const fetchMarketIndex = cachedOnce(_fetchMarketIndexRaw, TTL_FAST);

/** 加權指數近 30 交易日日線 — public.get_market_index_daily（migration 325） */
export interface MarketIndexDailyPoint {
  trade_date: string;   // "2026-07-31"；週末/缺日無列，畫圖請用交易日序列而非日曆軸
  open: number;
  high: number;
  low: number;
  close: number;
  prev_close: number;
  change: number;
  change_pct: number;
  volume_lots: number;  // 張
}

async function _fetchMarketIndexHistoryRaw(): Promise<MarketIndexDailyPoint[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "intel:market-history",
    "加權指數 30 日",
    supabase.rpc("get_market_index_daily", { p_days: 30 }),
  );
  if (error) {
    console.warn("[Intel] get_market_index_daily failed:", error.message);
    return [];
  }
  return (data ?? []) as MarketIndexDailyPoint[];
}
// 日線一天只長一筆（盤中最後一點為當日即時值），10 min TTL 比照 power 24h 慢輪詢
export const fetchMarketIndexHistory = cachedOnce(_fetchMarketIndexHistoryRaw, 10 * 60_000);

/** 共機動態 — realtime.pla_activity_daily（最新一日） */
export interface PlaAdizZone {
  key: "north" | "central" | "southwest" | "east";
  label: string;
  active: boolean;
}

export interface PlaActivity {
  sorties: number;
  crossed_median: number;
  plan_vessels: number;
  official_ships: number;
  adiz: PlaAdizZone[];
  as_of: string | null;   // "今日 06:00"
  source: string;
  title: string;
}

const PLA_FALLBACK_LABELS: Record<PlaAdizZone["key"], string> = {
  north: "北", central: "中", southwest: "西南", east: "東",
};
const EMPTY_PLA: PlaActivity = {
  sorties: 0, crossed_median: 0, plan_vessels: 0, official_ships: 0,
  adiz: (["north", "central", "southwest", "east"] as const).map((k) => ({
    key: k, label: PLA_FALLBACK_LABELS[k], active: false,
  })),
  as_of: null,
  source: "中華民國國防部 @MoNDefense · 每日 06:00 (UTC+8) 截止",
  title: "中共解放軍臺海周邊海、空域動態",
};

async function _fetchPlaActivityRaw(): Promise<PlaActivity> {
  if (!supabaseConfigured) return EMPTY_PLA;
  const { data, error } = await withLoading(
    "intel:pla-activity",
    "共機動態",
    supabase.rpc("get_pla_activity_latest"),
  );
  if (error) {
    console.warn("[Intel] get_pla_activity_latest failed:", error.message);
    return EMPTY_PLA;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_PLA;
  return {
    sorties: Number(row.sorties ?? 0),
    crossed_median: Number(row.crossed_median ?? 0),
    plan_vessels: Number(row.plan_vessels ?? 0),
    official_ships: Number(row.official_ships ?? 0),
    adiz: (["north", "central", "southwest", "east"] as const).map((k) => ({
      key: k,
      label: PLA_FALLBACK_LABELS[k],
      active: Boolean(row[`adiz_${k}`] ?? false),
    })),
    as_of: row.as_of ?? "今日 06:00",
    source: row.source ?? EMPTY_PLA.source,
    title: row.title ?? EMPTY_PLA.title,
  };
}
export const fetchPlaActivity = cachedOnce(_fetchPlaActivityRaw, TTL_DAILY);

/** 共機近 N 日趨勢 — public.get_pla_activity_range（migration 326）
 *  ⚠ sorties/crossed 可能為 null（該日通報解析失敗），與「0 架次」語意不同，
 *  畫圖務必當斷點處理，勿 ?? 0。 */
export interface PlaActivityDayPoint {
  report_date: string;
  sorties: number | null;
  crossed_median: number | null;
  plan_vessels: number | null;
  official_ships: number | null;
  chart_url: string | null;
}

async function _fetchPlaActivityHistoryRaw(): Promise<PlaActivityDayPoint[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "intel:pla-history",
    "共機 30 日",
    supabase.rpc("get_pla_activity_range", { p_days: 30 }),
  );
  if (error) {
    console.warn("[Intel] get_pla_activity_range failed:", error.message);
    return [];
  }
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    report_date: String(r.report_date),
    sorties: num(r.sorties),
    crossed_median: num(r.crossed_median),
    plan_vessels: num(r.plan_vessels),
    official_ships: num(r.official_ships),
    chart_url: (r.chart_url as string | null) ?? null,
  }));
}
export const fetchPlaActivityHistory = cachedOnce(_fetchPlaActivityHistoryRaw, TTL_DAILY);

/** CDC 公衛週報 — realtime.public_health_weekly（最新 ISO 週的 3 個指標） */
export interface CdcDisease {
  id: "flu" | "dengue" | "entero";
  label: string;
  en: string;
  value: string;
  unit: string;
  spark: number[];
  yoy: number;
  note: string;
  color: string;
}

export interface PublicHealthWeek {
  week: number;            // ISO 週
  diseases: CdcDisease[];
}

const EMPTY_HEALTH: PublicHealthWeek = { week: 0, diseases: [] };

const HEALTH_DEFAULTS: Record<CdcDisease["id"], { label: string; en: string; unit: string; color: string }> = {
  flu:    { label: "類流感", en: "ILI",         unit: "門急診/週", color: "#22c55e" },
  dengue: { label: "登革熱", en: "DENGUE",      unit: "本週確診",  color: "#f97316" },
  entero: { label: "腸病毒", en: "ENTEROVIRUS", unit: "急診人次",  color: "#eab308" },
};

/**
 * YouTube live video resolver — Monitor Mode LiveWall 用
 * 對應 gis-platform migration 209，collector 每 5 min 把 14 家新聞台
 * 當前直播 video_id 解析寫進 realtime.yt_live_current。
 *
 * 為何要這支：YouTube `embed/live_stream?channel=UCxxx` 在很多頻道解析不到
 * primary live event（跳「無法播放這部影片」）。改用 `embed/<video_id>` 才可靠。
 */
export interface YtLiveVideo {
  handle: string;        // '@TVBSNEWS01'
  channel_id: string | null;  // UCxxx
  video_id: string | null;    // 11-char current live videoId
  title: string | null;
  is_live: boolean;
  view_count: number | null;
  last_error: string | null;
  observed_at: string | null;
  updated_at: string;
}

async function _fetchLiveVideosRaw(onlyLive: boolean): Promise<YtLiveVideo[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    "intel:yt-live-videos",
    "YouTube 直播解析",
    supabase.rpc("get_yt_live_videos", { p_only_live: onlyLive }),
  );
  if (error) {
    console.warn("[Intel] get_yt_live_videos failed:", error.message);
    return [];
  }
  return (data ?? []) as YtLiveVideo[];
}
const _liveVideosCache = keyedThunkCache<YtLiveVideo[]>(TTL_SLOW);
export function fetchLiveVideos(onlyLive = false): Promise<YtLiveVideo[]> {
  return _liveVideosCache(onlyLive ? "live" : "all", () => _fetchLiveVideosRaw(onlyLive));
}

async function _fetchPublicHealthWeeklyRaw(): Promise<PublicHealthWeek> {
  if (!supabaseConfigured) return EMPTY_HEALTH;
  const { data, error } = await withLoading(
    "intel:public-health",
    "CDC 公衛週報",
    supabase.rpc("get_public_health_weekly"),
  );
  if (error) {
    console.warn("[Intel] get_public_health_weekly failed:", error.message);
    return EMPTY_HEALTH;
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) return EMPTY_HEALTH;
  const week = Number(rows[0]?.week ?? 0);
  const diseases: CdcDisease[] = [];
  for (const r of rows) {
    const id = r.id as CdcDisease["id"];
    const def = HEALTH_DEFAULTS[id];
    if (!def) continue;
    diseases.push({
      id,
      label: r.label ?? def.label,
      en: r.en ?? def.en,
      value: String(r.value ?? "—"),
      unit: r.unit ?? def.unit,
      spark: Array.isArray(r.spark) ? r.spark.map(Number) : [],
      yoy: Number(r.yoy ?? 0),
      note: r.note ?? "",
      color: r.color ?? def.color,
    });
  }
  return { week, diseases };
}
export const fetchPublicHealthWeekly = cachedOnce(_fetchPublicHealthWeeklyRaw, TTL_WEEKLY);

/* ────────────────────────────────────────────────────────────
 * 共機擾台戰情板（migration 332/333）
 *
 * ⚠️ 三個一定要照做的語意，違反了畫面就會說謊：
 *  1. `sorties` / `level` 為 null = 該日通報解析失敗，與「0 架次」完全不同
 *     （近 120 天有 18 天是真的 0）。圖上必須畫斷點，不可補 0。
 *  2. 百分位是**相對**的 —— 連續平靜的 120 天會讓中等日子排到高分位。
 *     顯示分級時必須同時給絕對數字與該級距門檻（summary 提供）。
 *  3. 機型的 `sortiesExact` 與 `sortiesShared` **不可相加**。混合項次
 *     「(3 sorties of fighter / UAV)」是兩種合計，拆不開。主指標用 `days`。
 * ──────────────────────────────────────────────────────────── */

/** 1 平靜 / 2 一般 / 3 偏高 / 4 高 / 5 顯著 */
export type PlaLevel = 1 | 2 | 3 | 4 | 5;

export const PLA_LEVEL_LABELS: Record<PlaLevel, string> = {
  1: "平靜", 2: "一般", 3: "偏高", 4: "高", 5: "顯著",
};
export const PLA_LEVEL_COLORS: Record<PlaLevel, string> = {
  1: "#34d399", 2: "#94a3b8", 3: "#fbbf24", 4: "#fb923c", 5: "#ef4444",
};

export interface PlaSeverityDay {
  reportDate: string;
  periodEnd: string | null;
  sorties: number | null;
  crossedMedian: number | null;
  planVessels: number | null;
  officialShips: number | null;
  adiz: { north: boolean; central: boolean; southwest: boolean; east: boolean };
  pctSorties: number | null;
  pctCrossed: number | null;
  /** 兩軸皆 ≥ p90 → 分級再升一級 */
  resonance: boolean;
  /** null = 該日解析失敗 */
  level: PlaLevel | null;
  chartUrl: string | null;
}

export interface PlaSituationSummary {
  windowDays: number;
  dateFrom: string;
  dateTo: string;
  daysTotal: number;
  daysZero: number;
  daysUnknown: number;
  daysCrossed: number;
  sorties: { p50: number; p75: number; p90: number; p97: number; max: number };
  crossed: { p50: number; p75: number; p90: number; p97: number; max: number };
  zones: { north: number; central: number; southwest: number; east: number };
}

export interface PlaKindStat {
  kind: string;
  /** 出現天數 —— 唯一精確的彙總指標 */
  days: number;
  /** 單一機型項次的架次總和（精確） */
  sortiesExact: number;
  /** 混合項次架次（與其他機型共享，**不可**與 exact 相加） */
  sortiesShared: number;
  itemsTotal: number;
  itemsSingle: number;
}

export const PLA_KIND_LABELS: Record<string, string> = {
  fighter: "戰機", bomber: "轟炸機", support: "輔戰機",
  uav: "無人機", helicopter: "直升機", balloon: "空飄氣球",
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function _fetchPlaSeverityDaily(windowDays: number): Promise<PlaSeverityDay[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    `pla:severity:${windowDays}`,
    "共機嚴重度",
    supabase.rpc("get_pla_severity_daily", { p_window: windowDays }),
  );
  if (error) {
    console.warn("[Intel] get_pla_severity_daily failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    reportDate: String(r.report_date),
    periodEnd: (r.period_end as string | null) ?? null,
    sorties: num(r.sorties),
    crossedMedian: num(r.crossed_median),
    planVessels: num(r.plan_vessels),
    officialShips: num(r.official_ships),
    adiz: {
      north: Boolean(r.adiz_north), central: Boolean(r.adiz_central),
      southwest: Boolean(r.adiz_southwest), east: Boolean(r.adiz_east),
    },
    pctSorties: num(r.pct_sorties),
    pctCrossed: num(r.pct_crossed),
    resonance: Boolean(r.resonance),
    level: (num(r.level) as PlaLevel | null) ?? null,
    chartUrl: (r.chart_url as string | null) ?? null,
  }));
}

const severityCache = cachedByKey(
  (k: string) => _fetchPlaSeverityDaily(Number(k)),
  TTL_DAILY,
);
export function fetchPlaSeverityDaily(windowDays = 120): Promise<PlaSeverityDay[]> {
  return severityCache(String(windowDays));
}

async function _fetchPlaSituationSummary(windowDays: number): Promise<PlaSituationSummary | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await withLoading(
    `pla:summary:${windowDays}`,
    "共機視窗統計",
    supabase.rpc("get_pla_situation_summary", { p_window: windowDays }),
  );
  if (error) {
    console.warn("[Intel] get_pla_situation_summary failed:", error.message);
    return null;
  }
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r) return null;
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    windowDays: n("window_days"),
    dateFrom: String(r.date_from), dateTo: String(r.date_to),
    daysTotal: n("days_total"), daysZero: n("days_zero"),
    daysUnknown: n("days_unknown"), daysCrossed: n("days_crossed"),
    sorties: { p50: n("sorties_p50"), p75: n("sorties_p75"), p90: n("sorties_p90"), p97: n("sorties_p97"), max: n("sorties_max") },
    crossed: { p50: n("crossed_p50"), p75: n("crossed_p75"), p90: n("crossed_p90"), p97: n("crossed_p97"), max: n("crossed_max") },
    zones: { north: n("zone_north"), central: n("zone_central"), southwest: n("zone_southwest"), east: n("zone_east") },
  };
}

const summaryCache = cachedByKey(
  (k: string) => _fetchPlaSituationSummary(Number(k)),
  TTL_DAILY,
);
export function fetchPlaSituationSummary(windowDays = 120): Promise<PlaSituationSummary | null> {
  return summaryCache(String(windowDays));
}

async function _fetchPlaKindSummary(windowDays: number): Promise<PlaKindStat[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await withLoading(
    `pla:kinds:${windowDays}`,
    "共機機型",
    supabase.rpc("get_pla_kind_summary", { p_window: windowDays }),
  );
  if (error) {
    console.warn("[Intel] get_pla_kind_summary failed:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    kind: String(r.kind),
    days: Number(r.days ?? 0),
    sortiesExact: Number(r.sorties_exact ?? 0),
    sortiesShared: Number(r.sorties_shared ?? 0),
    itemsTotal: Number(r.items_total ?? 0),
    itemsSingle: Number(r.items_single ?? 0),
  }));
}

const kindCache = cachedByKey((k: string) => _fetchPlaKindSummary(Number(k)), TTL_DAILY);
export function fetchPlaKindSummary(windowDays = 120): Promise<PlaKindStat[]> {
  return kindCache(String(windowDays));
}
