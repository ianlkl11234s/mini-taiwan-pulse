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
import { cachedOnce, keyedThunkCache } from "../lib/loaderCache";
import type { DisasterAlert } from "./disasterAlertLoader";
import { alertGroupOf, EXCLUDED_TERMS } from "./disasterAlertTypes";
import { MAP_GROUP_TO_SHORT } from "./alertRules";
import {
  ALERT_GROUP_ORDER,
  COUNTY_OPTIONS,
  type AlertGroupShort,
} from "../components/intel/intelTokens";

// TTL：略短於 polling interval 讓雙 panel 共享 fetch；series_24h 拉到 5min（資料源是分鐘聚合，人眼無感差）。
const TTL_FAST = 25_000;
const TTL_SERIES = 5 * 60_000;

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

// ─── county 正規化 ────────────────────────────────────────
// migration 211 的地震分支是 `COALESCE(NULLIF(location_desc,''),'全國') AS county`
// —— 上游 `realtime.earthquake_events` 根本沒有 county 欄，回來的是整串**震央描述**
// （例「臺東縣政府南南西方 37.3 公里 (位於臺東縣近海)」），跟 headline 同字串。
// 屬 RPC 的命名選擇而非資料缺陷，故在前端解析出縣市即可，不動 SQL。
const COUNTY_NAMES = COUNTY_OPTIONS.filter((c) => c !== "全部" && c !== "全國");

/** 找出字串中最先出現的縣市全名（台/臺 都吃），找不到回 null */
function firstCountyIn(text: string): string | null {
  const t = text.replace(/台/g, "臺");
  let best: string | null = null;
  let bestAt = Infinity;
  for (const c of COUNTY_NAMES) {
    const at = t.indexOf(c);
    if (at >= 0 && at < bestAt) {
      bestAt = at;
      best = c;
    }
  }
  return best;
}

/**
 * 震央描述 → 縣市。
 * 先取括號內的「(位於臺東縣近海)」—— 「X縣政府方位」的基準縣市未必等於震央所在縣；
 * 括號抓不到才退回整串的第一個縣市名，再不行留原字串（防禦性：寧可長也不要空）。
 */
function countyFromLocationDesc(raw: string): string {
  const inside = raw.match(/[（(]([^）)]*)[）)]/);
  if (inside?.[1]) {
    const hit = firstCountyIn(inside[1]);
    if (hit) return hit;
  }
  return firstCountyIn(raw) ?? raw;
}

function normalizeCounty(raw: string | null | undefined, group: AlertGroupShort): string {
  // NCDR 列常帶尾空白（split_part(area_desc,'/',1) 的產物）
  const t = (raw ?? "").trim();
  if (!t) return "全國";
  return group === "earthquake" ? countyFromLocationDesc(t) : t;
}

async function _fetchAlertSummaryRaw(): Promise<AlertSummary[]> {
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
export const fetchAlertSummary = cachedOnce(_fetchAlertSummaryRaw, TTL_FAST);

async function _fetchActiveAlertsRaw(
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
          county: normalizeCounty(r.county, g),
        };
      })
      .filter((x): x is ActiveAlert => x !== null);
  } catch (err) {
    console.warn("[alertsLoader] fetchActiveAlerts failed:", err);
    return [];
  }
}
const _activeAlertsCache = keyedThunkCache<ActiveAlert[]>(TTL_FAST);
export function fetchActiveAlerts(
  group?: AlertGroupShort | null,
  severityMin: number = 1,
): Promise<ActiveAlert[]> {
  return _activeAlertsCache(
    `${group ?? "*"}|${severityMin}`,
    () => _fetchActiveAlertsRaw(group, severityMin),
  );
}

async function _fetchAlertSeries24hRaw(): Promise<AlertSeriesPoint[]> {
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
export const fetchAlertSeries24h = cachedOnce(_fetchAlertSeries24hRaw, TTL_SERIES);

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

// ─── 歷史檢索 ────────────────────────────────────────────
// `get_active_alerts` 只回「現在還生效」的，看不到過去。要看某一天的示警，
// 直接重用地圖那支按日 RPC（`get_disaster_alerts_day`，已有 loadingRegistry
// 與 10min 快取），把列轉成 AlertCard 吃的形狀 —— 不必新開 RPC/migration。
//
// 已知落差：該 RPC 是 NCDR 示警表，**不含地震**（地震在 realtime.earthquake_events，
// 且 disasterAlertTypes 的 EXCLUDED_TERMS 也把它排除）。UI 需標明。

/** area_desc 取第一段（同 migration 211 的 split_part(ad,'/',1)） */
function areaHeadCounty(areaDesc: string): string {
  const head = areaDesc.split("/")[0]?.trim() ?? "";
  return head || "全國";
}

/** 「幾區」估算，同 migration 211 的算法 */
function countAreas(areaDesc: string): number {
  if (!areaDesc) return 0;
  return areaDesc.split("、").length + areaDesc.split("/").length - 1;
}

const SEVERITY_RANK: Record<string, number> = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
};

/** 某一天的 NCDR 示警（地圖用的按日資料）→ AlertCard 形狀，依發布時間新到舊 */
export function dayAlertsToCards(rows: DisasterAlert[]): ActiveAlert[] {
  const out: ActiveAlert[] = [];
  for (const r of rows) {
    const term = r.event_term ?? r.event ?? "災害示警";
    if (EXCLUDED_TERMS.has(term)) continue;
    const area = r.area_desc ?? "";
    out.push({
      id: r.identifier,
      group: MAP_GROUP_TO_SHORT[alertGroupOf(r.event_term)],
      term,
      severity: SEVERITY_RANK[r.severity ?? ""] ?? 1,
      urgency: (r.urgency ?? "unknown").toLowerCase(),
      headline: r.headline ?? r.event ?? "",
      area_desc: area,
      area_count: countAreas(area),
      sent_ts: r.start_ts,
      expires_ts: r.end_ts,
      description: r.description,
      instruction: r.instruction,
      magnitude: null,
      depth_km: null,
      occurred_ts: null,
      county: areaHeadCounty(area),
    });
  }
  out.sort((a, b) => b.sent_ts - a.sent_ts);
  return out;
}

export function emptySeries(): Record<AlertGroupShort, number[]> {
  const out = {} as Record<AlertGroupShort, number[]>;
  for (const g of ALERT_GROUP_ORDER) {
    out[g] = Array.from({ length: 24 }, () => 0);
  }
  return out;
}
