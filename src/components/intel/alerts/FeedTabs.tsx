import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";

export type FeedTab = "all" | "news" | "alerts";

interface Props {
  tab: FeedTab;
  onTab: (t: FeedTab) => void;
  newsCount: number;
  alertCount: number;
  alertSevere: number;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: "all",    label: "全部" },
  { key: "news",   label: "新聞" },
  { key: "alerts", label: "警報" },
];

export function FeedTabs({ tab, onTab, newsCount, alertCount, alertSevere }: Props) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex", gap: 4,
        padding: "8px 14px 6px",
        borderBottom: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.key;
        const isAlerts = t.key === "alerts";
        const hot = isAlerts && alertSevere > 0;
        const count =
          t.key === "news" ? newsCount
            : t.key === "alerts" ? alertCount
              : newsCount + alertCount;
        return (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            style={{
              flex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "5px 8px",
              borderRadius: RADIUS.lg,
              cursor: "pointer",
              background: active
                ? (hot ? "rgba(239,68,68,0.16)" : COLORS.accentFaint)
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${active
                ? (hot ? "rgba(239,68,68,0.55)" : COLORS.accentSoft)
                : COLORS.borderMid}`,
              color: active
                ? (hot ? "#ef4444" : COLORS.accent)
                : COLORS.textMuted,
              fontFamily: FONT_CJK, fontSize: 11.5, fontWeight: 600,
            }}
          >
            {t.label}
            <span
              style={{
                fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, fontWeight: 700,
                color: hot && active ? "#ef4444" : "inherit",
                opacity: 0.9,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
