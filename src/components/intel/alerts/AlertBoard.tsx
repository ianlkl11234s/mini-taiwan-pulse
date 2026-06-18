import { useEffect, useState } from "react";
import { IntelIcon } from "../IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, MICON,
  ALERT_GROUPS_DEF, ALERT_GROUP_ORDER, alertSeverity, relTime,
  type AlertGroupShort,
} from "../intelTokens";
import {
  fetchActiveAlerts,
  type AlertTally,
  type ActiveAlert,
} from "../../../data/alertsLoader";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";

interface Props {
  tally: AlertTally;
  series: Record<AlertGroupShort, number[]>;
  accent: string;
  nowTs: number;
}

// ─── AlertTrend — 24h 全 group 加總 area-line ──────────────────
function AlertTrend({
  series, accent,
}: { series: Record<AlertGroupShort, number[]>; accent: string }) {
  const totals = Array.from({ length: 24 }, (_, h) =>
    ALERT_GROUP_ORDER.reduce((sum, g) => sum + (series[g][h] ?? 0), 0),
  );
  const peak = Math.max(1, ...totals);
  const W = 100;
  const H = 28;

  const points = totals
    .map((v, i) => {
      const x = (i / 23) * W;
      const y = H - (v / peak) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,${H} ${points} ${W},${H}`;

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: RADIUS.lg,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${COLORS.borderMid}`,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5,
        }}
      >
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px",
            color: COLORS.textFaint,
          }}
        >
          24H TREND
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm,
            color: COLORS.textMuted,
          }}
        >
          Peak {peak}
        </span>
      </div>
      <svg
        width="100%"
        height={H + 6}
        viewBox={`0 0 ${W} ${H + 6}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <polygon points={area} fill={`${accent}33`} />
        <polyline
          points={points}
          fill="none"
          stroke={accent}
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// ─── Sparkline (per-group) ──────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const peak = Math.max(1, ...data);
  const W = 100;
  const H = 16;
  const pts = data
    .map((v, i) => {
      const x = (i / 23) * W;
      const y = H - (v / peak) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", opacity: 0.85 }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={0.8}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── GroupCard ───────────────────────────────
function GroupCard({
  group, count, severe, topTerm, spark, hot, onClick,
}: {
  group: AlertGroupShort;
  count: number;
  severe: number;
  topTerm: string | null;
  spark: number[];
  hot: boolean;
  onClick: () => void;
}) {
  const def = ALERT_GROUPS_DEF[group];
  const dim = count === 0;
  return (
    <button
      onClick={onClick}
      disabled={dim}
      style={{
        textAlign: "left",
        padding: "9px 10px",
        borderRadius: RADIUS.lg,
        background: dim
          ? "rgba(255,255,255,0.015)"
          : hot
            ? `${def.color}10`
            : "rgba(255,255,255,0.04)",
        border: `1px solid ${hot ? `${def.color}55` : COLORS.borderMid}`,
        opacity: dim ? 0.38 : 1,
        cursor: dim ? "default" : "pointer",
        display: "flex", flexDirection: "column", gap: 4,
        animation: hot ? "alertEdge 2s ease-in-out infinite" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <IntelIcon d={MICON[def.iconKey]!} size={11} color={def.color} />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: 600,
            color: COLORS.textDefault,
          }}
        >
          {def.label}
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: def.color,
            letterSpacing: "0.5px",
          }}
        >
          {def.en}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xxl, fontWeight: 700,
            color: hot ? def.color : COLORS.textStrong,
            lineHeight: 1,
          }}
        >
          {count}
        </span>
        {severe > 0 && (
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 9.5, fontWeight: 700,
              color: "#ef4444",
            }}
          >
            ⚠ {severe} 嚴重
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint,
          height: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {topTerm ?? "—"}
      </span>
      <Sparkline data={spark} color={def.color} />
    </button>
  );
}

// ─── AlertDrawer — 點開後展明細 ──────────────
function AlertDrawer({
  group, nowTs,
}: { group: AlertGroupShort; nowTs: number }) {
  const def = ALERT_GROUPS_DEF[group];
  const [rows, setRows] = useState<ActiveAlert[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchActiveAlerts(group, 1).then((data) => {
      if (alive) setRows(data);
    });
    return () => { alive = false; };
  }, [group]);

  if (rows === null) {
    return (
      <div
        style={{
          padding: "10px 12px", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
          color: COLORS.textFaint,
        }}
      >
        載入中…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "10px 12px", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
          color: COLORS.textFaint,
        }}
      >
        無 {def.label} 警報
      </div>
    );
  }

  return (
    <div
      className="mtp-scroll"
      style={{
        maxHeight: 220, overflowY: "auto",
        padding: "6px 10px 10px",
        animation: "drawerOpen .25s ease-out",
      }}
    >
      {rows.slice(0, 12).map((r) => {
        const sev = alertSeverity(r.severity);
        return (
          <div
            key={r.id}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 0",
              borderBottom: `1px solid ${COLORS.borderSoft}`,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: RADIUS.full,
                background: sev.color, flexShrink: 0,
                boxShadow: r.severity >= 3 ? `0 0 5px ${sev.color}` : "none",
              }}
            />
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
                color: COLORS.textDefault, flex: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              title={r.headline}
            >
              <span style={{ color: COLORS.textMuted, fontSize: FONT_SIZE.sm }}>{r.county} · </span>
              {r.headline || r.term}
            </span>
            <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textFaint }}>
              {relTime(r.sent_ts, nowTs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── AlertBoard 主元件 ───────────────────────
export function AlertBoard({ tally, series, accent, nowTs }: Props) {
  const [openGroup, setOpenGroup] = useState<AlertGroupShort | null>(null);

  // 0-state — 單條綠訊息
  if (tally.total === 0) {
    return (
      <div
        style={{
          padding: "9px 12px",
          borderRadius: RADIUS.lg,
          background: "rgba(34,197,94,0.06)",
          border: `1px solid ${COLORS.statusLiveBorder}`,
          display: "flex", alignItems: "center", gap: 7,
          marginBottom: 12,
        }}
      >
        <IntelIcon d={MICON.check!} size={12} color={COLORS.statusLive} />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: 11.5, color: COLORS.statusLive, fontWeight: 600,
          }}
        >
          目前全國無 active 警報
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px",
            color: COLORS.textFaint,
          }}
        >
          ALL CLEAR
        </span>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {/* section label */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "0 2px 6px",
        }}
      >
        <IntelIcon d={MICON.warn!} size={12} color="#ef4444" />
        <span
          style={{
            fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: 700,
            color: COLORS.textStrong, letterSpacing: "0.5px",
          }}
        >
          警訊整合
        </span>
        <span
          style={{
            fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px",
            color: COLORS.textDim,
          }}
        >
          NCDR + CWA
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
          {tally.total} 則
        </span>
        {tally.severe > 0 && (
          <span
            style={{
              padding: "1px 6px", borderRadius: RADIUS.md,
              background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.45)",
              fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, fontWeight: 700,
              color: "#ef4444",
              animation: "alertBreathe 2s ease-in-out infinite",
            }}
          >
            {tally.severe} 嚴重
          </span>
        )}
      </div>

      <AlertTrend series={series} accent={accent} />

      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
        }}
      >
        {ALERT_GROUP_ORDER.map((g) => {
          const s = tally.byGroup.get(g);
          return (
            <GroupCard
              key={g}
              group={g}
              count={s?.count ?? 0}
              severe={s?.severe ?? 0}
              topTerm={s?.top_term ?? null}
              spark={series[g] ?? Array.from({ length: 24 }, () => 0)}
              hot={(s?.severe ?? 0) > 0}
              onClick={() => setOpenGroup((p) => (p === g ? null : g))}
            />
          );
        })}
      </div>

      {openGroup && (
        <div
          style={{
            marginTop: 8,
            borderRadius: RADIUS.lg,
            background: "rgba(0,0,0,0.32)",
            border: `1px solid ${COLORS.borderMid}`,
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 10px",
              borderBottom: `1px solid ${COLORS.borderSoft}`,
            }}
          >
            <IntelIcon
              d={MICON[ALERT_GROUPS_DEF[openGroup].iconKey]!}
              size={11}
              color={ALERT_GROUPS_DEF[openGroup].color}
            />
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: 11.5, fontWeight: 700,
                color: COLORS.textStrong,
              }}
            >
              {ALERT_GROUPS_DEF[openGroup].label}明細
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setOpenGroup(null)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: COLORS.textMuted, padding: 2,
              }}
            >
              <IntelIcon d={MICON.chevUp!} size={11} />
            </button>
          </div>
          <AlertDrawer group={openGroup} nowTs={nowTs} />
        </div>
      )}
    </div>
  );
}
