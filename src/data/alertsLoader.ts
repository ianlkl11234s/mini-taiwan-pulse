/**
 * Alerts Loader — 警訊整合（NCDR 災害示警 + CWA 地震）
 *
 * 後端：gis-platform migration 211 的 3 RPC
 *   - get_alert_summary()
 *   - get_active_alerts(p_group, p_severity_min)
 *   - get_alert_series_24h()
 *
 * 群組短形 key：earthquake / weather / flood / transit / lifeline / safety
 */

import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import {
  ALERT_GROUP_ORDER,
  type AlertGroupShort,
} from "../components/intel/intelTokens";

export interface AlertSummary {
  group: AlertGroupShort;
  count: number;
  severe: number;
  top_term: string | null;
  sev_minor: number;
  sev_moderate: number;
  sev_severe: number;
  sev_extreme: number;
}

export interface ActiveAlert {
  id: string;
  group: AlertGroupShort;
  term: string;
  severity: number;      // 1-4
  urgency: string;
  headline: string;
  area_desc: string;
  area_count: number;
  sent_ts: number;
  expires_ts: number;
  description: string | null;
  instruction: string | null;
  magnitude: number | null;
  depth_km: number | null;
  occurred_ts: number | null;
  county: string;
}

export interface AlertSeriesPoint {
  group: AlertGroupShort;
  h: number;
  count: number;
}

interface SummaryRaw {
  group: string;
  count: number;
  severe: number;
  top_term: string | null;
  sev_minor: number;
  sev_moderate: number;
  sev_severe: number;
  sev_extreme: number;
}

interface ActiveRaw {
  id: string;
  group: string;
  term: string;
  severity: number;
  urgency: string;
  headline: string;
  area_desc: string;
  area_count: number;
  sent_ts: number | string;
  expires_ts: number | string;
  description: string | null;
  instruction: string | null;
  magnitude: number | null;
  depth_km: number | null;
  occurred_ts: number | string | null;
  county: string;
}

interface SeriesRaw {
  group: string;
  h: number;
  count: number;
}

const VALID_GROUPS = new Set<string>(ALERT_GROUP_ORDER);

function asGroup(s: string): AlertGroupShort | null {
  return VALID_GROUPS.has(s) ? (s as AlertGroupShort) : null;
}

function asNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

export async function fetchAlertSummary(): Promise<AlertSummary[]> {
  try {
    const { data, error } = await withLoading(
      "alert-summary",
      "警報摘要",
      supabase.rpc("get_alert_summary"),
    );
    if (error) throw error;
    const rows = (data ?? []) as SummaryRaw[];
    return rows
      .map((r): AlertSummary | null => {
        const g = asGroup(r.group);
        if (!g) return null;
        return {
          group: g,
          count: r.count ?? 0,
          severe: r.severe ?? 0,
          top_term: r.top_term ?? null,
          sev_minor: r.sev_minor ?? 0,
          sev_moderate: r.sev_moderate ?? 0,
          sev_severe: r.sev_severe ?? 0,
          sev_extreme: r.sev_extreme ?? 0,
        };
      })
      .filter((x): x is AlertSummary => x !== null);
  } catch (err) {
    console.warn("[alertsLoader] fetchAlertSummary failed:", err);
    return [];
  }
}

export async function fetchActiveAlerts(
  group?: AlertGroupShort | null,
  severityMin: number = 1,
): Promise<ActiveAlert[]> {
  try {
    const key = `alert-list:${group ?? "all"}:${severityMin}`;
    const label = group
      ? `警報細節 ${group}`
      : "警報細節";
    const { data, error } = await withLoading(
      key,
      label,
      supabase.rpc("get_active_alerts", {
        p_group: group ?? null,
        p_severity_min: severityMin,
      }),
    );
    if (error) throw error;
    const rows = (data ?? []) as ActiveRaw[];
    return rows
      .map((r): ActiveAlert | null => {
        const g = asGroup(r.group);
        if (!g) return null;
        return {
          id: String(r.id),
          group: g,
          term: r.term ?? "",
          severity: Math.max(1, Math.min(4, r.severity ?? 1)),
          urgency: r.urgency ?? "unknown",
          headline: r.headline ?? "",
          area_desc: r.area_desc ?? "",
          area_count: r.area_count ?? 0,
          sent_ts: asNum(r.sent_ts),
          expires_ts: asNum(r.expires_ts),
          description: r.description,
          instruction: r.instruction,
          magnitude: r.magnitude == null ? null : Number(r.magnitude),
          depth_km: r.depth_km == null ? null : Number(r.depth_km),
          occurred_ts: r.occurred_ts == null ? null : asNum(r.occurred_ts),
          county: r.county ?? "全國",
        };
      })
      .filter((x): x is ActiveAlert => x !== null);
  } catch (err) {
    console.warn("[alertsLoader] fetchActiveAlerts failed:", err);
    return [];
  }
}

export async function fetchAlertSeries24h(): Promise<AlertSeriesPoint[]> {
  try {
    const { data, error } = await withLoading(
      "alert-series-24h",
      "警報 24h",
      supabase.rpc("get_alert_series_24h"),
    );
    if (error) throw error;
    const rows = (data ?? []) as SeriesRaw[];
    return rows
      .map((r): AlertSeriesPoint | null => {
        const g = asGroup(r.group);
        if (!g) return null;
        return { group: g, h: r.h, count: r.count ?? 0 };
      })
      .filter((x): x is AlertSeriesPoint => x !== null);
  } catch (err) {
    console.warn("[alertsLoader] fetchAlertSeries24h failed:", err);
    return [];
  }
}

// ─── helpers ──────────────────────────────────────────────

export function indexSummary(
  rows: AlertSummary[],
): Map<AlertGroupShort, AlertSummary> {
  const m = new Map<AlertGroupShort, AlertSummary>();
  for (const r of rows) m.set(r.group, r);
  return m;
}

export function indexSeries(
  rows: AlertSeriesPoint[],
): Record<AlertGroupShort, number[]> {
  const out = {} as Record<AlertGroupShort, number[]>;
  for (const g of ALERT_GROUP_ORDER) {
    out[g] = Array.from({ length: 24 }, () => 0);
  }
  for (const r of rows) {
    if (r.h < 0 || r.h > 23) continue;
    out[r.group][r.h] = r.count;
  }
  return out;
}

export interface AlertTally {
  total: number;
  severe: number;
  byGroup: Map<AlertGroupShort, AlertSummary>;
}

export function tallySummary(rows: AlertSummary[]): AlertTally {
  let total = 0;
  let severe = 0;
  const byGroup = new Map<AlertGroupShort, AlertSummary>();
  for (const r of rows) {
    total += r.count;
    severe += r.severe;
    byGroup.set(r.group, r);
  }
  return { total, severe, byGroup };
}

export const EMPTY_TALLY: AlertTally = {
  total: 0,
  severe: 0,
  byGroup: new Map(),
};

export function emptySeries(): Record<AlertGroupShort, number[]> {
  const out = {} as Record<AlertGroupShort, number[]>;
  for (const g of ALERT_GROUP_ORDER) {
    out[g] = Array.from({ length: 24 }, () => 0);
  }
  return out;
}
