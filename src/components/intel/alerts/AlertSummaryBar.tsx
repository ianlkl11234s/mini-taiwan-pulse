import { IntelIcon } from "../IntelIcon";
import {
  FONT_CJK, FONT_DATA, MICON,
  ALERT_GROUPS_DEF, ALERT_GROUP_ORDER,
  withAlpha,
  type AlertGroupShort,
} from "../intelTokens";
import { neutralFill, useIntelTheme } from "../intelTheme";
import type { AlertTally } from "../../../data/alertsLoader";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import type { IntelQueryStatus } from "../../../hooks/useIntelPollingQuery";

interface Props {
  tally: AlertTally;
  status: IntelQueryStatus;
  lastSuccessAt: number | null;
  expanded: boolean;
  onToggle: () => void;
  activeGroups: AlertGroupShort[];
  onPickGroup: (g: AlertGroupShort) => void;
}

export function AlertSummaryBar({
  tally, status, lastSuccessAt, expanded, onToggle, activeGroups, onPickGroup,
}: Props) {
  const palette = useIntelTheme();
  const { total, severe, byGroup } = tally;

  if (status !== "ready") {
    const label = status === "denied" ? "警報摘要無權限讀取" : status === "error" ? "警報摘要更新中斷" : "警報摘要讀取中";
    const at = status === "error" && lastSuccessAt
      ? ` · 最後成功 ${new Date(lastSuccessAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
      : "";
    return (
      <div style={{ flexShrink: 0, padding: "6px 14px", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: palette.textMuted, borderBottom: `1px solid ${palette.borderSoft}` }}>
        {label}{at}
      </div>
    );
  }

  // 0-state — 極簡單條
  if (total === 0) {
    return (
      <div
        style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 14px",
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
          color: palette.textFaint,
          borderBottom: `1px solid ${palette.borderSoft}`,
        }}
      >
        <IntelIcon d={MICON.check!} size={12} color={palette.statusLive} />
        <span>目前全國無 active 警報</span>
      </div>
    );
  }

  return (
    <div
      style={{
        flexShrink: 0,
        borderBottom: `1px solid ${palette.panelBorder}`,
        background: severe > 0 ? withAlpha(palette.statusErr, 0.04) : "transparent",
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
          color: palette.textDefault,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <IntelIcon
          d={MICON.warn!}
          size={14}
          color={severe > 0 ? palette.statusErr : palette.statusWarn}
        />
        <span style={{ fontFamily: FONT_CJK, fontSize: 12.5, fontWeight: 700, color: palette.textStrong }}>
          {total} 則警報
        </span>
        {severe > 0 && (
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "1px 7px", borderRadius: RADIUS.md,
              background: "transparent",
              border: `1px solid ${withAlpha(palette.statusErr, 0.5)}`,
              fontFamily: FONT_CJK, fontSize: 9.5, fontWeight: 700,
              color: palette.statusErr,
              animation: "alertBreathe 2s ease-in-out infinite",
            }}
          >
            含 <span style={{ fontFamily: FONT_DATA }}>{severe}</span> 則嚴重
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
          color={palette.textMuted}
        />
      </button>

      {expanded && (
        <div
          style={{
            display: "grid",
            // 窄容器自動降欄。⚠️ 與 AlertBoard policy **不同**：那邊 2026-08-16 起
            // 固定 3×2（六個分類是固定一組，欄數浮動會變 5+1）；這裡是可收合的
            // 摘要條、寬度隨主面板變動範圍大得多，維持 auto-fit。改動時別互相對齊。
            gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
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
                    ? withAlpha(palette.accent, 0.14)
                    : dim
                      ? neutralFill(0.02, palette.isDark)
                      : neutralFill(0.05, palette.isDark),
                  border: `1px solid ${active ? palette.borderAccent : palette.borderMid}`,
                  cursor: dim ? "default" : "pointer",
                  opacity: dim ? 0.38 : 1,
                  animation: sev > 0 ? "alertBreathe 3s ease-in-out infinite" : undefined,
                }}
              >
                <IntelIcon d={MICON[def.iconKey]!} size={12} color={def.color} />
                <span
                  style={{
                    fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: 600,
                    color: palette.textDefault, whiteSpace: "nowrap",
                  }}
                >
                  {def.label}
                </span>
                <div style={{ flex: 1 }} />
                <span
                  style={{
                    fontFamily: FONT_DATA, fontSize: FONT_SIZE.base, fontWeight: 700,
                    color: sev > 0 ? palette.statusErr : palette.textStrong,
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
