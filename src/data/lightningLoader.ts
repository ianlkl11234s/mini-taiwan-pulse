import { supabase, todayTaiwan } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey, cachedOnce } from "../lib/loaderCache";
import { padTaipeiDaily } from "../lib/taipeiDay";

/**
 * 落雷 loader（RPC 214 get_lightning_recent(minutes)）
 *
 * - clamp 1~720 min（RPC 端再 clamp 一次）
 * - LIMIT 50000（雷雨季 1h 內可達數萬筆）
 * - 前端 cluster + zoom-gate 視覺由 overlayRegistry 處理
 * - cache TTL 60s（cron 1min 寫入，避免過度查詢）
 */

export interface LightningStrike {
  event_id: number;
  strike_ts: number;
  intensity_ka: number | null;
  strike_type: number; // 0=雲對地, 1=雲中
  lon: number;
  lat: number;
}

async function fetchLightningRecentUncached(minutes: number): Promise<LightningStrike[]> {
  const clamped = Math.min(720, Math.max(1, Math.floor(minutes)));
  const { data, error } = await withLoading(
    `lightning:${clamped}m`,
    `落雷最近 ${clamped} 分鐘`,
    supabase.rpc("get_lightning_recent", { minutes: clamped }),
  );
  if (error) throw new Error(`get_lightning_recent: ${error.message}`);
  return (data ?? []) as LightningStrike[];
}

const fetchLightningCached = cachedByKey<LightningStrike[]>(
  (key) => fetchLightningRecentUncached(Number(key)),
  60_000,
  8,
);

export const fetchLightningRecent = (minutes: number): Promise<LightningStrike[]> =>
  fetchLightningCached(String(clampMinutes(minutes)));

export const invalidateLightning = (): void => fetchLightningCached.invalidate();

// ── timeline 窗（v2 Phase B+，RPC 224）─────────────────────────
// key 用「ts 量化到最近 60s + halfMin」避免每次 throttle tick 都打 RPC
async function fetchLightningWindowUncached(
  centerTs: number,
  halfMin: number,
): Promise<LightningStrike[]> {
  const half = clampMinutes(halfMin);
  const { data, error } = await withLoading(
    `lightning:window:${centerTs}|${half}m`,
    `落雷 ±${half} 分鐘`,
    supabase.rpc("get_lightning_window", { center_ts: centerTs, half_min: half }),
  );
  if (error) throw new Error(`get_lightning_window: ${error.message}`);
  return (data ?? []) as LightningStrike[];
}

const fetchLightningWindowCached = cachedByKey<LightningStrike[]>(
  (key) => {
    const [ts, half] = key.split("|").map(Number);
    return fetchLightningWindowUncached(ts!, half!);
  },
  60_000,
  32, // 32 個量化 ts × halfMin 組合
);

/** 量化 ts 到最近 60s（scrub 時 60s 內視為同一查詢，cache hit）*/
export function quantiseLightningTs(ts: number): number {
  return Math.round(ts / 60) * 60;
}

export const fetchLightningWindow = (centerTs: number, halfMin: number): Promise<LightningStrike[]> =>
  fetchLightningWindowCached(`${quantiseLightningTs(centerTs)}|${clampMinutes(halfMin)}`);

export const invalidateLightningWindow = (): void => fetchLightningWindowCached.invalidate();

// ── day preload（v2 Phase B++，RPC 226）─────────────────────
// 整天落雷一次抓，前端 client-side filter + fade，scrub 不再打 server。
// 2026-06-26：分 raw + wrapped — prefetch 走 raw（背景靜默不灌 LOADING panel）。
// 2026-08-07：加 source 維度（gis-platform migration 338）。台電自 2026-07-10 起
// 端點活著但永遠回空檔，氣象署源（cwa）並行後兩者可互為對照。
// cache key 是 `${source}|${dateKey}` —— 兩源分開快取，不可共用。
export type LightningSource = "taipower" | "cwa";
export const DEFAULT_LIGHTNING_SOURCE: LightningSource = "taipower";

async function fetchLightningDayRaw(cacheKey: string): Promise<LightningStrike[]> {
  const [source, dateKey] = cacheKey.split("|");
  const { data, error } = await supabase.rpc("get_lightning_day", {
    date_key: dateKey,
    p_source: source,
  });
  if (error) throw new Error(`get_lightning_day(${source}): ${error.message}`);
  return (data ?? []) as LightningStrike[];
}
const fetchLightningDayCached = cachedByKey<LightningStrike[]>(
  fetchLightningDayRaw,
  10 * 60_000,
  16, // 兩源 × (timeline rangeDays 最高 7 + 1 spare)
);
const dayCacheKey = (dateKey: string, source: LightningSource) => `${source}|${dateKey}`;

/** Foreground — 顯示 LOADING tracker。Hook 應該用這個載當前日。 */
export const fetchLightningDay = (
  dateKey: string,
  source: LightningSource = DEFAULT_LIGHTNING_SOURCE,
): Promise<LightningStrike[]> =>
  withLoading(
    `lightning:day:${source}:${dateKey}`,
    `落雷 ${dateKey} 整日${source === "cwa" ? "（氣象署）" : ""}`,
    fetchLightningDayCached(dayCacheKey(dateKey, source)),
  );
/** Prefetch — 靜默，不灌 LOADING panel。與 fetchLightningDay 共用 cache。 */
export const prefetchLightningDay = (
  dateKey: string,
  source: LightningSource = DEFAULT_LIGHTNING_SOURCE,
): Promise<LightningStrike[]> => fetchLightningDayCached(dayCacheKey(dateKey, source));
/** 不帶 dateKey = 清掉該來源全部快取日；兩個參數都不帶才是清全部。 */
export const invalidateLightningDay = (dateKey?: string, source?: LightningSource): void => {
  if (dateKey && source) return fetchLightningDayCached.invalidate(dayCacheKey(dateKey, source));
  fetchLightningDayCached.invalidate();
};

// ══════════════════════════════════════════════════════════════════
//  Monitor 落雷卡摘要（複用 get_lightning_day，不新增 RPC）
// ══════════════════════════════════════════════════════════════════
//
// 為什麼不整包抓回來自己數：雷雨季單日可達數萬筆，卡片只要三個數字。
// PostgREST 對「回 setof 的 function」支援對輸出欄再下 filter / order / limit，
// 所以計數走 `head + count=exact`（不傳 body）、最新一筆走 `order desc + limit 1`。
//
// ⚠️ **台電源自 2026-07-10 起端點活著但永遠回空**（BACKLOG DS-01/03，
// upstreamRegistry lightningCwa 註解亦有記）。因此卡片主來源固定氣象署（cwa），
// 台電只查當日計數當「斷供偵測」，畫面明說狀態而不是假裝 0 次落雷。
//
// 刻意不包 withLoading：Monitor 面板背景輪詢（5min），非圖層載入 —— 理由同
// loadingRegistryContract.test.ts 對 airportPaxLoader 的豁免（本檔兩支已登記其中）。

/** 卡片主來源：氣象署（台電斷供中） */
export const MONITOR_LIGHTNING_SOURCE: LightningSource = "cwa";
/** 對照來源：台電（用於顯示上游斷供狀態） */
export const MONITOR_LIGHTNING_FALLBACK_SOURCE: LightningSource = "taipower";

export interface LightningSummary {
  /** 查詢的台北日 YYYY-MM-DD */
  dateKey: string;
  source: LightningSource;
  /** 主來源近 1 小時落雷數 */
  count1h: number;
  /** 主來源當日累計 */
  countDay: number;
  /** 主來源最新一筆（無則 null） */
  latest: { ts: number; lon: number; lat: number; strikeType: number } | null;
  fallbackSource: LightningSource;
  /** 對照來源當日累計 —— 0 代表上游持續斷供 */
  fallbackCountDay: number;
  /** 任一查詢失敗 → 卡片顯示「資料暫時無法取得」而不是把失敗畫成 0 次 */
  failed: boolean;
}

async function fetchLightningDayCount(
  source: LightningSource, dateKey: string, sinceTs: number | null,
): Promise<number> {
  const lightningCountQuery = supabase.rpc(
    "get_lightning_day",
    { date_key: dateKey, p_source: source },
    { head: true, count: "exact" },
  );
  const { count, error } = await (
    sinceTs == null ? lightningCountQuery : lightningCountQuery.gte("strike_ts", sinceTs)
  );
  if (error) throw new Error(`get_lightning_day count(${source}): ${error.message}`);
  return count ?? 0;
}

async function fetchLightningLatest(
  source: LightningSource, dateKey: string,
): Promise<LightningStrike | null> {
  const lightningLatestQuery = supabase.rpc("get_lightning_day", {
    date_key: dateKey,
    p_source: source,
  });
  const { data, error } = await lightningLatestQuery
    .order("strike_ts", { ascending: false })
    .limit(1);
  if (error) throw new Error(`get_lightning_day latest(${source}): ${error.message}`);
  return ((data ?? []) as LightningStrike[])[0] ?? null;
}

async function fetchLightningSummaryUncached(): Promise<LightningSummary> {
  const dateKey = todayTaiwan();
  const base: LightningSummary = {
    dateKey,
    source: MONITOR_LIGHTNING_SOURCE,
    count1h: 0,
    countDay: 0,
    latest: null,
    fallbackSource: MONITOR_LIGHTNING_FALLBACK_SOURCE,
    fallbackCountDay: 0,
    failed: false,
  };
  try {
    const sinceTs = Math.floor(Date.now() / 1000) - 3600;
    const [countDay, count1h, latest, fallbackCountDay] = await Promise.all([
      fetchLightningDayCount(MONITOR_LIGHTNING_SOURCE, dateKey, null),
      fetchLightningDayCount(MONITOR_LIGHTNING_SOURCE, dateKey, sinceTs),
      fetchLightningLatest(MONITOR_LIGHTNING_SOURCE, dateKey),
      fetchLightningDayCount(MONITOR_LIGHTNING_FALLBACK_SOURCE, dateKey, null),
    ]);
    return {
      ...base,
      countDay,
      count1h,
      fallbackCountDay,
      latest: latest
        ? { ts: latest.strike_ts, lon: latest.lon, lat: latest.lat, strikeType: latest.strike_type }
        : null,
    };
  } catch (e) {
    console.warn("[LightningSummary]", e);
    return { ...base, failed: true };
  }
}

const fetchLightningSummaryCached = cachedOnce(fetchLightningSummaryUncached, 5 * 60_000);

/** 給 Monitor 落雷卡：近 1h / 當日落雷數 + 最新一筆 + 台電源斷供狀態 */
export function fetchLightningSummary(): Promise<LightningSummary> {
  return fetchLightningSummaryCached();
}

export const invalidateLightningSummary = (): void => fetchLightningSummaryCached.invalidate();

// ══════════════════════════════════════════════════════════════════
//  Monitor 落雷卡歷史趨勢（RPC 348 get_lightning_daily，近 N 天逐日）
// ══════════════════════════════════════════════════════════════════
//
// gis-platform migration 348 尚未 apply（待 user review）之前，PostgREST 對
// 不存在的函式回 404 / code PGRST202——這類「還沒上線」的失敗才安靜拿到空陣列、
// 用 console.debug 不噴紅字；其餘（500 / RLS 撤權 / 網路錯誤…）一律 console.warn
// 仍照樣回 []（卡片還是要優雅降級，只是不能再無聲吞掉真正的故障，見
// isMissingRpcError）。migration apply 後 isMissingRpcError 分支自然不會再命中，
// 不用再改本檔。
//
// 補零口徑刻意跟 earthquakeLoader.ts 的 fetchEarthquakeDaily 不同一部分、
// 相同一部分：count 缺日補 0（跟地震一樣，COUNT() 對空集合就是 0），但
// cloudToGround / maxIntensityKa 缺日補 null（MAX() 對空集合沒有意義，
// 不該假裝成 0）—— 詳見 gis-platform migration 348 檔頭「補零決策」。
//
// ⚠️ 連續日期軸的錨點**不是** todayTaiwan()（這點跟 fetchEarthquakeDaily
// 不同）：analytics.lightning_daily_summary 的 refresh cron 只補「昨天」，
// today 這格在 RPC 端永遠不存在。若軸錨在 todayTaiwan()，會把 RPC 回傳的
// 最舊一天擠掉、同時把 today 補成一根假的「今日 0 次」柱——每天都錯一格。
// 改錨在 RPC 實際回傳的最新一筆 strike_date（=表內 MAX(strike_date)，
// 正常情況下就是昨天；pipeline 落後時右界也會誠實跟著落後，而不是用假零
// 蓋過去）。rows 為空（RPC 成功但聚合表全空）直接回 []，比照 RPC 未上線
// 的降級行為——沒有任何一天有資料時，軸該錨在哪一天本來就無意義。
//
// 刻意不包 withLoading：Monitor 面板背景輪詢（30min 一次），非圖層載入 ——
// 灌 LOADING 面板會讓牆面每半小時閃一次。理由同 loadingRegistryContract.test.ts
// 對 airportPaxLoader 的豁免（本函式已列入該檔 EXEMPT）。

export interface LightningDay {
  /** 台北曆日 YYYY-MM-DD */
  dateKey: string;
  /** 當日總落雷數；當日無資料時補 0 */
  count: number;
  cloudToGround: number | null;
  maxIntensityKa: number | null;
}

interface LightningDailyRpcRow {
  strike_date: string;
  event_count: number;
  cloud_to_ground: number | null;
  cloud_to_cloud: number | null;
  max_intensity_ka: number | null;
}

const DEFAULT_LIGHTNING_DAILY_DAYS = 14;

/**
 * 把 RPC 回傳（只含有資料的日期，已由舊到新排序）補成連續 days 天。
 * 右界錨在 rows 最後一筆的 strike_date（不是 todayTaiwan()，理由見檔頭）。
 */
function padLightningDaily(rows: LightningDailyRpcRow[], days: number): LightningDay[] {
  return padTaipeiDaily(rows, days, (r) => r.strike_date, (dateKey, r) => ({
    dateKey,
    count: r?.event_count ?? 0,
    cloudToGround: r?.cloud_to_ground ?? null,
    maxIntensityKa: r?.max_intensity_ka ?? null,
  }));
}

/** PostgREST 對不存在的函式回 PGRST202（HTTP 404）——這類才是「RPC 還沒上線」。 */
function isMissingRpcError(error: { code?: string } | null, status: number): boolean {
  return error?.code === "PGRST202" || status === 404;
}

function clampDailyDays(daysKey: string): number {
  return Math.min(365, Math.max(1, Math.floor(Number(daysKey))));
}

async function fetchLightningDailyUncached(daysKey: string): Promise<LightningDay[]> {
  try {
    const { data, error, status } = await supabase.rpc("get_lightning_daily", {
      p_days: clampDailyDays(daysKey),
      // ⚠️ 一定要指定來源。RPC 的 p_source=null 會把 cwa 與 taipower **加總**，
      // 但兩者是同一批落雷的兩份獨立觀測，加起來等於重複計算
      // （實測 2026-08-14：cwa 2985 + taipower 2204 = 5189）。
      // 卡片的主數字（今日累計／近 1h）走的是氣象署，趨勢圖必須同口徑，
      // 否則同一張卡上下兩半的數字對不起來。台電源另有斷供問題，見檔頭。
      p_source: "cwa",
    });
    if (error) {
      if (isMissingRpcError(error, status)) {
        console.debug("[LightningDaily] get_lightning_daily 尚未上線，回空陣列:", error);
      } else {
        console.warn("[LightningDaily] get_lightning_daily 查詢失敗，回空陣列:", error);
      }
      return [];
    }
    return padLightningDaily((data ?? []) as LightningDailyRpcRow[], clampDailyDays(daysKey));
  } catch (e) {
    console.warn("[LightningDaily] get_lightning_daily 查詢例外，回空陣列:", e);
    return [];
  }
}

const fetchLightningDailyCached = cachedByKey<LightningDay[]>(
  fetchLightningDailyUncached,
  30 * 60_000, // 每日才變一次，比照 fetchErWaitTotal14d 的 30min TTL
  4,
);

/**
 * 過去 days 天逐日落雷趨勢，由舊到新；右界是資料實際回溯到的最新一天
 * （通常是昨天，不保證是今天，見檔頭錨點說明）。RPC 未上線、失敗、或
 * 聚合表全空回 []。
 */
export const fetchLightningDaily = (
  days: number = DEFAULT_LIGHTNING_DAILY_DAYS,
): Promise<LightningDay[]> => fetchLightningDailyCached(String(days));

export const invalidateLightningDaily = (): void => fetchLightningDailyCached.invalidate();

/**
 * 計算落雷在 currentTs 看到的 alpha（0~1）：
 *  - age < 0：尚未發生，alpha 0
 *  - age < fadeInSec：淡入
 *  - age < lifeSec - fadeOutSec：全顯
 *  - age < lifeSec：淡出
 *  - age ≥ lifeSec：消失
 *
 * 設計：fadeIn 短（0.4s 感覺像「閃光」），fadeOut 長（總壽命的 40%）。
 */
export function lightningAlpha(
  strikeTs: number,
  currentTs: number,
  lifeSec: number,
  fadeInSec: number = 0.4,
): number {
  const age = currentTs - strikeTs;
  if (age < 0) return 0;
  if (age >= lifeSec) return 0;
  if (age < fadeInSec) return age / fadeInSec;
  const fadeOutSec = Math.max(0.1, lifeSec * 0.4);
  const fadeOutStart = lifeSec - fadeOutSec;
  if (age < fadeOutStart) return 1;
  return Math.max(0, (lifeSec - age) / fadeOutSec);
}

/**
 * 過濾事件並組成帶 alpha 的 FC，供 hook 每 tick setData 用。
 * 跳過 alpha = 0 的，避免 source 攜帶無謂 feature。
 */
export function toLightningFCAt(
  rows: LightningStrike[],
  currentTs: number,
  lifeSec: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const r of rows) {
    const a = lightningAlpha(r.strike_ts, currentTs, lifeSec);
    if (a <= 0) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        event_id: r.event_id,
        strike_ts: r.strike_ts,
        intensity_ka: r.intensity_ka,
        strike_type: r.strike_type,
        alpha: a,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function clampMinutes(m: number): number {
  if (!Number.isFinite(m)) return 60;
  return Math.min(720, Math.max(1, Math.floor(m)));
}

/** 0=雲對地（橘紅）/ 1=雲中（青）；對應 LegendPanel 配色 */
export const LIGHTNING_TYPE_COLORS: Record<number, string> = {
  0: "#fb923c", // 雲對地（CG）
  1: "#22d3ee", // 雲中（IC）
};

export const LIGHTNING_TYPE_LABELS: Record<number, string> = {
  0: "雲對地",
  1: "雲中",
};

export function lightningTypeColor(t: number | null | undefined): string {
  if (t == null) return "#9ca3af";
  return LIGHTNING_TYPE_COLORS[t] ?? "#9ca3af";
}

/** GeoJSON FeatureCollection — overlayRegistry 用（含 cluster source） */
export function toLightningFC(rows: LightningStrike[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        event_id: r.event_id,
        strike_ts: r.strike_ts,
        intensity_ka: r.intensity_ka,
        strike_type: r.strike_type,
      },
    })),
  };
}
