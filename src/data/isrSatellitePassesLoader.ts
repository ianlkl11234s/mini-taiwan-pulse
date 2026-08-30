import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { keyedThunkCache } from "../lib/loaderCache";

export const ISR_PASSES_DEFAULT_DAYS = 30;
export const ISR_PASSES_MAX_DAYS = 31;
export const ISR_PASSES_DEFAULT_REGION = "twmain_12nm";
export const ISR_PASSES_DEFAULT_TIER_MODE = "confirmed_plus_dual_use";

export type IsrPassTierMode =
  | "confirmed_only"
  | "confirmed_plus_dual_use"
  | "all_non_excluded";

export type IsrPassFreshness = "fresh" | "stale" | "unknown";

export interface IsrSatellitePassDay {
  /** Asia/Taipei 日界，YYYY-MM-DD */
  day: string;
  /** 同一顆衛星同日可多次穿越；null = 未知，不得補 0 */
  passCount: number | null;
  /** 當日有穿越的 distinct NORAD_CAT_ID；null = 未知，不得補 0 */
  uniqueSatelliteCount: number | null;
  /** RPC partial coverage 訊號；false 不等於無資料 */
  coverageComplete: boolean;
}

export interface IsrSatellitePassReport {
  rows: IsrSatellitePassDay[];
  latestValidDay: string | null;
  computedAt: string | null;
  registryReviewedAt: string | null;
  /** v1 registry（YAOGAN / GAOFEN / JILIN）內的分母是否完整 */
  scopeCoverageComplete: boolean | null;
  /** 是否聲稱涵蓋全中國 ISR census；v1 預期為 false */
  chinaIsrCensusComplete: boolean | null;
  /** 結果集 coverage 訊號；false 時仍可有可呈現的 partial registry counts */
  coverageComplete: boolean | null;
  freshness: IsrPassFreshness;
  regionKey: string;
  tierMode: IsrPassTierMode;
}

const CACHE_TTL_MS = 30 * 60_000;
const cache = keyedThunkCache<IsrSatellitePassReport>(CACHE_TTL_MS);

function dateString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function timestampString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

function nonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function freshness(value: unknown): IsrPassFreshness {
  if (value === "fresh") return "fresh";
  if (value === "stale") return "stale";
  return "unknown";
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function tierModeOrFallback(value: unknown, fallback: IsrPassTierMode): IsrPassTierMode {
  return value === "confirmed_only"
    || value === "confirmed_plus_dual_use"
    || value === "all_non_excluded"
    ? value
    : fallback;
}

export function normalizeIsrPassDays(days: number): number {
  return Number.isInteger(days) && days > 0
    ? Math.min(days, ISR_PASSES_MAX_DAYS)
    : ISR_PASSES_DEFAULT_DAYS;
}

/** 每日批次：計算時間 36h 內且最近完整日距今不超過 48h 才視為 fresh。 */
export function deriveIsrPassFreshness(
  latestValidDay: string | null,
  computedAt: string | null,
  nowMs = Date.now(),
): IsrPassFreshness {
  if (!latestValidDay || !computedAt) return "unknown";
  const computedMs = Date.parse(computedAt);
  const validDayEndMs = Date.parse(`${latestValidDay}T23:59:59+08:00`);
  if (!Number.isFinite(computedMs) || !Number.isFinite(validDayEndMs)) return "unknown";
  const computedAge = nowMs - computedMs;
  const validDayAge = nowMs - validDayEndMs;
  return computedAge <= 36 * 60 * 60_000 && validDayAge <= 48 * 60 * 60_000
    ? "fresh"
    : "stale";
}

function firstParsed<T>(
  rows: Record<string, unknown>[],
  parser: (value: unknown) => T | null,
  field: string,
): T | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const parsed = parser(rows[i]?.[field]);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * RPC envelope 正規化。缺欄、壞數字與不完整 coverage 一律保留為 unknown/null，
 * 絕不把異常資料默默變成 0。
 */
export function parseIsrSatellitePassReport(
  data: unknown,
  regionKey = ISR_PASSES_DEFAULT_REGION,
  tierMode: IsrPassTierMode = ISR_PASSES_DEFAULT_TIER_MODE,
  nowMs = Date.now(),
): IsrSatellitePassReport {
  const rawRows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];

  const rows = rawRows
    .map<IsrSatellitePassDay | null>((row) => {
      const day = dateString(row.target_day);
      if (!day) return null;
      return {
        day,
        passCount: nonNegativeInt(row.pass_count),
        uniqueSatelliteCount: nonNegativeInt(row.unique_satellite_count),
        coverageComplete: row.coverage_complete === true,
      };
    })
    .filter((row): row is IsrSatellitePassDay => row !== null)
    .sort((a, b) => a.day.localeCompare(b.day));

  const latestValidDay = firstParsed(rawRows, dateString, "latest_valid_day");
  const computedAt = firstParsed(rawRows, timestampString, "computed_at")
    ?? firstParsed(rawRows, timestampString, "refreshed_at");
  const registryReviewedAt = firstParsed(rawRows, timestampString, "registry_reviewed_at");
  const freshnessRaw = [...rawRows].reverse().find((row) => row.freshness != null)?.freshness;
  const parsedFreshness = freshness(freshnessRaw);
  const latestRaw = latestValidDay
    ? rawRows.find((row) => row.target_day === latestValidDay)
    : rawRows[rawRows.length - 1];
  const coverageComplete = latestRaw && typeof latestRaw.coverage_complete === "boolean"
    ? latestRaw.coverage_complete
    : null;

  return {
    rows,
    latestValidDay,
    computedAt,
    registryReviewedAt,
    scopeCoverageComplete: booleanOrNull(latestRaw?.scope_coverage_complete),
    chinaIsrCensusComplete: booleanOrNull(latestRaw?.china_isr_census_complete),
    coverageComplete,
    freshness: parsedFreshness === "unknown"
      ? deriveIsrPassFreshness(latestValidDay, computedAt, nowMs)
      : parsedFreshness,
    regionKey: String(latestRaw?.region_key ?? regionKey),
    tierMode: tierModeOrFallback(latestRaw?.tier_mode, tierMode),
  };
}

export function hasIsrPassCounts(
  row: IsrSatellitePassDay | null | undefined,
): row is IsrSatellitePassDay & { passCount: number; uniqueSatelliteCount: number } {
  return Boolean(row && row.passCount !== null && row.uniqueSatelliteCount !== null);
}

async function fetchUncached(
  days: number,
  regionKey: string,
  tierMode: IsrPassTierMode,
): Promise<IsrSatellitePassReport> {
  if (!supabaseConfigured) throw new Error("Supabase 尚未設定");
  const { data, error } = await withLoading(
    `monitor:isr-passes:${regionKey}:${tierMode}:${days}`,
    "中國 ISR 衛星領海過境",
    supabase.rpc("get_isr_satellite_passes_daily", {
      p_days: days,
      p_region_key: regionKey,
      p_tier_mode: tierMode,
    }),
  );
  if (error) throw new Error(`get_isr_satellite_passes_daily: ${error.message}`);
  return parseIsrSatellitePassReport(data, regionKey, tierMode);
}

export function fetchIsrSatellitePassesDaily(
  days = ISR_PASSES_DEFAULT_DAYS,
  regionKey = ISR_PASSES_DEFAULT_REGION,
  tierMode: IsrPassTierMode = ISR_PASSES_DEFAULT_TIER_MODE,
): Promise<IsrSatellitePassReport> {
  const safeDays = normalizeIsrPassDays(days);
  const key = `${safeDays}|${regionKey}|${tierMode}`;
  return cache(key, () => fetchUncached(safeDays, regionKey, tierMode));
}
