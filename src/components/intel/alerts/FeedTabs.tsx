import { FONT_CJK, FONT_DATA, withAlpha } from "../intelTokens";
import { useLocale } from "../../../state/localeStore";
import { useIntelTheme } from "../intelTheme";
import { RADIUS, FONT_SIZE } from "../../../styles/designTokens";
import { feedCounts } from "./feedCounts";

export type FeedTab = "all" | "news" | "alerts" | "globalEvents";

interface Props {
  tab: FeedTab;
  onTab: (t: FeedTab) => void;
  newsCount: number;
  /** 警報 tab 的數字 = 全部 active（含折疊區） */
  alertCount: number;
  alertSevere: number;
  /** 全球情勢 tab 的數字 = decision + RANGE 過濾後的筆數 */
  globalCount: number;
}

const TABS = [
  { key: "all", labelKey: "alerts.tabs.all" },
  { key: "news", labelKey: "alerts.tabs.news" },
  { key: "alerts", labelKey: "alerts.tabs.alerts" },
  { key: "globalEvents", labelKey: "alerts.tabs.globalEvents" },
] as const satisfies readonly { key: FeedTab; labelKey: string }[];

export function FeedTabs({ tab, onTab, newsCount, alertCount, alertSevere, globalCount }: Props) {
  const palette = useIntelTheme();
  const { t } = useLocale();
  const counts = feedCounts({ news: newsCount, alerts: alertCount, globalEvents: globalCount });
  return (
    <div
      style={{
        flexShrink: 0,
        padding: "8px 14px 6px",
        borderBottom: `1px solid ${palette.borderSoft}`,
      }}
    >
      <div
        role="tablist"
        aria-label={t("alerts.tabs.ariaLabel")}
        style={{
          display: "flex", gap: 2,
          padding: 2,
          borderRadius: RADIUS.lg,
          border: `1px solid ${palette.controlBorder}`,
          background: palette.controlBg,
        }}
      >
        {TABS.map(({ key, labelKey }) => {
          const active = tab === key;
          const isAlerts = key === "alerts";
          const hot = isAlerts && alertSevere > 0;
          const count = counts[key];
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => onTab(key)}
              style={{
                flex: 1,
                minWidth: 0, whiteSpace: "nowrap",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                padding: "5px 6px",
                borderRadius: RADIUS.md,
                border: "none",
                cursor: "pointer",
                background: active
                  ? (hot ? withAlpha(palette.statusErr, 0.16) : palette.accentFaint)
                  : "transparent",
                color: active
                  ? (hot ? palette.statusErr : palette.accent)
                  : palette.textMuted,
                fontFamily: FONT_CJK, fontSize: 11.5, fontWeight: 600,
              }}
            >
              {t(labelKey)}
              <span
                style={{
                  fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, fontWeight: 700,
                  color: hot && active ? palette.statusErr : "inherit",
                  opacity: 0.9,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
