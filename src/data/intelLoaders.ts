/**
 * Intel Panel — Supabase loader（來源健康 + 升溫排行）
 *
 * 對應 migration 167 (get_source_health) + 166 (get_news_trending)
 */
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

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

export async function fetchSourceHealth(): Promise<SourceHealthSummary> {
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

// ── Trending（升溫）─────────────────────────────────────────────

export interface TrendingRow {
  county: string;
  category: string;
  cnt: number;
  baseline_avg: number;
  surge_ratio: number | null;
}

export async function fetchNewsTrending(
  windowHours = 1,
  limit = 30,
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
