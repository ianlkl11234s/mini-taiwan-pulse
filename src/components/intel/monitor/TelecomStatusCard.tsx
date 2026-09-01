/**
 * RIPE NCC 臺灣網路觀察卡。
 *
 * Atlas / RIS 都屬同一個 RIPE NCC dependency group；這裡只呈現量測與歷史，
 * 不把單一來源的漂亮數字推導成「臺灣網路正常」，也不建立任何推測 geometry。
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TimeseriesSparkline, type SparklinePoint } from "../../TimeseriesSparkline";
import { COLORS, FONT_CJK, FONT_DATA, relTime } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchInternetHealthStatus,
  fetchInternetHealthTimeline,
  invalidateInternetHealthStatus,
  invalidateInternetHealthTimelineCache,
  type InternetHealthMeasurement,
  type InternetHealthMeasurementSignal,
  type InternetHealthSummary,
  type InternetHealthTimelineMetric,
  type InternetHealthTimelineRange,
  type InternetHealthTimelineSource,
  type InternetHealthTimelineSummary,
} from "../../../data/internetHealthLoader";

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

  return (
    <div
      data-testid={`internet-health-measurements-${sourceKey}`}
      style={{
        minWidth: 0, padding: "11px 12px", borderRadius: RADIUS.xl,
        border: `1px solid ${COLORS.borderMid}`, background: "rgba(2,8,23,0.32)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <span>
          <b style={{ display: "block", fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, color: COLORS.textDefault }}>{title}</b>
          <span style={{ display: "block", marginTop: 2, fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>{subtitle}</span>
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: current > 0 ? RIPE_CYAN : COLORS.textDim, letterSpacing: "0.8px" }}>{freshness}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(94px, 1.2fr) repeat(2, minmax(70px, 1fr))", gap: "5px 8px", marginTop: 10 }}>
        <span />
        {([4, 6] as const).map((family) => (
          <span key={family} style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>IPv{family}</span>
        ))}
        {pairs.map((signal) => {
          const base = signal.replace(/_ipv4$/, "");
          const ipv4 = measurements.find((item) => item.signal === `${base}_ipv4`);
          const ipv6 = measurements.find((item) => item.signal === `${base}_ipv6`);
          return [
            <span key={`${base}-label`} style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{MEASUREMENT_LABELS[signal]}</span>,
            ...([ipv4, ipv6] as const).map((measurement, index) => (
              <span key={`${base}-${index}`} style={{ minWidth: 0 }}>
                <b style={{ display: "block", fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: measurement?.freshness === "stale" ? COLORS.textFaint : COLORS.textDefault }}>
                  {measurementValue(measurement)}
                </b>
                {measurementStateLabel(measurement) && (
                  <span style={{ display: "block", fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.statusWarn }}>
                    {measurementStateLabel(measurement)}
                  </span>
                )}
                <span style={{ display: "block", fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
                  {measurement ? `${measurement.freshness.toUpperCase()} · ${measurementSampleLabel(measurement)}` : "—"}
                </span>
                {measurement && (
                  <span style={{ display: "block", fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
                    {timeLabel(measurement.source_updated_at, nowTs)} · confidence {measurement.confidence}
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

function toSparkline(summary: InternetHealthTimelineSummary, family: 4 | 6): SparklinePoint[] {
  const series = family === 4 ? summary.ipv4 : summary.ipv6;
  const ratio = summary.unit === "ratio";
  return series.points.flatMap((point) => (
    point.state === "ready" && point.value != null
      ? [{ t: point.at, v: ratio ? point.value * 100 : point.value }]
      : []
  ));
}

function coverageLabel(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

export function RipeTimelineView({
  summary, phase, range, source, metric, nowTs,
  onRangeChange, onSourceChange, onMetricChange,
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
}) {
  const displayedSummary = summary?.range === range && summary.source === source && summary.metric === metric
    ? summary
    : null;
  const ipv4 = displayedSummary ? toSparkline(displayedSummary, 4) : [];
  const ipv6 = displayedSummary ? toSparkline(displayedSummary, 6) : [];
  const hasIPv4 = ipv4.length > 0;
  const primary = hasIPv4 ? ipv4 : ipv6;
  const secondary = hasIPv4 ? ipv6 : [];
  const primaryFamily = hasIPv4 ? 4 : 6;
  const metricLabel = METRIC_OPTIONS[source].find((item) => item.value === metric)?.label ?? metric;
  // 兩個 ready 點中間只缺一格時相距 2 buckets；門檻必須 < 2 才會誠實斷線。
  const gapSec = displayedSummary ? displayedSummary.bucketSeconds * 1.5 : undefined;

  return (
    <div data-testid="ripe-internet-health-timeline" style={{ gridColumn: "1 / -1", padding: "12px", borderRadius: RADIUS.xl, border: `1px solid ${COLORS.borderMid}`, background: "rgba(2,8,23,0.42)", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <span>
          <b style={{ display: "block", fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, color: COLORS.textDefault }}>RIPE 歷史量測</b>
          <span style={{ display: "block", marginTop: 2, fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>觀察趨勢與資料缺口 · 不單獨判定全臺正常或斷網</span>
        </span>
        <span style={{ display: "flex", gap: 4 }}>
          {(Object.keys(RANGE_LABELS) as InternetHealthTimelineRange[]).map((item) => {
            const selected = item === range;
            return (
              <button key={item} type="button" aria-pressed={selected} onClick={() => onRangeChange?.(item)} style={{ border: `1px solid ${selected ? RIPE_CYAN : COLORS.borderMid}`, borderRadius: RADIUS.md, padding: "4px 8px", cursor: "pointer", background: selected ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.02)", color: selected ? RIPE_CYAN : COLORS.textDim, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs }}>
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
              <button key={item} type="button" aria-pressed={selected} onClick={() => onSourceChange?.(item)} style={{ border: 0, borderBottom: `1px solid ${selected ? RIPE_CYAN : "transparent"}`, padding: "4px 5px", cursor: "pointer", background: "transparent", color: selected ? COLORS.textDefault : COLORS.textDim, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs }}>
                {SOURCE_LABELS[item]}
              </button>
            );
          })}
        </span>
        <label style={{ marginLeft: "auto", fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
          指標{" "}
          <select aria-label="RIPE 時間軸指標" value={metric} onChange={(event) => onMetricChange?.(event.target.value as InternetHealthTimelineMetric)} style={{ marginLeft: 4, minHeight: 27, padding: "3px 24px 3px 7px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.borderMid}`, background: "#09101d", color: COLORS.textDefault, fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs }}>
            {METRIC_OPTIONS[source].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ minHeight: 148, marginTop: 8 }}>
        {phase === "loading" && <div style={{ height: 138, display: "grid", placeItems: "center", color: COLORS.textFaint, fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm }}>正在載入 {SOURCE_LABELS[source]} {RANGE_LABELS[range]} 歷史量測…</div>}
        {phase === "error" && <div style={{ height: 138, display: "grid", placeItems: "center", color: COLORS.statusWarn, fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm }}>歷史量測暫時無法更新；目前數值仍可繼續查看</div>}
        {phase === "ready" && (!displayedSummary || displayedSummary.empty || primary.length === 0) && <div style={{ height: 138, display: "grid", placeItems: "center", color: COLORS.textFaint, fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, textAlign: "center" }}>這段期間尚無可畫的 {metricLabel}；空白不是 0，也不代表異常</div>}
        {phase === "ready" && displayedSummary && primary.length > 0 && (
          <TimeseriesSparkline
            data={primary}
            timeDomain={{ from: displayedSummary.from, to: displayedSummary.to }}
            unit={chartUnit(displayedSummary)}
            height={142}
            gapSec={gapSec}
            fillArea
            lineColor={primaryFamily === 4 ? RIPE_CYAN : IPV6_VIOLET}
            seriesLabel={`IPv${primaryFamily}`}
            extraSeries={secondary.length > 0 ? { data: secondary, color: IPV6_VIOLET, label: "IPv6" } : undefined}
            showTooltip
          />
        )}
      </div>

      <div style={{ display: "flex", gap: "6px 14px", flexWrap: "wrap", alignItems: "center", marginTop: 4, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
        <span><i style={{ display: "inline-block", width: 9, height: 2, marginRight: 5, verticalAlign: "middle", background: RIPE_CYAN }} />IPv4</span>
        <span><i style={{ display: "inline-block", width: 9, height: 2, marginRight: 5, verticalAlign: "middle", background: IPV6_VIOLET }} />IPv6</span>
        <span>IPv4 coverage {displayedSummary ? coverageLabel(displayedSummary.ipv4.coverage) : "—"}</span>
        <span>IPv6 coverage {displayedSummary ? coverageLabel(displayedSummary.ipv6.coverage) : "—"}</span>
        <span>最後回報 {displayedSummary ? unixTimeLabel(displayedSummary.latestAt, nowTs) : "—"}</span>
        {displayedSummary?.partial && <span style={{ color: COLORS.statusWarn }}>含缺口／部分資料</span>}
        {displayedSummary?.truncated && <span style={{ color: COLORS.statusErr }}>回傳達上限，圖表不完整</span>}
      </div>
    </div>
  );
}

function RipeTimelinePanel({ open, nowTs }: { open: boolean; nowTs: number }) {
  const [range, setRange] = useState<InternetHealthTimelineRange>("24h");
  const [source, setSource] = useState<InternetHealthTimelineSource>("ripe_atlas");
  const [metric, setMetric] = useState<InternetHealthTimelineMetric>("ping_success_ratio");
  const [summary, setSummary] = useState<InternetHealthTimelineSummary | null>(null);
  const [phase, setPhase] = useState<TimelinePhase>("loading");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let latestRequest = 0;
    const tick = (force = false) => {
      const requestId = ++latestRequest;
      if (force) invalidateInternetHealthTimelineCache();
      setSummary(null);
      setPhase("loading");
      fetchInternetHealthTimeline({ range, source, metric })
        .then((next) => {
          if (cancelled || requestId !== latestRequest) return;
          setSummary(next);
          setPhase("ready");
        })
        .catch((error) => {
          console.warn("[TelecomStatusCard] get_internet_health_timeseries failed", error);
          if (!cancelled && requestId === latestRequest) setPhase("error");
        });
    };
    tick();
    const id = window.setInterval(() => tick(true), 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [metric, open, range, source]);

  const handleSourceChange = (next: InternetHealthTimelineSource) => {
    setSource(next);
    setMetric(METRIC_OPTIONS[next][0]!.value);
  };

  return <RipeTimelineView summary={summary} phase={phase} range={range} source={source} metric={metric} nowTs={nowTs} onRangeChange={setRange} onSourceChange={handleSourceChange} onMetricChange={setMetric} />;
}

export function TelecomStatusCardView({
  summary, phase, nowTs, timeline,
}: {
  summary: InternetHealthSummary | null;
  phase: InternetHealthPhase;
  nowTs: number;
  timeline?: ReactNode;
}) {
  const measurements = phase === "error" ? [] : (summary?.measurements ?? []);
  const atlasMeasurements = measurements.filter((item) => item.source_key === "ripe_atlas");
  const risMeasurements = measurements.filter((item) => item.source_key === "ripe_ris");
  const freshMetricCount = measurements.filter((item) => item.freshness === "fresh").length;
  const reportingFeeds = Number(atlasMeasurements.some((item) => item.freshness === "fresh")) + Number(risMeasurements.some((item) => item.freshness === "fresh"));
  const latestAt = newestMeasurementAt(measurements);
  const statusLabel = phase === "loading" ? "正在讀取 RIPE 量測" : phase === "error" ? "RIPE 量測暫時無法更新" : freshMetricCount > 0 ? "RIPE 量測中" : "等待 RIPE 量測";
  const statusColor = freshMetricCount > 0 && phase === "ready" ? RIPE_CYAN : COLORS.textDim;
  const description = phase === "error" ? "本次更新失敗；不沿用舊資料判定網路狀態。" : "持續觀察 RIPE Atlas 端到端量測與 RIPE RIS BGP 路由更新。數值先如實呈現，異常判讀待基準累積後再加入。";

  return (
    <div data-testid="internet-health-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color={RIPE_CYAN}>RIPE NCC 網路觀察 · NETWORK OBSERVATION</SectionLabel>
      <div style={{ borderRadius: RADIUS.xl, border: `1px solid ${statusColor}55`, background: "linear-gradient(145deg, rgba(34,211,238,0.055), rgba(255,255,255,0.012) 48%)", padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 14, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, gridColumn: "1 / -1" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span data-testid="internet-health-status-dot" style={{ width: 12, height: 12, borderRadius: RADIUS.full, background: statusColor }} />
              <span data-testid="internet-health-status-label" style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
            </div>
            <div style={{ marginTop: 4, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.6px", color: COLORS.textFaint }}>OBSERVATION ONLY · BASELINE BUILDING</div>
          </div>
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, lineHeight: 1.45, color: COLORS.textMuted }}>{description}</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>FRESH METRICS<br /><b style={{ fontSize: FONT_SIZE.md, color: COLORS.textDefault }}>{freshMetricCount}/14</b></span>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>REPORTING FEEDS<br /><b style={{ fontSize: FONT_SIZE.md, color: COLORS.textDefault }}>{reportingFeeds}/2</b></span>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>LAST RIPE UPDATE<br /><b style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{timeLabel(latestAt, nowTs)}</b></span>
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 10 }}>
          <MeasurementCard title="RIPE Atlas" subtitle="端到端主動量測 · RIPE NCC" sourceKey="ripe_atlas" measurements={atlasMeasurements} signals={ATLAS_SIGNALS} nowTs={nowTs} />
          <MeasurementCard title="RIPE RIS Live" subtitle="BGP 路由觀測 · RIPE NCC" sourceKey="ripe_ris" measurements={risMeasurements} signals={RIS_SIGNALS} nowTs={nowTs} />
        </div>

        {timeline}

        <div style={{ gridColumn: "1 / -1", fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, lineHeight: 1.5, color: COLORS.textFaint }}>
          Atlas 與 RIS 同屬 RIPE NCC，只算一個來源群組。CURRENT 只表示至少一項量測新鮮；100% Ping、0 Origin 變更或 0 Withdrawal 都不能單獨推導為正常。圖表缺口維持空白，不補成 0。
        </div>
      </div>
    </div>
  );
}

export function TelecomStatusCard({ open, nowTs }: { open: boolean; nowTs: number }) {
  const [summary, setSummary] = useState<InternetHealthSummary | null>(null);
  const [phase, setPhase] = useState<InternetHealthPhase>("loading");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = (force = false) => {
      if (force) invalidateInternetHealthStatus();
      fetchInternetHealthStatus()
        .then((next) => {
          if (cancelled) return;
          setSummary(next);
          setPhase("ready");
        })
        .catch((error) => {
          console.warn("[TelecomStatusCard] get_internet_health_status failed", error);
          if (!cancelled) setPhase("error");
        });
    };
    tick();
    const id = window.setInterval(() => tick(true), 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open]);

  const timeline = useMemo(() => <RipeTimelinePanel open={open} nowTs={nowTs} />, [nowTs, open]);
  return <TelecomStatusCardView summary={summary} phase={phase} nowTs={nowTs} timeline={timeline} />;
}
