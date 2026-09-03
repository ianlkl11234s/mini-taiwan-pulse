import { COLORS, FONT_CJK, FONT_DATA } from "../intelTokens";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";

export type FeedTab = "all" | "news" | "alerts" | "globalEvents";

interface Props {
  tab: FeedTab;
  onTab: (t: FeedTab) => void;
  newsCount: number;
  /** 警報 tab 的數字 = 全部 active（含折疊區） */
  alertCount: number;
  /** 全部 tab 的數字只算沒被折疊的（長期持續事件不進「全部」時間軸） */
  alertCountInAll: number;
  alertSevere: number;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: "all",    label: "全部" },
  { key: "news",   label: "新聞" },
  { key: "alerts", label: "警報" },
  { key: "globalEvents", label: "全球情勢" },
];

export function FeedTabs({ tab, onTab, newsCount, alertCount, alertCountInAll, alertSevere }: Props) {
  return (
    <div
      role="tablist"
      aria-label="情報分頁"
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
          t.key === "globalEvents" ? null : t.key === "news" ? newsCount
            : t.key === "alerts" ? alertCount
              : newsCount + alertCountInAll;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onTab(t.key)}
            style={{
              flex: 1,
              minWidth: 0, whiteSpace: "nowrap",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "5px 6px",
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
            {count !== null && <span
              style={{
                fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, fontWeight: 700,
                color: hot && active ? "#ef4444" : "inherit",
                opacity: 0.9,
              }}
            >
              {count}
            </span>}
          </button>
        );
      })}
    </div>
  );
}
