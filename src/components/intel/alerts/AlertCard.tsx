import { useEffect, useState } from "react";
import { IntelIcon } from "../IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, MICON,
  ALERT_GROUPS_DEF, alertSeverity, fmtExpiry, relTime, clockTime,
} from "../intelTokens";
import type { ActiveAlert } from "../../../data/alertsLoader";

interface Props {
  a: ActiveAlert;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  nowTs: number;
}

export function AlertCard({ a, selected, expanded, onSelect, onToggle, nowTs }: Props) {
  const def = ALERT_GROUPS_DEF[a.group];
  const sev = alertSeverity(a.severity);

  // 倒數即時刷新（僅在 expanded 或 severity>=3 時 1s tick）
  const [tick, setTick] = useState(nowTs);
  useEffect(() => {
    if (!expanded && a.severity < 3) return;
    const id = window.setInterval(() => setTick(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [expanded, a.severity]);

  const effNow = expanded || a.severity >= 3 ? tick : nowTs;
  const expiresInSec = a.expires_ts - effNow;
  const expired = expiresInSec <= 0;

  const onCardClick = () => {
    onSelect(a.id);
    onToggle(a.id);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div style={{ position: "relative", paddingLeft: 26 }}>
      {/* spine dot */}
      <span
        style={{
          position: "absolute",
          left: 7, top: 14,
          width: 11, height: 11,
          borderRadius: "50%",
          background: sev.color,
          border: "2px solid #0a0a14",
          zIndex: 1,
          boxShadow: selected ? `0 0 0 3px ${sev.color}55` : "none",
          animation: sev.anim ?? undefined,
        }}
      />
      <div
        onClick={onCardClick}
        style={{
          cursor: "pointer",
          padding: "10px 12px",
          borderRadius: 7,
          background: selected ? "rgba(100,170,255,0.06)" : "rgba(255,255,255,0.025)",
          border: `1px solid ${selected ? COLORS.borderAccent : COLORS.borderMid}`,
          animation: a.severity >= 3 ? "alertEdge 2s ease-in-out infinite" : undefined,
        }}
      >
        {/* chip row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "1px 7px", borderRadius: 4,
              background: `${def.color}22`,
              border: `1px solid ${def.color}55`,
              fontFamily: FONT_DATA, fontSize: 9.5, fontWeight: 700,
              color: def.color, letterSpacing: "0.5px",
            }}
          >
            <IntelIcon d={MICON[def.iconKey]!} size={10} color={def.color} />
            {def.label}
          </span>
          <span
            style={{
              padding: "1px 7px", borderRadius: 4,
              background: `${sev.color}22`,
              border: `1px solid ${sev.color}55`,
              fontFamily: FONT_DATA, fontSize: 9.5, fontWeight: 700,
              color: sev.color, letterSpacing: "0.5px",
              animation: sev.anim ?? undefined,
            }}
          >
            {sev.label}
          </span>
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 9.5,
              color: COLORS.textFaint,
            }}
          >
            {a.term}
          </span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: FONT_DATA, fontSize: 9.5,
              color: expired ? COLORS.textFaint : COLORS.textMuted,
            }}
          >
            {expired ? "已過期" : fmtExpiry(a.expires_ts, effNow)}
          </span>
        </div>

        {/* headline */}
        <div
          style={{
            fontFamily: FONT_CJK, fontSize: 13, fontWeight: 600,
            color: COLORS.textStrong, lineHeight: 1.45, marginBottom: 4,
          }}
        >
          {a.headline || a.term}
        </div>

        {/* location + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <IntelIcon d={MICON.pin!} size={10} color={COLORS.textMuted} />
            <span style={{ fontFamily: FONT_CJK, fontSize: 11, color: COLORS.textMuted }}>
              {a.county}
              {a.area_count > 1 && (
                <span style={{ color: COLORS.textFaint }}> · {a.area_count} 區</span>
              )}
            </span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <IntelIcon d={MICON.clock!} size={10} color={COLORS.textMuted} />
            <span style={{ fontFamily: FONT_DATA, fontSize: 10.5, color: COLORS.textMuted }}>
              {relTime(a.sent_ts, effNow)}
            </span>
          </span>
        </div>

        {/* expanded */}
        {expanded && (
          <div
            onClick={stop}
            style={{
              marginTop: 9, paddingTop: 9,
              borderTop: `1px solid ${COLORS.borderSoft}`,
              animation: "drawerOpen .25s ease-out",
            }}
          >
            {a.description && (
              <div
                style={{
                  fontFamily: FONT_CJK, fontSize: 11.5,
                  color: COLORS.textDefault, lineHeight: 1.55,
                  marginBottom: 8,
                }}
              >
                {a.description}
              </div>
            )}
            {a.instruction && (
              <div
                style={{
                  padding: "7px 9px",
                  borderRadius: 5,
                  background: `${def.color}10`,
                  border: `1px solid ${def.color}33`,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_DATA, fontSize: 9, fontWeight: 700,
                    color: def.color, letterSpacing: "1px", marginBottom: 3,
                  }}
                >
                  處置指引
                </div>
                <div
                  style={{
                    fontFamily: FONT_CJK, fontSize: 11.5,
                    color: COLORS.textDefault, lineHeight: 1.55,
                  }}
                >
                  {a.instruction}
                </div>
              </div>
            )}

            {/* meta grid */}
            <div
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px",
                fontFamily: FONT_DATA, fontSize: 10,
              }}
            >
              <span style={{ color: COLORS.textFaint }}>發佈</span>
              <span style={{ color: COLORS.textMuted }}>{clockTime(a.sent_ts)}</span>
              <span style={{ color: COLORS.textFaint }}>失效</span>
              <span style={{ color: COLORS.textMuted }}>{clockTime(a.expires_ts)}</span>
              {a.magnitude != null && (
                <>
                  <span style={{ color: COLORS.textFaint }}>規模</span>
                  <span style={{ color: COLORS.textStrong, fontWeight: 700 }}>M {a.magnitude}</span>
                </>
              )}
              {a.depth_km != null && (
                <>
                  <span style={{ color: COLORS.textFaint }}>深度</span>
                  <span style={{ color: COLORS.textMuted }}>{a.depth_km} km</span>
                </>
              )}
              {a.area_desc && a.area_desc !== a.county && (
                <>
                  <span style={{ color: COLORS.textFaint }}>範圍</span>
                  <span style={{ color: COLORS.textMuted, lineHeight: 1.5 }}>{a.area_desc}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
