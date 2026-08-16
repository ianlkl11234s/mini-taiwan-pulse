import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce, cachedByKey } from "../lib/loaderCache";

/**
 * 核安 loader（RPC 215 get_nuclear_radiation_status）
 *
 * 背景值 0.039~0.072 µSv/h（自然背景）
 * is_stale=true → 感測器離線，dose 值不可信（UI 必須區分「離線」與「真實警戒」）
 *
 * cache 5 min（CWA / AEC 寫入 ≥ 5 min interval）
 */

export interface NuclearStation {
  station_id: string;
  station_name: string;
  dose_usvh: number | null;
  is_stale: boolean;
  observed_ts: number;
  lon: number;
  lat: number;
}

async function fetchNuclearStatusUncached(): Promise<NuclearStation[]> {
  const { data, error } = await withLoading(
    "nuclear:status",
    "核安 51 站即時劑量",
    supabase.rpc("get_nuclear_radiation_status"),
  );
  if (error) throw new Error(`get_nuclear_radiation_status: ${error.message}`);
  return (data ?? []) as NuclearStation[];
}

const fetchNuclearCached = cachedOnce(fetchNuclearStatusUncached, 5 * 60_000);
export const fetchNuclearStatus = (): Promise<NuclearStation[]> => fetchNuclearCached();
export const invalidateNuclear = (): void => fetchNuclearCached.invalidate();

// ── timeline scrub（v2 Phase B+，RPC 225）─────────────────────
// 51 站每站約 5 min 一筆 measurement → 量化 ts 到最近 300s 就夠
async function fetchNuclearAtUncached(targetTs: number): Promise<NuclearStation[]> {
  const { data, error } = await withLoading(
    `nuclear:at:${targetTs}`,
    `核安 51 站 @ ${new Date(targetTs * 1000).toLocaleTimeString("zh-TW")}`,
    supabase.rpc("get_nuclear_radiation_at", { target_ts: targetTs }),
  );
  if (error) throw new Error(`get_nuclear_radiation_at: ${error.message}`);
  return (data ?? []) as NuclearStation[];
}

const fetchNuclearAtCached = cachedByKey<NuclearStation[]>(
  (key) => fetchNuclearAtUncached(Number(key)),
  5 * 60_000,
  16,
);

/** 量化 ts 到最近 300s（5min），nuclear 變化慢 cache 寬鬆 */
export function quantiseNuclearTs(ts: number): number {
  return Math.round(ts / 300) * 300;
}

export const fetchNuclearAt = (targetTs: number): Promise<NuclearStation[]> =>
  fetchNuclearAtCached(String(quantiseNuclearTs(targetTs)));

export const invalidateNuclearAt = (): void => fetchNuclearAtCached.invalidate();

// ── day preload（v2 Phase B++，RPC 227）─────────────────────
// 整天 per-station points[] 一次抓，scrub 走 client-side binary search
export interface NuclearStationSeries {
  station_id: string;
  station_name: string;
  lon: number;
  lat: number;
  /** [ts, dose] tuples 按 ts 升序，server 已 sort */
  points: [number, number | null][];
}

export interface NuclearDay {
  date_key: string;
  stations: NuclearStationSeries[];
}

// 2026-06-26：分 raw + wrapped — prefetch 走 raw（背景靜默不灌 LOADING panel）。
async function fetchNuclearDayRaw(dateKey: string): Promise<NuclearDay> {
  const { data, error } = await supabase.rpc("get_nuclear_radiation_day", { date_key: dateKey });
  if (error) throw new Error(`get_nuclear_radiation_day: ${error.message}`);
  const obj = (data ?? {}) as Partial<NuclearDay>;
  return {
    date_key: obj.date_key ?? dateKey,
    stations: obj.stations ?? [],
  };
}
const fetchNuclearDayCached = cachedByKey<NuclearDay>(
  fetchNuclearDayRaw,
  10 * 60_000,
  8, // 配合 timeline rangeDays 最高 7 + 1 spare
);
/** Foreground — 顯示 LOADING tracker。Hook 應該用這個載當前日。 */
export const fetchNuclearDay = (dateKey: string): Promise<NuclearDay> =>
  withLoading(`nuclear:day:${dateKey}`, `核安 ${dateKey} 整日`, fetchNuclearDayCached(dateKey));
/** Prefetch — 靜默，不灌 LOADING panel。與 fetchNuclearDay 共用 cache。 */
export const prefetchNuclearDay = (dateKey: string): Promise<NuclearDay> =>
  fetchNuclearDayCached(dateKey);

/**
 * 在 day 資料裡找每站「最後一筆 observed_ts ≤ targetTs」並組 FC。
 *
 * 「資料新鮮度」設計：
 *   - age_min ≤ 30：alpha 1，level 走 dose 分級
 *   - 30 < age_min ≤ 120：alpha 1，level = stale（劑量不可信）
 *   - 120 < age_min ≤ 240：fade out（alpha 1 → 0 over 120 min）
 *   - age_min > 240：站不渲染（避免整天卡 24h 前的舊資料）
 *
 * scrub 時這套讓「整天沒回報的站漸消失」而非突然跳掉。
 */
export function buildNuclearFCAt(
  day: NuclearDay | null,
  targetTs: number,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  if (!day) return { type: "FeatureCollection", features };

  for (const s of day.stations) {
    const pts = s.points;
    if (!pts || pts.length === 0) continue;
    // binary search 找最後一筆 ts <= targetTs
    let lo = 0, hi = pts.length - 1, best = -1;
    if (pts[0]![0] > targetTs) continue;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid]![0] <= targetTs) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (best < 0) continue;
    const [obsTs, dose] = pts[best]!;
    const ageSec = targetTs - obsTs;
    const ageMin = ageSec / 60;

    let alpha = 1;
    let isStale = false;
    if (ageMin > 240) continue;                       // 超過 4hr 整個 fade 完了
    if (ageMin > 120) alpha = 1 - (ageMin - 120) / 120; // 120~240 min 漸消失
    if (ageMin > 30) isStale = true;                    // 30+ min 視同離線

    const level = classifyNuclearDose(dose, isStale);

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        station_id: s.station_id,
        station_name: s.station_name,
        dose_usvh: dose,
        is_stale: isStale,
        observed_ts: obsTs,
        level,
        alpha,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * 劑量分級（µSv/h）：
 *  - normal: ≤ 0.072（自然背景上限）
 *  - watch: 0.072 ~ 0.2（略高於背景但仍安全）
 *  - warning: 0.2 ~ 0.5（持續觀察）
 *  - alarm: > 0.5（達 AEC 警戒）
 *  - stale: is_stale=true（任意劑量都歸 stale，灰色）
 *
 * 參考 AEC 即時劑量警示 0.5 µSv/h，國際 ICRP 公眾年劑量限值。
 */
export const NUCLEAR_DOSE_THRESHOLDS = {
  normal: 0.072,
  watch: 0.2,
  warning: 0.5,
} as const;

export type NuclearDoseLevel = "normal" | "watch" | "warning" | "alarm" | "stale";

export const NUCLEAR_LEVEL_COLORS: Record<NuclearDoseLevel, string> = {
  normal: "#22c55e",
  watch: "#facc15",
  warning: "#f97316",
  alarm: "#ef4444",
  stale: "#6b7280",
};

export const NUCLEAR_LEVEL_LABELS: Record<NuclearDoseLevel, string> = {
  normal: "正常",
  watch: "略高",
  warning: "觀察",
  alarm: "警戒",
  stale: "離線",
};

export function classifyNuclearDose(
  dose: number | null | undefined,
  isStale: boolean,
): NuclearDoseLevel {
  if (isStale) return "stale";
  if (dose == null) return "stale";
  if (dose <= NUCLEAR_DOSE_THRESHOLDS.normal) return "normal";
  if (dose <= NUCLEAR_DOSE_THRESHOLDS.watch) return "watch";
  if (dose <= NUCLEAR_DOSE_THRESHOLDS.warning) return "warning";
  return "alarm";
}

export function nuclearDoseColor(
  dose: number | null | undefined,
  isStale: boolean,
): string {
  return NUCLEAR_LEVEL_COLORS[classifyNuclearDose(dose, isStale)];
}

// ══════════════════════════════════════════════════════════════════
//  Monitor 輻射卡摘要（純聚合，複用 fetchNuclearStatus 的 5min 快取，不另打 DB）
// ══════════════════════════════════════════════════════════════════

export interface NuclearSummary {
  /** 有回報站的平均劑量率（µSv/h） */
  avg_usvh: number | null;
  /** 最大劑量率 + 站名 */
  max_usvh: number | null;
  max_station: string | null;
  /** 非離線且有值的站數 */
  reporting: number;
  /** 站總數 */
  total: number;
  /** 觀察站數（0.2–0.5 µSv/h，classifyNuclearDose 的 warning 級） */
  warning_count: number;
  /** 警戒站數（> 0.5 µSv/h，AEC 警示值，classifyNuclearDose 的 alarm 級） */
  alarm_count: number;
  /** 異常站列名（觀察 + 警戒，劑量降序，最多 3 站） */
  anomalies: { name: string; dose: number; level: "warning" | "alarm" }[];
}

/** 站列表 → 卡片摘要（純函式，給測試用） */
export function summariseNuclear(rows: NuclearStation[]): NuclearSummary {
  const valid = rows.filter((r) => !r.is_stale && r.dose_usvh != null);
  let sum = 0;
  let max = -Infinity;
  let maxStation: string | null = null;
  const anomalies: { name: string; dose: number; level: "warning" | "alarm" }[] = [];
  for (const r of valid) {
    const d = Number(r.dose_usvh);
    sum += d;
    if (d > max) { max = d; maxStation = r.station_name; }
    const level = classifyNuclearDose(d, false);
    if (level === "warning" || level === "alarm") {
      anomalies.push({ name: r.station_name, dose: d, level });
    }
  }
  anomalies.sort((a, b) => b.dose - a.dose);
  return {
    avg_usvh: valid.length ? sum / valid.length : null,
    max_usvh: valid.length ? max : null,
    max_station: maxStation,
    reporting: valid.length,
    total: rows.length,
    warning_count: anomalies.filter((a) => a.level === "warning").length,
    alarm_count: anomalies.filter((a) => a.level === "alarm").length,
    anomalies: anomalies.slice(0, 3),
  };
}

/** 給 Monitor 輻射卡：全國站平均 / 最大劑量率 + 異常站（沿用 classifyNuclearDose 分級） */
export async function fetchNuclearSummary(): Promise<NuclearSummary> {
  return summariseNuclear(await fetchNuclearStatus());
}

export function toNuclearFC(rows: NuclearStation[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => {
      const level = classifyNuclearDose(r.dose_usvh, r.is_stale);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: {
          station_id: r.station_id,
          station_name: r.station_name,
          dose_usvh: r.dose_usvh,
          is_stale: r.is_stale,
          observed_ts: r.observed_ts,
          level,
        },
      };
    }),
  };
}

// ══════════════════════════════════════════════════════════════════
//  Monitor 輻射卡歷史趨勢（RPC 348 get_nuclear_radiation_daily，近 N 天逐日）
// ══════════════════════════════════════════════════════════════════
//
// gis-platform migration 348 尚未 apply（待 user review）之前，PostgREST 對
// 不存在的函式回 404 / code PGRST202。這段期間卡片要安靜拿到空陣列、不在
// console 噴紅字——用 console.debug 不用 console.warn，migration apply 後
// 不用再改本檔。
//
// 補零口徑比照 lightningLoader.ts fetchLightningDaily：stationCount 缺日補
// 0（COUNT() 對空集合就是 0），meanUsvh / maxUsvh 缺日補 null（AVG()/MAX()
// 對空集合沒有意義，不該假裝成 0）—— 詳見 gis-platform migration 348 檔頭
// 「補零決策」。
//
// ⚠️ 命名為 NuclearDoseDay 而非 NuclearDay——`NuclearDay`（見本檔 77 行）
// 已被「單日全站 per-station 序列」（day preload，給 useHazardLayer.ts
// 逐幀 scrub 用）佔用，形狀完全不同（date_key/stations[] vs 本介面的
// dateKey/meanUsvh/maxUsvh/stationCount），沿用同名會撞 TS2739。
//
// ⚠️ 連續日期軸的錨點**不是** todayTaiwan()：analytics.nuclear_radiation_daily
// 的 refresh cron 只補「昨天」，today 這格在 RPC 端永遠不存在。若軸錨在
// todayTaiwan()，會把 RPC 回傳的最舊一天擠掉、同時把 today 補成一根假的
// 「今日 0 站」柱——每天都錯一格。改錨在 RPC 實際回傳的最新一筆
// reading_date（=表內 MAX(obs_date)，正常情況下就是昨天；pipeline 落後時
// 右界也會誠實跟著落後）。rows 為空（RPC 成功但聚合表全空）直接回 []，
// 比照 RPC 未上線的降級行為。

export interface NuclearDoseDay {
  /** 台北曆日 YYYY-MM-DD */
  dateKey: string;
  /** 全站平均劑量率；當日無資料時 null */
  meanUsvh: number | null;
  /** 全站最大劑量率；當日無資料時 null */
  maxUsvh: number | null;
  /** 當日有回報的站數；當日無資料時補 0 */
  stationCount: number;
}

interface NuclearDailyRpcRow {
  reading_date: string;
  mean_usvh: number | null;
  max_usvh: number | null;
  station_count: number;
}

const DEFAULT_NUCLEAR_DAILY_DAYS = 14;
const MS_PER_DAY_NUCLEAR = 86_400_000;

function taipeiMidnightMsNuclear(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00+08:00`);
}
function taipeiDateKeyFromMsNuclear(ms: number): string {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/**
 * 把 RPC 回傳（只含有資料的日期，已由舊到新排序）補成連續 days 天。
 * 右界錨在 rows 最後一筆的 reading_date（不是 todayTaiwan()，理由見檔頭）。
 */
function padNuclearDaily(rows: NuclearDailyRpcRow[], days: number): NuclearDoseDay[] {
  if (rows.length === 0) return [];
  const byDate = new Map(rows.map((r) => [r.reading_date, r]));
  const anchorMidnightMs = taipeiMidnightMsNuclear(rows[rows.length - 1]!.reading_date);
  const result: NuclearDoseDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = taipeiDateKeyFromMsNuclear(anchorMidnightMs - i * MS_PER_DAY_NUCLEAR);
    const r = byDate.get(key);
    result.push({
      dateKey: key,
      meanUsvh: r?.mean_usvh ?? null,
      maxUsvh: r?.max_usvh ?? null,
      stationCount: r?.station_count ?? 0,
    });
  }
  return result;
}

async function fetchNuclearDailyUncached(daysKey: string): Promise<NuclearDoseDay[]> {
  const days = Math.min(365, Math.max(1, Math.floor(Number(daysKey))));
  try {
    const { data, error } = await withLoading(
      `nuclear:daily:${days}`,
      `輻射近 ${days} 天趨勢`,
      supabase.rpc("get_nuclear_radiation_daily", { p_days: days }),
    );
    if (error) throw error;
    return padNuclearDaily((data ?? []) as NuclearDailyRpcRow[], days);
  } catch (e) {
    console.debug("[NuclearDaily] get_nuclear_radiation_daily 尚未上線或失敗，回空陣列:", e);
    return [];
  }
}

const fetchNuclearDailyCached = cachedByKey<NuclearDoseDay[]>(
  fetchNuclearDailyUncached,
  30 * 60_000, // 每日才變一次，比照 fetchErWaitTotal14d 的 30min TTL
  4,
);

/**
 * 過去 days 天逐日輻射趨勢，由舊到新；右界是資料實際回溯到的最新一天
 * （通常是昨天，不保證是今天，見檔頭錨點說明）。RPC 未上線、失敗、或
 * 聚合表全空回 []。
 */
export const fetchNuclearDaily = (
  days: number = DEFAULT_NUCLEAR_DAILY_DAYS,
): Promise<NuclearDoseDay[]> => fetchNuclearDailyCached(String(days));

export const invalidateNuclearDaily = (): void => fetchNuclearDailyCached.invalidate();
