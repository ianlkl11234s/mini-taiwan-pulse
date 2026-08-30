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
  type InternetHealthSourceSummary,
  type InternetHealthStatus,
  type InternetHealthSummary,
} from "../../../data/internetHealthLoader";

export type InternetHealthPhase = "loading" | "ready" | "error";

const STATUS_META: Record<InternetHealthStatus, { label: string; en: string; color: string; tint: string }> = {
  normal: { label: "目前正常", en: "NORMAL", color: COLORS.statusLive, tint: "rgba(34,197,94,0.07)" },
  watch: { label: "需要留意", en: "WATCH", color: COLORS.statusWarn, tint: "rgba(250,204,21,0.07)" },
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
  if (!source.fresh) return source.key === "ncdr" ? "未通報／無資料" : "無資料";
  return STATUS_META[source.status].label;
}

function SourceEvidenceRow({ source, nowTs }: { source: InternetHealthSourceSummary; nowTs: number }) {
  const meta = STATUS_META[source.fresh ? source.status : "unknown"];
  return (
    <div
      data-testid={`internet-health-source-${source.key}`}
      style={{
        display: "grid", gridTemplateColumns: "minmax(110px, 1fr) auto",
        alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: RADIUS.lg,
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
          {source.signal ?? "—"} · {timeLabel(source.source_updated_at ?? source.observed_at, nowTs)}
        </span>
      </span>
      <span
        style={{
          gridColumn: 2, gridRow: 1,
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700,
          color: source.fresh ? meta.color : COLORS.textFaint, whiteSpace: "nowrap",
        }}
      >
        {metricLabel(source)}
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
  const description = phase === "loading"
    ? "正在取得多來源觀測…"
    : phase === "error"
      ? "本次更新失敗，暫時無法判斷"
      : (summary?.summary ?? "核心來源不足，暫時無法判斷");
  const sources = (summary?.sources ?? []).map((source) => phase === "error"
    ? { ...source, status: "unknown" as const, fresh: false }
    : source);
  const incidents = summary?.incidents ?? [];
  const confidence = phase === "error" ? "unknown" : (summary?.confidence ?? "unknown");
  const freshSourceCount = phase === "error" ? 0 : (summary?.fresh_source_count ?? 0);

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
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
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
                {meta.label}
              </span>
            </div>
            <div style={{ marginTop: 4, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.6px", color: COLORS.textFaint }}>
              {meta.en} · confidence {confidence}
            </div>
          </div>
          <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, lineHeight: 1.45, color: COLORS.textMuted }}>
            {description}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
              FRESH SOURCES<br />
              <b style={{ fontSize: FONT_SIZE.md, color: COLORS.textDefault }}>
                {freshSourceCount}/{summary?.source_total ?? 3}
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

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.2px", color: COLORS.textDim }}>
            SOURCE EVIDENCE
          </span>
          {sources.length > 0
            ? sources.map((source) => <SourceEvidenceRow key={source.key} source={source} nowTs={nowTs} />)
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
            Cloudflare Radar + IODA + NCDR；多來源觀測，不代表完整臺灣網路普查。ASN 僅列文字，不推測服務範圍。
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
