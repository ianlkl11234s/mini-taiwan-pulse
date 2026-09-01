/**
 * 台灣電信與網路狀態卡。
 *
 * 這是 Monitor widget，不是地圖 layer：ASN / country 狀態只顯示文字證據，
 * 不建立 Mapbox source，也不推測 coverage geometry。
 */
import { useEffect, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, relTime } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { SectionLabel } from "./PressureRing";
import {
  fetchInternetHealthStatus,
  invalidateInternetHealthStatus,
  type InternetHealthIncident,
  type InternetHealthMeasurement,
  type InternetHealthMeasurementSignal,
  type InternetHealthSourceSummary,
  type InternetHealthStatus,
  type InternetHealthSummary,
} from "../../../data/internetHealthLoader";

export type InternetHealthPhase = "loading" | "ready" | "error";

const STATUS_META: Record<InternetHealthStatus, { label: string; en: string; color: string; tint: string }> = {
  normal: { label: "目前正常", en: "NORMAL", color: COLORS.statusLive, tint: "rgba(34,197,94,0.07)" },
  watch: { label: "疑似異常", en: "WATCH", color: COLORS.statusWarn, tint: "rgba(250,204,21,0.07)" },
  degraded: { label: "局部異常", en: "DEGRADED", color: "#fb923c", tint: "rgba(251,146,60,0.08)" },
  outage: { label: "中斷訊號", en: "OUTAGE", color: COLORS.statusErr, tint: "rgba(239,68,68,0.09)" },
  unknown: { label: "資料不足", en: "UNKNOWN", color: COLORS.textDim, tint: "rgba(148,163,184,0.05)" },
};

function timeLabel(iso: string | null, nowTs: number): string {
  if (!iso) return "—";
  const ts = Math.floor(Date.parse(iso) / 1000);
  return Number.isFinite(ts) ? relTime(ts, nowTs) : "—";
}

function metricLabel(source: InternetHealthSourceSummary): string {
  if (source.change_ratio != null) {
    const pct = source.change_ratio * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
  }
  if (source.value == null) return "—";
  return `${source.value.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}${source.unit ? ` ${source.unit}` : ""}`;
}

function sourceStatusLabel(source: InternetHealthSourceSummary): string {
  if (source.availability === "restricted") {
    if (source.detector_fresh) return "判定來源新鮮 · 明細不公開";
    if (source.detector_stale) return "判定來源逾時 · 明細不公開";
    return "明細不公開 · freshness 未知";
  }
  if (source.availability === "stale") return "資料逾時";
  if (source.availability === "missing") return source.key === "ncdr" ? "未通報／無資料" : "無資料";
  return STATUS_META[source.status].label;
}

function ageLabel(ageSeconds: number | null): string {
  if (ageSeconds == null || ageSeconds < 0) return "—";
  if (ageSeconds < 60) return `${Math.round(ageSeconds)}s`;
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m`;
  if (ageSeconds < 86400) return `${(ageSeconds / 3600).toFixed(ageSeconds < 36_000 ? 1 : 0)}h`;
  return `${(ageSeconds / 86400).toFixed(ageSeconds < 864_000 ? 1 : 0)}d`;
}

function confidenceLabel(source: InternetHealthSourceSummary): string {
  const score = source.confidence_score == null ? "" : ` ${(source.confidence_score * 100).toFixed(0)}%`;
  return `${source.confidence}${score}`;
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
  title, subtitle, source, measurements, signals, nowTs,
}: {
  title: string;
  subtitle: string;
  source: InternetHealthSourceSummary | undefined;
  measurements: InternetHealthMeasurement[];
  signals: InternetHealthMeasurementSignal[];
  nowTs: number;
}) {
  const current = measurements.filter((item) => item.freshness === "fresh").length;
  const hasPartial = measurements.some((item) => item.state === "partial");
  const hasBaseline = measurements.some((item) => item.state === "baseline_building");
  const hasStale = measurements.some((item) => item.freshness === "stale");
  const freshness = source?.availability === "restricted" ? "LIMITED"
    : current > 0 ? "CURRENT"
      : hasPartial ? "PARTIAL"
        : hasBaseline ? "BASELINE"
          : hasStale ? "STALE"
            : measurements.length > 0 ? "UNAVAILABLE" : "NO DATA";
  const freshnessColor = current > 0 ? "#22d3ee" : COLORS.textDim;
  const pairs = signals.filter((_, index) => index % 2 === 0);
  return (
    <div
      data-testid={`internet-health-measurements-${source?.key ?? "missing"}`}
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
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: freshnessColor, letterSpacing: "0.8px" }}>{freshness}</span>
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

function SourceEvidenceRow({ source, nowTs }: { source: InternetHealthSourceSummary; nowTs: number }) {
  const meta = STATUS_META[source.fresh ? source.status : "unknown"];
  const restricted = source.availability === "restricted";
  const timestamp = source.source_updated_at ?? source.observed_at;
  return (
    <div
      data-testid={`internet-health-source-${source.key}`}
      style={{
        display: "grid", gridTemplateColumns: "minmax(110px, 1fr) auto",
        alignItems: "center", columnGap: 9, rowGap: 2, padding: "7px 9px", borderRadius: RADIUS.lg,
        background: "rgba(255,255,255,0.025)", border: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span
          style={{
            width: 7, height: 7, borderRadius: RADIUS.full, background: meta.color,
            boxShadow: source.fresh ? `0 0 5px ${meta.color}` : "none", flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, fontWeight: 700,
            color: COLORS.textDefault, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {source.label}
        </span>
        {restricted && (
          <span
            style={{
              padding: "1px 5px", borderRadius: RADIUS.full, border: `1px solid ${COLORS.borderMid}`,
              color: COLORS.textDim, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
              letterSpacing: "0.6px", flexShrink: 0,
            }}
          >
            LIMITED
          </span>
        )}
      </span>
      <span style={{ minWidth: 0, gridColumn: "1 / -1", gridRow: 2 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: meta.color }}>
          {sourceStatusLabel(source)}
        </span>
        <span
          style={{
            display: "block", marginTop: 1, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
            color: COLORS.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          title={source.signal ?? undefined}
        >
          {restricted ? "detector evidence" : (source.signal ?? "—")} · {timestamp ? timeLabel(timestamp, nowTs) : "—"}
        </span>
        <span
          style={{
            display: "block", marginTop: 1, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs,
            color: COLORS.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          age {ageLabel(source.age_seconds)} · n={source.sample_count?.toLocaleString("zh-TW") ?? "—"} · confidence {confidenceLabel(source)}
        </span>
      </span>
      <span
        style={{
          gridColumn: 2, gridRow: 1,
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700,
          color: source.fresh ? meta.color : COLORS.textFaint, whiteSpace: "nowrap",
        }}
      >
        {restricted ? "—" : metricLabel(source)}
      </span>
    </div>
  );
}

const INCIDENT_KIND_LABELS: Record<string, string> = {
  single_asn_outage: "單一電信商異常",
  multi_asn_partial_outage: "多家電信商局部異常",
  national_outage: "全臺大規模中斷",
  international_path_degradation: "國際路徑異常",
  selective_service_blocking: "特定服務異常",
};

function IncidentRow({ incident, nowTs }: { incident: InternetHealthIncident; nowTs: number }) {
  const meta = STATUS_META[incident.severity];
  const kind = incident.kind ? (INCIDENT_KIND_LABELS[incident.kind] ?? incident.kind.replace(/_/g, " ")) : "網路異常";
  const entity = incident.entity_name ?? incident.entity_id;
  return (
    <div
      data-testid="internet-health-incident"
      style={{
        display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 8px",
        borderRadius: RADIUS.lg, background: meta.tint, border: `1px solid ${meta.color}44`,
      }}
    >
      <span style={{ width: 7, height: 7, marginTop: 4, borderRadius: RADIUS.full, background: meta.color, flexShrink: 0 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>
          {entity} · {kind}
        </span>
        <span style={{ display: "block", marginTop: 1, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
          {incident.source} · {timeLabel(incident.observed_at, nowTs)} · confidence {incident.confidence}
        </span>
      </span>
    </div>
  );
}

export function TelecomStatusCardView({
  summary, phase, nowTs,
}: {
  summary: InternetHealthSummary | null;
  phase: InternetHealthPhase;
  nowTs: number;
}) {
  // 載入失敗時即使留有上次成功資料，也不能繼續亮 normal。
  const effectiveStatus: InternetHealthStatus = phase === "error"
    ? "unknown"
    : (summary?.overall_status ?? "unknown");
  const meta = STATUS_META[effectiveStatus];
  const baselineBuilding = phase === "ready" && summary?.assessment_phase === "baseline_building";
  const statusLabel = baselineBuilding ? "建立基準中" : meta.label;
  const statusEn = baselineBuilding ? "UNKNOWN · BASELINE BUILDING" : meta.en;
  const description = phase === "loading"
    ? "正在取得多來源觀測…"
    : phase === "error"
      ? "本次更新失敗，暫時無法判斷"
      : (summary?.summary ?? "核心來源不足，暫時無法判斷");
  const sources = (summary?.sources ?? []).map((source) => phase === "error"
    ? {
        ...source,
        status: "unknown" as const,
        fresh: false,
        availability: source.availability === "restricted" ? "restricted" as const : "missing" as const,
        detector_fresh: false,
        detector_stale: false,
      }
    : source);
  const incidents = summary?.incidents ?? [];
  const confidence = phase === "error" ? "unknown" : (summary?.confidence ?? "unknown");
  const confidenceScore = phase === "error" ? null : (summary?.confidence_score ?? null);
  const freshSourceCount = phase === "error" ? 0 : (summary?.fresh_source_count ?? 0);
  const measurements = phase === "error" ? [] : (summary?.measurements ?? []);
  const atlasSource = sources.find((source) => source.key === "ripe_atlas");
  const risSource = sources.find((source) => source.key === "ripe_ris");
  const supportingSources = sources.filter((source) => (
    source.key === "cloudflare" || source.key === "ioda" || source.key === "ncdr"
  ));
  const quorumLabel = phase === "error" || summary?.normal_quorum_met == null
    ? "—"
    : summary.normal_quorum_met ? "PASS" : "NO";

  return (
    <div data-testid="internet-health-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel color="#22d3ee">電信與網路 · CONNECTIVITY</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.xl, border: `1px solid ${meta.color}55`,
          background: `linear-gradient(145deg, ${meta.tint}, rgba(255,255,255,0.012) 48%)`,
          padding: "12px 14px", display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
          gap: 14, alignItems: "stretch",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10, gridColumn: "1 / -1" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                data-testid="internet-health-status-dot"
                style={{
                  width: 12, height: 12, borderRadius: RADIUS.full, background: meta.color,
                  boxShadow: effectiveStatus === "unknown" ? "none" : `0 0 8px ${meta.color}`,
                }}
              />
              <span
                data-testid="internet-health-status-label"
                style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: meta.color }}
              >
                {statusLabel}
              </span>
            </div>
            <div style={{ marginTop: 4, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.6px", color: COLORS.textFaint }}>
              {statusEn} · confidence {confidence}{confidenceScore == null ? "" : ` ${(confidenceScore * 100).toFixed(0)}%`}
            </div>
          </div>
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, lineHeight: 1.45, color: COLORS.textMuted }}>
            {description}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
              FRESH PUBLIC<br />
              <b style={{ fontSize: FONT_SIZE.md, color: COLORS.textDefault }}>
                {freshSourceCount}/{summary?.public_source_total ?? 2}
              </b>
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
              NORMAL QUORUM<br />
              <b style={{ fontSize: FONT_SIZE.sm, color: summary?.normal_quorum_met ? COLORS.statusLive : COLORS.textDefault }}>
                {quorumLabel}
              </b>
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
              LAST UPDATE<br />
              <b style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>
                {timeLabel(summary?.last_updated_at ?? null, nowTs)}
              </b>
            </span>
          </div>
        </div>

        <div
          style={{
            gridColumn: "1 / -1", display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 10,
          }}
        >
          <MeasurementCard
            title="RIPE Atlas" subtitle="端到端主動量測 · RIPE NCC"
            source={atlasSource} measurements={measurements.filter((item) => item.source_key === "ripe_atlas")}
            signals={ATLAS_SIGNALS} nowTs={nowTs}
          />
          <MeasurementCard
            title="RIPE RIS Live" subtitle="BGP 路由觀測 · RIPE NCC"
            source={risSource} measurements={measurements.filter((item) => item.source_key === "ripe_ris")}
            signals={RIS_SIGNALS} nowTs={nowTs}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.2px", color: COLORS.textDim }}>
            SUPPORTING EVIDENCE
          </span>
          {supportingSources.length > 0
            ? supportingSources.map((source) => <SourceEvidenceRow key={source.key} source={source} nowTs={nowTs} />)
            : (["Cloudflare Radar", "IODA", "NCDR"] as const).map((label) => (
              <div key={label} style={{ padding: "7px 9px", borderRadius: RADIUS.lg, border: `1px solid ${COLORS.borderSoft}`, color: COLORS.textFaint, fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm }}>
                {label} · —
              </div>
            ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.2px", color: COLORS.textDim }}>
            ACTIVE INCIDENTS
          </span>
          {incidents.length > 0
            ? incidents.slice(0, 3).map((incident) => <IncidentRow key={incident.id} incident={incident} nowTs={nowTs} />)
            : (
              <div
                style={{
                  flex: 1, minHeight: 54, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: RADIUS.lg, border: `1px dashed ${COLORS.borderMid}`,
                  fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, textAlign: "center",
                }}
              >
                {effectiveStatus === "normal" ? "目前沒有 active incident" : "沒有可確認的 incident 資料"}
              </div>
            )}
          <span style={{ marginTop: "auto", fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, lineHeight: 1.4, color: COLORS.textFaint }}>
            Atlas 與 RIS 同屬 RIPE NCC，不視為兩個獨立 quorum。量測 freshness 與狀態判讀分離；100% Ping、0 Origin 變更或 0 Withdrawal 都不能單獨推導為正常。ASN／prefix 僅列文字，不推測服務範圍。
          </span>
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

  return <TelecomStatusCardView summary={summary} phase={phase} nowTs={nowTs} />;
}
