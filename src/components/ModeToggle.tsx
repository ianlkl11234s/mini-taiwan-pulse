import type { AppMode } from "../types";
import { COLORS, FONT_CJK } from "../styles/designTokens";
import { getToolbarPalette } from "./toolbar/toolbarTheme";
import { useLocale } from "../state/localeStore";

interface Props {
  appMode: AppMode;
  isDarkTheme?: boolean;
  onAppModeChange: (mode: AppMode) => void;
}

export function ModeToggle({
  appMode,
  isDarkTheme = true,
  onAppModeChange,
}: Props) {
  const { t } = useLocale();
  const isHistorical = appMode === "historical";
  const p = getToolbarPalette(isDarkTheme);

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    height: 26,
    padding: 2,
    gap: 2,
    borderRadius: 5,
    background: p.controlBg,
    border: "1px solid transparent",
    fontFamily: FONT_CJK,
  };

  const tab = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "0 9px",
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    border: "none",
    borderRadius: 3,
    color: active ? p.accent : p.textMuted,
    background: active ? p.accentFaint : "transparent",
    fontFamily: "inherit",
  });

  return (
    <div style={containerStyle}>
      <button
        style={tab(!isHistorical)}
        onClick={() => onAppModeChange("realtime")}
        title={t("toolbar.mode.realtimeTitle")}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: COLORS.statusLive,
            flexShrink: 0,
          }}
        />
        {t("toolbar.mode.realtime")}
      </button>
      <button
        style={tab(isHistorical)}
        onClick={() => onAppModeChange("historical")}
        title={t("toolbar.mode.historicalTitle")}
      >
        {t("toolbar.mode.historical")}
      </button>
    </div>
  );
}
