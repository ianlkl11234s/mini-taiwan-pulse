import { IntelIcon } from "../IntelIcon";
import {
  COLORS, FONT_CJK, FONT_DATA, MICON,
  ALERT_GROUPS_DEF, ALERT_GROUP_ORDER,
  type AlertGroupShort,
} from "../intelTokens";
import type { AlertTally } from "../../../data/alertsLoader";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";

interface Props {
  tally: AlertTally;
  expanded: boolean;
  onToggle: () => void;
  activeGroups: AlertGroupShort[];
  onPickGroup: (g: AlertGroupShort) => void;
}

export function AlertSummaryBar({
  tally, expanded, onToggle, activeGroups, onPickGroup,
}: Props) {
  const { total, severe, byGroup } = tally;

  // 0-state — 極簡單條
  if (total === 0) {
    return (
      <div
        style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px",
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
          color: COLORS.textFaint,
          borderBottom: `1px solid ${COLORS.borderSoft}`,
        }}
      >
        <IntelIcon d={MICON.check!} size={12} color={COLORS.statusLive} />
        <span>目前全國無 active 警報</span>
      </div>
    );
  }

  return (
    <div
      style={{
        flexShrink: 0,
        borderBottom: `1px solid ${COLORS.panelBorder}`,
        background: severe > 0 ? "rgba(239,68,68,0.04)" : "transparent",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 14px",
          background: "transparent",
          border: "none",
          color: COLORS.textDefault,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <IntelIcon
          d={MICON.warn!}
          size={14}
          color={severe > 0 ? "#ef4444" : COLORS.statusWarn}
        />
        <span style={{ fontFamily: FONT_CJK, fontSize: 12.5, fontWeight: 700, color: COLORS.textStrong }}>
          {total} 則警報
        </span>
        {severe > 0 && (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "1px 7px", borderRadius: RADIUS.md,
              background: "rgba(239,68,68,0.18)",
              border: "1px solid rgba(239,68,68,0.45)",
              fontFamily: FONT_DATA, fontSize: 9.5, fontWeight: 700,
              color: "#ef4444",
              animation: "alertBreathe 2s ease-in-out infinite",
            }}
          >
            含 {severe} 則嚴重
          </span>
        )}
        {!expanded && (
          <div style={{ display: "inline-flex", gap: 4, marginLeft: 6 }}>
            {ALERT_GROUP_ORDER.map((g) => {
              const s = byGroup.get(g);
              if (!s || s.count === 0) return null;
              const def = ALERT_GROUPS_DEF[g];
              const hot = s.severe > 0;
              return (
                <span
                  key={g}
                  title={`${def.label} ${s.count}`}
                  style={{
                    width: 7, height: 7, borderRadius: RADIUS.full,
                    background: def.color,
                    boxShadow: hot ? `0 0 6px ${def.color}` : "none",
                    opacity: hot ? 1 : 0.78,
                  }}
                />
              );
            })}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <IntelIcon
          d={(expanded ? MICON.chevUp : MICON.chevDown)!}
          size={12}
          color={COLORS.textMuted}
        />
      </button>

      {expanded && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            padding: "2px 12px 11px",
          }}
        >
          {ALERT_GROUP_ORDER.map((g) => {
            const s = byGroup.get(g);
            const def = ALERT_GROUPS_DEF[g];
            const cnt = s?.count ?? 0;
            const sev = s?.severe ?? 0;
            const active = activeGroups.includes(g);
            const dim = cnt === 0;
            return (
              <button
                key={g}
                onClick={() => onPickGroup(g)}
                disabled={dim}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 8px",
                  borderRadius: RADIUS.lg,
                  background: active
                    ? "rgba(100,170,255,0.14)"
                    : dim
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.05)",
                  border: `1px solid ${active ? COLORS.borderAccent : COLORS.borderMid}`,
                  cursor: dim ? "default" : "pointer",
                  opacity: dim ? 0.38 : 1,
                  animation: sev > 0 ? "alertBreathe 3s ease-in-out infinite" : undefined,
                }}
              >
                <IntelIcon d={MICON[def.iconKey]!} size={12} color={def.color} />
                <span
                  style={{
                    fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: 600,
                    color: COLORS.textDefault, whiteSpace: "nowrap",
                  }}
                >
                  {def.label}
                </span>
                <div style={{ flex: 1 }} />
                <span
                  style={{
                    fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700,
                    color: sev > 0 ? "#ef4444" : COLORS.textStrong,
                  }}
                >
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
