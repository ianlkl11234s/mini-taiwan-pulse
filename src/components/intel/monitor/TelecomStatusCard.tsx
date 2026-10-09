/**
 * RIPE NCC 臺灣網路觀察卡。
 *
 * Atlas / RIS 都屬同一個 RIPE NCC dependency group；這裡只呈現量測與歷史，
 * 不把單一來源的漂亮數字推導成「臺灣網路正常」，也不建立任何推測 geometry。
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { FONT_CJK, FONT_DATA, relTime, withAlpha } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchInternetHealthStatus,
  fetchInternetHealthTimeline,
  type InternetHealthMeasurement,
  type InternetHealthMeasurementSignal,
  type InternetHealthSummary,
  type InternetHealthTimelineMetric,
  type InternetHealthTimelineRange,
  type InternetHealthTimelineSource,
  type InternetHealthTimelineSummary,
} from "../../../data/internetHealthLoader";
import { useMonitorResource } from "../../../hooks/useMonitorResource";
import { MonitorDataStatus } from "./MonitorDataStatus";
import { useMonitorV2 } from "./monitorStyle";
import { fs, MF } from "./monitorFont";
import { useMonitorTheme } from "./monitorTheme";
import { MonitorMetric, MonitorNote, MonitorRows, MonitorSub } from "./MonitorMetric";
import { useMonitorFreshness, type MonitorFreshness } from "./monitorFreshness";

export type InternetHealthPhase = "loading" | "ready" | "error";
type TimelinePhase = "loading" | "ready" | "error";

const RIPE_CYAN = "#22d3ee";
const IPV6_VIOLET = "#a78bfa";

function timeLabel(iso: string | null, nowTs: number): string {
  if (!iso) return "—";
  const ts = Math.floor(Date.parse(iso) / 1000);
  return Number.isFinite(ts) ? relTime(ts, nowTs) : "—";
}

function unixTimeLabel(ts: number | null, nowTs: number): string {
  return ts == null ? "—" : relTime(ts, nowTs);
}

function newestMeasurementAt(measurements: InternetHealthMeasurement[]): string | null {
  const timestamps = measurements
    .map((item) => item.source_updated_at)
    .filter((value): value is string => value != null && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return timestamps[0] ?? null;
}

const MEASUREMENT_LABELS: Record<InternetHealthMeasurementSignal, string> = {
  probe_connectivity_ratio_ipv4: "Probe 回報率",
  probe_connectivity_ratio_ipv6: "Probe 回報率",
  ping_success_ratio_ipv4: "Ping 成功率",
  ping_success_ratio_ipv6: "Ping 成功率",
  median_rtt_ms_ipv4: "中位 RTT",
  median_rtt_ms_ipv6: "中位 RTT",
  reachable_asn_ratio_ipv4: "可達 ASN 比率",
  reachable_asn_ratio_ipv6: "可達 ASN 比率",
  prefix_visibility_ratio_ipv4: "Prefix 可見度",
  prefix_visibility_ratio_ipv6: "Prefix 可見度",
  withdrawn_prefix_ratio_ipv4: "撤回 Prefix 比率",
  withdrawn_prefix_ratio_ipv6: "撤回 Prefix 比率",
  origin_change_count_ipv4: "Origin 變更",
  origin_change_count_ipv6: "Origin 變更",
};

const ATLAS_SIGNALS: InternetHealthMeasurementSignal[] = [
  "ping_success_ratio_ipv4", "ping_success_ratio_ipv6",
  "median_rtt_ms_ipv4", "median_rtt_ms_ipv6",
  "probe_connectivity_ratio_ipv4", "probe_connectivity_ratio_ipv6",
  "reachable_asn_ratio_ipv4", "reachable_asn_ratio_ipv6",
];

const RIS_SIGNALS: InternetHealthMeasurementSignal[] = [
  "prefix_visibility_ratio_ipv4", "prefix_visibility_ratio_ipv6",
  "withdrawn_prefix_ratio_ipv4", "withdrawn_prefix_ratio_ipv6",
  "origin_change_count_ipv4", "origin_change_count_ipv6",
];

function measurementValue(measurement: InternetHealthMeasurement | undefined): string {
  if (!measurement || measurement.value == null) return "—";
  if (measurement.unit === "ratio") return `${(measurement.value * 100).toFixed(1)}%`;
  if (measurement.unit === "milliseconds") return `${measurement.value.toFixed(1)} ms`;
  return measurement.value.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

function measurementSampleLabel(measurement: InternetHealthMeasurement): string {
  const count = measurement.sample_count?.toLocaleString("zh-TW") ?? "—";
  if (measurement.source_key === "ripe_ris") return `BGP messages=${count}`;
  if (measurement.signal.startsWith("reachable_asn_ratio_")) return `ASNs=${count}`;
  if (measurement.signal.startsWith("median_rtt_ms_")) return `RTT samples=${count}`;
  return `probes=${count}`;
}

function measurementStateLabel(measurement: InternetHealthMeasurement | undefined): string | null {
  if (!measurement) return null;
  if (measurement.state === "baseline_building") return "RIB 基準建立中";
  if (measurement.state === "partial") return "PARTIAL";
  if (measurement.state === "unavailable" || measurement.state === "missing") return "UNAVAILABLE";
  return null;
}

/** v2 中文狀態字（舊版維持英文大寫） */
const FRESHNESS_ZH: Record<string, string> = { fresh: "即時", stale: "過期", unavailable: "無法取得" };
const CONFIDENCE_ZH: Record<string, string> = { low: "低", medium: "中", high: "高" };

function measurementSampleLabelZh(measurement: InternetHealthMeasurement): string {
  const count = measurement.sample_count?.toLocaleString("zh-TW") ?? "—";
  if (measurement.source_key === "ripe_ris") return `BGP 訊息 ${count}`;
  if (measurement.signal.startsWith("reachable_asn_ratio_")) return `ASN ${count}`;
  if (measurement.signal.startsWith("median_rtt_ms_")) return `RTT 樣本 ${count}`;
  return `探針 ${count}`;
}

/** v2 中文字在等寬（FONT_DATA）節點內用 CJK 字體 */
const Zh = ({ children }: { children: ReactNode }) => <span style={{ fontFamily: FONT_CJK }}>{children}</span>;

function MeasurementCard({
  title, subtitle, sourceKey, measurements, signals, nowTs,
}: {
  title: string;
  subtitle: string;
  sourceKey: "ripe_atlas" | "ripe_ris";
  measurements: InternetHealthMeasurement[];
  signals: InternetHealthMeasurementSignal[];
  nowTs: number;
}) {
  const theme = useMonitorTheme();
  const current = measurements.filter((item) => item.freshness === "fresh").length;
  const hasPartial = measurements.some((item) => item.state === "partial");
  const hasBaseline = measurements.some((item) => item.state === "baseline_building");
  const hasStale = measurements.some((item) => item.freshness === "stale");
  const freshness = current > 0 ? "CURRENT"
    : hasPartial ? "PARTIAL"
      : hasBaseline ? "BASELINE"
        : hasStale ? "STALE"
          : measurements.length > 0 ? "UNAVAILABLE" : "NO DATA";
  const pairs = signals.filter((_, index) => index % 2 === 0);
  const v2 = useMonitorV2();
  const freshnessZh = current > 0 ? "即時"
    : hasPartial ? "部分"
      : hasBaseline ? "基準建立中"
        : hasStale ? "過期"
          : measurements.length > 0 ? "無法取得" : "無資料";
  const stateLabel = (m: InternetHealthMeasurement | undefined) => {
    const label = measurementStateLabel(m);
    if (!v2) return label;
    return label === "PARTIAL" ? "部分" : label === "UNAVAILABLE" ? "無法取得" : label;
  };

  return (
    <div
      data-testid={`internet-health-measurements-${sourceKey}`}
      style={{
        minWidth: 0, padding: "11px 12px", borderRadius: RADIUS.xl,
        border: `1px solid ${theme.p.borderMid}`, background: theme.isDark ? "rgba(2,8,23,0.32)" : theme.neutral(0.03),
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span>
          <b style={{ display: "block", fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textDefault }}>{title}</b>
          <span style={{ display: "block", marginTop: 2, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>{subtitle}</span>
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: current > 0 ? theme.text(RIPE_CYAN) : theme.p.textDim, letterSpacing: "0.8px" }}>{v2 ? freshnessZh : freshness}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: v2 ? "minmax(112px, 1.2fr) repeat(2, minmax(86px, 1fr))" : "minmax(94px, 1.2fr) repeat(2, minmax(70px, 1fr))", gap: "5px 8px", marginTop: 10 }}>
        <span />
        {([4, 6] as const).map((family) => (
          <span key={family} style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textDim }}>IPv{family}</span>
        ))}
        {pairs.map((signal) => {
          const base = signal.replace(/_ipv4$/, "");
          const ipv4 = measurements.find((item) => item.signal === `${base}_ipv4`);
          const ipv6 = measurements.find((item) => item.signal === `${base}_ipv6`);
          return [
            <span key={`${base}-label`} style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textMuted }}>{MEASUREMENT_LABELS[signal]}</span>,
            ...([ipv4, ipv6] as const).map((measurement, index) => (
              <span key={`${base}-${index}`} style={{ minWidth: 0 }}>
                <b style={{ display: "block", fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.sm), color: measurement?.freshness === "stale" ? theme.p.textFaint : theme.p.textDefault }}>
                  {measurementValue(measurement)}
                </b>
                {stateLabel(measurement) && (
                  <span style={{ display: "block", fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.statusWarn }}>
                    {stateLabel(measurement)}
                  </span>
                )}
                <span style={{ display: "block", fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>
                  {measurement
                    ? v2
                      ? `${FRESHNESS_ZH[measurement.freshness] ?? measurement.freshness} · ${measurementSampleLabelZh(measurement)}`
                      : `${measurement.freshness.toUpperCase()} · ${measurementSampleLabel(measurement)}`
                    : "—"}
                </span>
                {measurement && (
                  <span style={{ display: "block", fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>
                    {timeLabel(measurement.source_updated_at, nowTs)}
                    {v2
                      ? (CONFIDENCE_ZH[measurement.confidence] ? ` · 信心${CONFIDENCE_ZH[measurement.confidence]}` : "")
                      : ` · confidence ${measurement.confidence}`}
                  </span>
                )}
              </span>
            )),
          ];
        })}
      </div>
    </div>
  );
}

const RANGE_LABELS: Record<InternetHealthTimelineRange, string> = { "24h": "24H", "7d": "7D", "30d": "30D" };

const SOURCE_LABELS: Record<InternetHealthTimelineSource, string> = {
  ripe_atlas: "RIPE Atlas",
  ripe_ris: "RIPE RIS Live",
};

const METRIC_OPTIONS: Record<InternetHealthTimelineSource, { value: InternetHealthTimelineMetric; label: string }[]> = {
  ripe_atlas: [
    { value: "ping_success_ratio", label: "Ping 成功率" },
    { value: "median_rtt_ms", label: "中位 RTT" },
    { value: "probe_connectivity_ratio", label: "Probe 回報率" },
    { value: "reachable_asn_ratio", label: "可達 ASN 比率" },
  ],
  ripe_ris: [
    { value: "prefix_visibility_ratio", label: "Prefix 可見度" },
    { value: "withdrawn_prefix_ratio", label: "撤回 Prefix 比率" },
    { value: "origin_change_count", label: "Origin 變更" },
  ],
};

function chartUnit(summary: InternetHealthTimelineSummary): string {
  if (summary.unit === "ratio") return "%";
  if (summary.unit === "milliseconds") return "ms";
  return "次";
}

export function toSparkline(summary: InternetHealthTimelineSummary, family: 4 | 6, mask?: CompleteMask | null): SparklinePoint[] {
  const series = family === 4 ? summary.ipv4 : summary.ipv6;
  const ratio = summary.unit === "ratio";
  return series.points.flatMap((point) => (
    point.state === "ready" && point.value != null && (!mask || mask[family].has(point.at))
      ? [{ t: point.at, v: ratio ? point.value * 100 : point.value }]
      : []
  ));
}

/*
 * 殘缺桶（v2，docs/features/monitor-restyle/internet-health-reading.md §2）：
 * collector 回看窗切在桶中間＋無條件覆寫，多數 5 分鐘桶只剩桶尾約 1.6 分鐘的探針。
 * 判定只看「回報探針數」（ping_success／probe_connectivity 的 sample_count）；
 * RTT 樣本數與成功 ASN 數在真實斷線時也會下降，不能拿來判斷，否則會把真的異常藏掉。
 * 預期探針數優先用該桶自己的 `metadata.expected_probe_count`（collector 逐桶寫入）；
 * 缺值時退回 roster 2026-08-31.1 的寫死值（IPv4 約 79、IPv6 約 39 支有回報）。低於 80% 視為殘缺。
 * 只套在 5 分鐘原值（24H）；7D／30D 是多桶加權，拿不到逐桶探針數，無法逐桶篩。
 */
const ATLAS_EXPECTED_PROBES: Record<4 | 6, number> = { 4: 79, 6: 39 };
const COMPLETE_PROBE_RATIO = 0.8;
const RAW_BUCKET_SECONDS = 300;

export function isCompleteProbeCount(
  family: 4 | 6,
  count: number | null | undefined,
  expected?: number | null,
): boolean {
  const base = expected != null && expected > 0 ? expected : ATLAS_EXPECTED_PROBES[family];
  return count != null && count >= COMPLETE_PROBE_RATIO * base;
}

type AtlasMetric = "ping_success_ratio" | "median_rtt_ms" | "probe_connectivity_ratio" | "reachable_asn_ratio";
const ATLAS_METRICS: AtlasMetric[] = ["ping_success_ratio", "median_rtt_ms", "probe_connectivity_ratio", "reachable_asn_ratio"];
const PROBE_COUNT_METRICS: InternetHealthTimelineMetric[] = ["ping_success_ratio", "probe_connectivity_ratio"];
export type AtlasDaySummaries = Partial<Record<AtlasMetric, InternetHealthTimelineSummary | null>>;
/** 每個 AF 的完整桶時間（point.at＝桶結束時間） */
export type CompleteMask = Record<4 | 6, Set<number>>;

export function completeMaskFrom(summary: InternetHealthTimelineSummary | null | undefined): CompleteMask | null {
  if (!summary || summary.bucketSeconds !== RAW_BUCKET_SECONDS || !PROBE_COUNT_METRICS.includes(summary.metric)) return null;
  const mask: CompleteMask = { 4: new Set(), 6: new Set() };
  for (const family of [4, 6] as const) {
    for (const point of (family === 4 ? summary.ipv4 : summary.ipv6).points) {
      if (point.state === "ready" && isCompleteProbeCount(family, point.sampleCount, point.expectedProbeCount)) mask[family].add(point.at);
    }
  }
  return mask;
}

const HOUR_SECONDS = 3600;
/** 每小時一點：相鄰小時都有值就連線，整小時缺才斷（1.5 小時，與 bucketSeconds × 1.5 同理） */
const HOURLY_GAP_SEC = HOUR_SECONDS * 1.5;

/**
 * v2 24H：每個整點小時只取該小時內的完整 5 分鐘桶聚合成一點（t＝該小時結束，不超過圖的右界）。
 * 聚合方式對齊 loader 7D／30D：中位 RTT 取中位數，其餘以樣本數加權平均
 * （完整桶的探針數都接近預期值，加權與簡單平均差異很小，加權只是與 7D／30D 口徑一致）。
 * 該小時沒有任何完整桶＝缺值（共用元件斷線＋斜線），不補值。
 */
export function hourlyCompleteSeries(
  summary: InternetHealthTimelineSummary,
  family: 4 | 6,
  mask: CompleteMask,
): SparklinePoint[] {
  const ratio = summary.unit === "ratio";
  const groups = new Map<number, { v: number; w: number }[]>();
  for (const point of (family === 4 ? summary.ipv4 : summary.ipv6).points) {
    if (point.state !== "ready" || point.value == null || !mask[family].has(point.at)) continue;
    const hourEnd = Math.ceil(point.at / HOUR_SECONDS) * HOUR_SECONDS; // at＝桶結束，HH:00 結束的桶屬前一小時
    const group = groups.get(hourEnd) ?? [];
    group.push({ v: ratio ? point.value * 100 : point.value, w: point.sampleCount ?? 0 });
    groups.set(hourEnd, group);
  }
  const out: SparklinePoint[] = [];
  for (const [hourEnd, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    let v: number;
    if (summary.metric === "median_rtt_ms") {
      const sorted = group.map((g) => g.v).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      v = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    } else {
      const w = group.reduce((sum, g) => sum + g.w, 0);
      v = w > 0 ? group.reduce((sum, g) => sum + g.v * g.w, 0) / w : group.reduce((sum, g) => sum + g.v, 0) / group.length;
    }
    out.push({ t: Math.min(hourEnd, summary.to), v });
  }
  return out;
}

function atlasDayMask(day: AtlasDaySummaries | null | undefined): CompleteMask | null {
  return completeMaskFrom(day?.ping_success_ratio) ?? completeMaskFrom(day?.probe_connectivity_ratio);
}

/**
 * 建議正常色帶（顯示單位：% 或 ms；同上調查文件 §3，30 天完整桶 p10–p90）。
 * 色帶畫 IPv4；IPv6 不同時寫進列的提示。roster 換版後基準會變。
 */
const ATLAS_BANDS: Record<AtlasMetric, { unit: string; 4: { lo: number; hi: number; label: string }; 6: { lo: number; hi: number } }> = {
  ping_success_ratio: { unit: "%", 4: { lo: 97, hi: 100, label: "IPv4 建議正常範圍" }, 6: { lo: 83, hi: 92 } },
  median_rtt_ms: { unit: "ms", 4: { lo: 4, hi: 5.5, label: "IPv4 建議正常範圍" }, 6: { lo: 4, hi: 12 } },
  probe_connectivity_ratio: { unit: "%", 4: { lo: 90, hi: 100, label: "IPv4 建議正常範圍" }, 6: { lo: 90, hi: 100 } },
  reachable_asn_ratio: { unit: "%", 4: { lo: 85, hi: 100, label: "IPv4 建議正常範圍" }, 6: { lo: 70, hi: 85 } },
};

function isAtlasMetric(metric: InternetHealthTimelineMetric): metric is AtlasMetric {
  return (ATLAS_METRICS as InternetHealthTimelineMetric[]).includes(metric);
}

function bandRangeText(metric: AtlasMetric): string {
  const b = ATLAS_BANDS[metric];
  const sp = b.unit === "%" ? "" : " ";
  return `建議正常 IPv4 ${b[4].lo}–${b[4].hi}${sp}${b.unit}；IPv6 ${b[6].lo}–${b[6].hi}${sp}${b.unit}`;
}

function hhmm(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Taipei" });
}

function coverageLabel(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

export function RipeTimelineView({
  summary, phase, range, source, metric, nowTs,
  onRangeChange, onSourceChange, onMetricChange, completeMask,
}: {
  summary: InternetHealthTimelineSummary | null;
  phase: TimelinePhase;
  range: InternetHealthTimelineRange;
  source: InternetHealthTimelineSource;
  metric: InternetHealthTimelineMetric;
  nowTs: number;
  onRangeChange?: (range: InternetHealthTimelineRange) => void;
  onSourceChange?: (source: InternetHealthTimelineSource) => void;
  onMetricChange?: (metric: InternetHealthTimelineMetric) => void;
  /** v2：24H Atlas 的完整桶（由探針數判定）；RTT／ASN 指標沿用 ping 的判定 */
  completeMask?: CompleteMask | null;
}) {
  const theme = useMonitorTheme();
  const v2 = useMonitorV2();
  const displayedSummary = summary?.range === range && summary.source === source && summary.metric === metric
    ? summary
    : null;
  // 殘缺桶只在 v2、Atlas、5 分鐘原值時略過；ping／probe 用自己的探針數，其餘用傳入的判定
  const mask = v2 && displayedSummary && displayedSummary.source === "ripe_atlas" && displayedSummary.bucketSeconds === RAW_BUCKET_SECONDS
    ? completeMaskFrom(displayedSummary) ?? completeMask ?? null
    : null;
  const atlasBand = v2 && source === "ripe_atlas" && isAtlasMetric(metric) ? ATLAS_BANDS[metric][4] : undefined;
  const aggregatedProbeMetric = v2 && source === "ripe_atlas" && range !== "24h"
    && (metric === "probe_connectivity_ratio" || metric === "reachable_asn_ratio");
  const ipv4 = displayedSummary ? (mask ? hourlyCompleteSeries(displayedSummary, 4, mask) : toSparkline(displayedSummary, 4)) : [];
  const ipv6 = displayedSummary ? (mask ? hourlyCompleteSeries(displayedSummary, 6, mask) : toSparkline(displayedSummary, 6)) : [];
  const hasIPv4 = ipv4.length > 0;
  const primary = hasIPv4 ? ipv4 : ipv6;
  const secondary = hasIPv4 ? ipv6 : [];
  const primaryFamily = hasIPv4 ? 4 : 6;
  const metricLabel = METRIC_OPTIONS[source].find((item) => item.value === metric)?.label ?? metric;
  // 兩個 ready 點中間只缺一格時相距 2 buckets；門檻必須 < 2 才會誠實斷線。
  const gapSec = mask ? HOURLY_GAP_SEC : displayedSummary ? displayedSummary.bucketSeconds * 1.5 : undefined;

  return (
    <div data-testid="ripe-internet-health-timeline" style={{ gridColumn: "1 / -1", padding: "12px", borderRadius: RADIUS.xl, border: `1px solid ${theme.p.borderMid}`, background: theme.isDark ? "rgba(2,8,23,0.42)" : theme.neutral(0.03), minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <span>
          <b style={{ display: "block", fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.base), color: theme.p.textDefault }}>RIPE 歷史量測</b>
          <span style={{ display: "block", marginTop: 2, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>觀察趨勢與資料缺口 · 不單獨判定全臺正常或斷網</span>
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          {(Object.keys(RANGE_LABELS) as InternetHealthTimelineRange[]).map((item) => {
            const selected = item === range;
            return (
              <button key={item} type="button" aria-pressed={selected} onClick={() => onRangeChange?.(item)} style={{ border: `1px solid ${selected ? theme.fill(RIPE_CYAN) : theme.p.borderMid}`, borderRadius: RADIUS.md, padding: "4px 8px", cursor: "pointer", background: selected ? withAlpha(theme.fill(RIPE_CYAN), 0.12) : theme.neutral(0.02), color: selected ? theme.text(RIPE_CYAN) : theme.p.textDim, fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs) }}>
                {RANGE_LABELS[item]}
              </button>
            );
          })}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <span style={{ display: "flex", gap: 4 }}>
          {(Object.keys(SOURCE_LABELS) as InternetHealthTimelineSource[]).map((item) => {
            const selected = item === source;
            return (
              <button key={item} type="button" aria-pressed={selected} onClick={() => onSourceChange?.(item)} style={{ border: 0, borderBottom: `1px solid ${selected ? theme.fill(RIPE_CYAN) : "transparent"}`, padding: "4px 5px", cursor: "pointer", background: "transparent", color: selected ? theme.p.textDefault : theme.p.textDim, fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs) }}>
                {SOURCE_LABELS[item]}
              </button>
            );
          })}
        </span>
        <label style={{ marginLeft: "auto", fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>
          指標{" "}
          <select aria-label="RIPE 時間軸指標" value={metric} onChange={(event) => onMetricChange?.(event.target.value as InternetHealthTimelineMetric)} style={{ marginLeft: 4, minHeight: 27, padding: "3px 24px 3px 7px", borderRadius: RADIUS.md, border: `1px solid ${theme.p.borderMid}`, background: theme.isDark ? "#09101d" : theme.p.optionBg, color: theme.p.textDefault, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs) }}>
            {METRIC_OPTIONS[source].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ minHeight: 148, marginTop: 8 }}>
        {phase === "loading" && <div style={{ height: 138, display: "grid", placeItems: "center", color: theme.p.textFaint, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm) }}>正在載入 {SOURCE_LABELS[source]} {RANGE_LABELS[range]} 歷史量測…</div>}
        {phase === "error" && <div style={{ height: 138, display: "grid", placeItems: "center", color: theme.p.statusWarn, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm) }}>歷史量測暫時無法更新；目前數值仍可繼續查看</div>}
        {displayedSummary && (displayedSummary.empty || primary.length === 0) && <div style={{ height: 138, display: "grid", placeItems: "center", color: theme.p.textFaint, fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), textAlign: "center" }}>這段期間尚無可畫的 {metricLabel}；空白不是 0，也不代表異常</div>}
        {displayedSummary && primary.length > 0 && (
          <TimeseriesSparkline
            data={primary}
            timeDomain={{ from: displayedSummary.from, to: displayedSummary.to }}
            unit={chartUnit(displayedSummary)}
            height={142}
            heightTier={v2 ? "std" : undefined}
            band={atlasBand}
            gapSec={gapSec}
            fillArea
            lineColor={primaryFamily === 4 ? RIPE_CYAN : IPV6_VIOLET}
            seriesLabel={`IPv${primaryFamily}`}
            extraSeries={secondary.length > 0 ? { data: secondary, color: IPV6_VIOLET, label: "IPv6" } : undefined}
            showTooltip
          />
        )}
      </div>

      <div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap", alignItems: "center", marginTop: 4, fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>
        <span><i style={{ display: "inline-block", width: 9, height: 2, marginRight: 5, verticalAlign: "middle", background: theme.fill(RIPE_CYAN) }} />IPv4</span>
        <span><i style={{ display: "inline-block", width: 9, height: 2, marginRight: 5, verticalAlign: "middle", background: theme.fill(IPV6_VIOLET) }} />IPv6</span>
        <span>IPv4 {v2 ? <Zh>涵蓋率</Zh> : "coverage"} {displayedSummary ? coverageLabel(displayedSummary.ipv4.coverage) : "—"}</span>
        <span>IPv6 {v2 ? <Zh>涵蓋率</Zh> : "coverage"} {displayedSummary ? coverageLabel(displayedSummary.ipv6.coverage) : "—"}</span>
        <span>最後回報 {displayedSummary ? unixTimeLabel(displayedSummary.latestAt, nowTs) : "—"}</span>
        {displayedSummary?.partial && <span style={{ color: theme.p.statusWarn }}>含缺口／部分資料</span>}
        {displayedSummary?.truncated && <span style={{ color: theme.p.statusErr }}>回傳達上限，圖表不完整</span>}
        {mask && <span style={{ fontFamily: FONT_CJK }}>每小時只取完整量測平均；整小時沒有完整量測才畫斜線</span>}
        {aggregatedProbeMetric && <span style={{ fontFamily: FONT_CJK, color: theme.p.statusWarn }}>7D／30D 此指標受殘缺量測桶拉低，僅供參考</span>}
      </div>
    </div>
  );
}

function queryPhase(status: "unknown" | "ready" | "error" | "denied"): InternetHealthPhase {
  return status === "ready" ? "ready" : status === "error" || status === "denied" ? "error" : "loading";
}

function RipeTimelinePanel({ open, nowTs, completeMask }: { open: boolean; nowTs: number; completeMask?: CompleteMask | null }) {
  const [range, setRange] = useState<InternetHealthTimelineRange>("24h");
  const [source, setSource] = useState<InternetHealthTimelineSource>("ripe_atlas");
  const [metric, setMetric] = useState<InternetHealthTimelineMetric>("ping_success_ratio");
  const load = useCallback(
    () => fetchInternetHealthTimeline({ range, source, metric }),
    [metric, range, source],
  );
  const query = useMonitorResource({
    open,
    queryKey: `internet-health-timeline:${range}:${source}:${metric}`,
    intervalMs: 5 * 60_000,
    emptyData: null as InternetHealthTimelineSummary | null,
    load,
  });

  const handleSourceChange = (next: InternetHealthTimelineSource) => {
    setSource(next);
    setMetric(METRIC_OPTIONS[next][0]!.value);
  };

  return <>
    <MonitorDataStatus label="RIPE 歷史量測" query={query} />
    <RipeTimelineView summary={query.data} phase={queryPhase(query.status)} range={range} source={source} metric={metric} nowTs={nowTs} onRangeChange={setRange} onSourceChange={handleSourceChange} onMetricChange={setMetric} completeMask={completeMask} />
  </>;
}

type ResolvedAtlasValue = {
  value: number | null;
  /** 改用最近完整桶時的桶結束時間；用即時值時為 null */
  completeAt: number | null;
  measurement: InternetHealthMeasurement | undefined;
};

/**
 * 即時值：`internet_health_current` 指向的常是還沒收完的桶。即時那一桶的回報探針數
 * 達門檻才用即時值，否則改用 24H 歷史裡最近一個完整桶；都沒有就留空，不拿殘缺值充數。
 */
export function resolveAtlasValue(
  metric: AtlasMetric,
  family: 4 | 6,
  atlas: InternetHealthMeasurement[],
  day: AtlasDaySummaries | null | undefined,
  mask: CompleteMask | null,
): ResolvedAtlasValue {
  const measurement = atlas.find((item) => item.signal === `${metric}_ipv${family}`);
  const probeRow = atlas.find((item) => item.signal === `ping_success_ratio_ipv${family}`)
    ?? atlas.find((item) => item.signal === `probe_connectivity_ratio_ipv${family}`);
  if (measurement?.value != null && measurement.freshness === "fresh" && measurement.state === "available" && probeRow && isCompleteProbeCount(family, probeRow.sample_count)) {
    return { value: measurement.unit === "ratio" ? measurement.value * 100 : measurement.value, completeAt: null, measurement };
  }
  const summary = day?.[metric];
  if (summary && mask) {
    const points = (family === 4 ? summary.ipv4 : summary.ipv6).points;
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i]!;
      if (point.state === "ready" && point.value != null && mask[family].has(point.at)) {
        return { value: summary.unit === "ratio" ? point.value * 100 : point.value, completeAt: point.at, measurement };
      }
    }
  }
  return { value: null, completeAt: null, measurement };
}

function measurementTooltip(family: 4 | 6, resolved: ResolvedAtlasValue, nowTs: number): string {
  const m = resolved.measurement;
  const live = m
    ? [
      FRESHNESS_ZH[m.freshness] ?? m.freshness,
      measurementSampleLabelZh(m),
      timeLabel(m.source_updated_at, nowTs),
      CONFIDENCE_ZH[m.confidence] ? `信心${CONFIDENCE_ZH[m.confidence]}` : null,
    ].filter(Boolean).join(" · ")
    : "無即時量測";
  const used = resolved.completeAt != null
    ? `；顯示值取最近完整量測 ${hhmm(resolved.completeAt)}`
    : resolved.value == null ? "；近 24 小時無完整量測" : "";
  return `IPv${family}：${live}${used}`;
}

function fmtAtlas(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

const legendSwatch = (color: string) => (
  <i style={{ display: "inline-block", width: 9, height: 2, marginRight: 5, verticalAlign: "middle", background: color }} />
);

function TelecomStatusV2Body({
  measurements, phase, nowTs, timeline, atlasDay, fresh,
}: {
  measurements: InternetHealthMeasurement[];
  phase: InternetHealthPhase;
  nowTs: number;
  timeline?: ReactNode;
  atlasDay?: AtlasDaySummaries | null;
  fresh: MonitorFreshness;
}) {
  const theme = useMonitorTheme();
  const atlas = useMemo(() => measurements.filter((item) => item.source_key === "ripe_atlas"), [measurements]);
  const ris = measurements.filter((item) => item.source_key === "ripe_ris");
  const freshMetricCount = measurements.filter((item) => item.freshness === "fresh").length;
  const reportingFeeds = Number(atlas.some((item) => item.freshness === "fresh")) + Number(ris.some((item) => item.freshness === "fresh"));
  const latestAt = newestMeasurementAt(measurements);
  const hasPartial = measurements.some((item) => item.state === "partial");
  const [statusText, statusColor] = phase === "loading" ? ["讀取中", theme.p.textDim]
    : phase === "error" ? ["更新中斷", theme.p.statusWarn]
      : freshMetricCount === 0 ? [measurements.length > 0 ? "無法取得" : "等待量測", theme.p.textDim]
        : hasPartial || reportingFeeds < 2 ? ["部分", theme.p.statusWarn]
          : ["量測可用", theme.p.statusLive];

  const mask = useMemo(() => atlasDayMask(atlasDay), [atlasDay]);
  const domainSummary = atlasDay?.ping_success_ratio ?? ATLAS_METRICS.map((m) => atlasDay?.[m]).find((x) => x) ?? null;
  const rowsData = useMemo(() => ATLAS_METRICS.map((metric) => {
    const summary = atlasDay?.[metric] ?? null;
    const ipv4 = summary && mask ? hourlyCompleteSeries(summary, 4, mask) : [];
    const ipv6 = summary && mask ? hourlyCompleteSeries(summary, 6, mask) : [];
    const extra = ipv6.length > 0 ? { data: ipv6, color: IPV6_VIOLET, label: "IPv6" } : undefined;
    return {
      metric, ipv4, ipv6, extra,
      v4: resolveAtlasValue(metric, 4, atlas, atlasDay, mask),
      v6: resolveAtlasValue(metric, 6, atlas, atlasDay, mask),
    };
  }), [atlas, atlasDay, mask]);
  const fallbackTimes = rowsData.flatMap((r) => [r.v4.completeAt, r.v6.completeAt]).filter((t): t is number => t != null);
  const fallbackAt = fallbackTimes.length ? Math.min(...fallbackTimes) : null;
  const timeDomain = domainSummary ? { from: domainSummary.from, to: domainSummary.to } : undefined;

  const risFresh = ris.some((item) => item.freshness === "fresh");
  const risStatus = risFresh ? "即時"
    : ris.some((item) => item.state === "partial") ? "部分"
      : ris.some((item) => item.freshness === "stale") ? "過期"
        : ris.length > 0 ? "無法取得" : "無資料";
  const origin = ris.find((item) => item.signal === "origin_change_count_ipv4");
  const bgpMessages = ris.reduce<number | null>((max, item) => (
    item.sample_count != null && (max == null || item.sample_count > max) ? item.sample_count : max
  ), null);

  return (
    <div data-testid="internet-health-card" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FONT_CJK, fontSize: MF.label, color: statusColor }}>
        <span data-testid="internet-health-status-dot" style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: statusColor }} />
        <span data-testid="internet-health-status-label">{statusText}</span>
      </div>
      <div>
        <MonitorMetric value={`${freshMetricCount}/14`} unit="項即時" muted={freshMetricCount === 0 || fresh.muted} />
        <MonitorSub items={[
          `回報來源 ${reportingFeeds}/2`,
          `RIPE 最後更新 ${timeLabel(latestAt, nowTs)}`,
          fallbackAt != null ? `以最近完整量測（${hhmm(fallbackAt)}）計` : null,
        ]} />
        {fresh.reason && <MonitorNote tone={fresh.state === "stopped" ? "err" : "warn"}>{fresh.reason}</MonitorNote>}
      </div>

      <div data-testid="internet-health-atlas-rows">
        <MonitorRows rows={rowsData.map((r) => ({
          label: METRIC_OPTIONS.ripe_atlas.find((o) => o.value === r.metric)!.label,
          chart: r.ipv4.length > 0 || r.ipv6.length > 0
            ? (
              <TimeseriesSparkline
                data={r.ipv4.length > 0 ? r.ipv4 : r.ipv6}
                extraSeries={r.ipv4.length > 0 ? r.extra : undefined}
                lineColor={r.ipv4.length > 0 ? RIPE_CYAN : IPV6_VIOLET}
                timeDomain={timeDomain}
                gapSec={HOURLY_GAP_SEC}
                heightTier="mini"
                bare
                fillArea={false}
                band={ATLAS_BANDS[r.metric][4]}
                staleUntil={fresh.staleUntil}
              />
            )
            : <div style={{ height: 28 }} />,
          value: `${fmtAtlas(r.v4.value)}／${fmtAtlas(r.v6.value)}`,
          unit: ATLAS_BANDS[r.metric].unit,
          title: [
            bandRangeText(r.metric),
            measurementTooltip(4, r.v4, nowTs),
            measurementTooltip(6, r.v6, nowTs),
          ].join("\n"),
        }))} />
        <div style={{ display: "flex", gap: 14, marginTop: 4, fontFamily: FONT_DATA, fontSize: MF.label, color: theme.p.textDim }}>
          <span>{legendSwatch(theme.fill(RIPE_CYAN))}IPv4</span>
          <span>{legendSwatch(theme.fill(IPV6_VIOLET))}IPv6</span>
          <span style={{ fontFamily: FONT_CJK }}>淡帶＝IPv4 建議正常範圍</span>
        </div>
      </div>

      <div>
        <MonitorSub items={[
          `RIS 路由觀測：${risStatus}`,
          `BGP 訊息 ${bgpMessages?.toLocaleString("zh-TW") ?? "—"}`,
          origin?.value != null ? `Origin 變更 ${origin.value.toLocaleString("zh-TW")}` : null,
        ]} />
        <MonitorNote>Prefix 可見度與撤回比率需先設定追蹤的 prefix，目前未設定，故不列出。</MonitorNote>
      </div>

      {timeline}

      <MonitorNote>Atlas 與 RIS 同屬 RIPE NCC，只算一個來源群組；100% Ping、0 Origin 變更不能單獨推論為正常。</MonitorNote>

      <details data-testid="internet-health-howto" style={{ fontFamily: FONT_CJK, fontSize: MF.label, color: theme.p.textMuted }}>
        <summary style={{ cursor: "pointer", color: theme.p.textDim }}>怎麼看</summary>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.5 }}>
          <li>IPv6 正常約 85–90%，不是 100%：有幾支臺灣探針本身沒有 IPv6。</li>
          <li>24 小時線每小時只取探針數足夠的完整量測平均成一點；整小時都沒有完整量測才畫斜線。資料收集端修好前，大段斜線代表量測殘缺，不代表網路異常。</li>
          <li>單點下跌不算異常；連續 15 分鐘以上，而且 IPv4／IPv6 或成功率／回報率一起掉，才值得注意。</li>
          <li>本卡只 ping 一個目標（K-root），屬 RIPE 單一來源；判斷臺灣是否斷網，要對照 IODA 或 Cloudflare Radar。</li>
        </ul>
        <div style={{ marginTop: 4, color: theme.p.textDim }}>參考：RIPE Atlas 文件、RIPE RIS 文件、IODA、Cloudflare Radar 開發文件</div>
      </details>
    </div>
  );
}

export function TelecomStatusCardView({
  summary, phase, nowTs, timeline, atlasDay,
}: {
  summary: InternetHealthSummary | null;
  phase: InternetHealthPhase;
  nowTs: number;
  timeline?: ReactNode;
  /** v2：Atlas 四指標 24H 原值（小倍數＋殘缺桶判定）；舊版不用 */
  atlasDay?: AtlasDaySummaries | null;
}) {
  const theme = useMonitorTheme();
  const measurements = summary?.measurements ?? [];
  const atlasMeasurements = measurements.filter((item) => item.source_key === "ripe_atlas");
  const risMeasurements = measurements.filter((item) => item.source_key === "ripe_ris");
  const freshMetricCount = measurements.filter((item) => item.freshness === "fresh").length;
  const reportingFeeds = Number(atlasMeasurements.some((item) => item.freshness === "fresh")) + Number(risMeasurements.some((item) => item.freshness === "fresh"));
  const latestAt = newestMeasurementAt(measurements);
  const statusLabel = phase === "loading" ? "正在讀取 RIPE 量測" : phase === "error" ? "RIPE 量測更新中斷" : freshMetricCount > 0 ? "RIPE 量測可用" : "等待 RIPE 量測";
  const statusColor = freshMetricCount > 0 && phase === "ready" ? RIPE_CYAN : theme.p.textDim;
  const v2 = useMonitorV2();
  // 資料時間＝最後 RIPE 更新（5 分週期，由 fresh 判斷標題列狀態）；DB 的逐項 freshness 細項標示保留在卡內
  const latestMs = latestAt ? Date.parse(latestAt) : NaN;
  const fresh = useMonitorFreshness("internetHealth", { time: Number.isFinite(latestMs) ? latestMs : null });
  if (v2) return <TelecomStatusV2Body measurements={measurements} phase={phase} nowTs={nowTs} timeline={timeline} atlasDay={atlasDay} fresh={fresh} />;
  const current = "CURRENT";
  const description = phase === "error" ? `本次更新失敗；保留最後成功量測，但傳輸成功或舊資料都不等於 ${current}。` : "持續觀察 RIPE Atlas 端到端量測與 RIPE RIS BGP 路由更新。數值先如實呈現，異常判讀待基準累積後再加入。";

  return (
    <div data-testid="internet-health-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!v2 && <SectionLabel color={RIPE_CYAN}>RIPE NCC 網路觀察 · NETWORK OBSERVATION</SectionLabel>}
      <div style={{ ...(v2 ? {} : { borderRadius: RADIUS.xl, border: `1px solid ${statusColor}55`, background: "linear-gradient(145deg, rgba(34,211,238,0.055), rgba(255,255,255,0.012) 48%)", padding: "12px 14px" }), display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 14, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, gridColumn: "1 / -1" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span data-testid="internet-health-status-dot" style={{ width: 12, height: 12, borderRadius: RADIUS.full, background: statusColor }} />
              <span data-testid="internet-health-status-label" style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.lg), fontWeight: 700, color: statusColor }}>{statusLabel}</span>
            </div>
            <div style={{ marginTop: 4, fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), letterSpacing: "1.6px", color: theme.p.textFaint }}>{v2 ? <Zh>僅觀察 · 基準建立中</Zh> : "OBSERVATION ONLY · BASELINE BUILDING"}</div>
          </div>
          <div style={{ fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.sm), lineHeight: 1.45, color: theme.p.textMuted }}>{description}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>{v2 ? <Zh>即時指標</Zh> : "FRESH METRICS"}<br /><b style={{ fontSize: fs(v2, FONT_SIZE.md), color: theme.p.textDefault }}>{freshMetricCount}/14</b></span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>{v2 ? <Zh>回報來源</Zh> : "REPORTING FEEDS"}<br /><b style={{ fontSize: fs(v2, FONT_SIZE.md), color: theme.p.textDefault }}>{reportingFeeds}/2</b></span>
            <span style={{ fontFamily: FONT_DATA, fontSize: fs(v2, FONT_SIZE.xs), color: theme.p.textFaint }}>{v2 ? <Zh>RIPE 最後更新</Zh> : "LAST RIPE UPDATE"}<br /><b style={{ fontSize: fs(v2, FONT_SIZE.sm), color: theme.p.textDefault }}>{timeLabel(latestAt, nowTs)}</b></span>
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 10 }}>
          <MeasurementCard title="RIPE Atlas" subtitle="端到端主動量測 · RIPE NCC" sourceKey="ripe_atlas" measurements={atlasMeasurements} signals={ATLAS_SIGNALS} nowTs={nowTs} />
          <MeasurementCard title="RIPE RIS Live" subtitle="BGP 路由觀測 · RIPE NCC" sourceKey="ripe_ris" measurements={risMeasurements} signals={RIS_SIGNALS} nowTs={nowTs} />
        </div>

        {timeline}

        <div style={{ gridColumn: "1 / -1", fontFamily: FONT_CJK, fontSize: fs(v2, FONT_SIZE.xs), lineHeight: 1.5, color: theme.p.textFaint }}>
          Atlas 與 RIS 同屬 RIPE NCC，只算一個來源群組。{current} 只表示至少一項量測新鮮；100% Ping、0 Origin 變更或 0 Withdrawal 都不能單獨推導為正常。圖表缺口維持空白，不補成 0。
        </div>
      </div>
    </div>
  );
}

export function TelecomStatusCard({ open, nowTs }: { open: boolean; nowTs: number }) {
  const load = useCallback(() => fetchInternetHealthStatus(), []);
  const query = useMonitorResource({
    open,
    queryKey: "internet-health-status",
    intervalMs: 5 * 60_000,
    emptyData: null as InternetHealthSummary | null,
    load,
  });

  const v2 = useMonitorV2();
  // v2 小倍數：Atlas 四指標 24H 原值（loader 有快取；舊版不抓）
  const loadDay = useCallback(async (): Promise<AtlasDaySummaries> => {
    const list = await Promise.all(ATLAS_METRICS.map((metric) => fetchInternetHealthTimeline({ range: "24h", source: "ripe_atlas", metric })));
    return Object.fromEntries(ATLAS_METRICS.map((metric, i) => [metric, list[i] ?? null])) as AtlasDaySummaries;
  }, []);
  const dayQuery = useMonitorResource({
    open: open && v2,
    queryKey: "internet-health-atlas-24h",
    intervalMs: 5 * 60_000,
    emptyData: null as AtlasDaySummaries | null,
    load: loadDay,
  });
  const dayMask = useMemo(() => (v2 ? atlasDayMask(dayQuery.data) : null), [dayQuery.data, v2]);

  const timeline = useMemo(() => <RipeTimelinePanel open={open} nowTs={nowTs} completeMask={dayMask} />, [dayMask, nowTs, open]);
  return <>
    <MonitorDataStatus label="RIPE 現況量測" query={query} />
    {v2 && <MonitorDataStatus label="RIPE 24 小時量測" query={dayQuery} />}
    <TelecomStatusCardView summary={query.data} phase={queryPhase(query.status)} nowTs={nowTs} timeline={timeline} atlasDay={v2 ? dayQuery.data : undefined} />
  </>;
}
