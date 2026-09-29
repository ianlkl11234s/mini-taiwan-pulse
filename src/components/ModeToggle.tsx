import type { AppMode } from "../types";
import { COLORS, FONT_CJK } from "../styles/designTokens";
import { getToolbarPalette } from "./toolbar/toolbarTheme";

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
        title="即時 24 小時內動態"
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
        即時
      </button>
      <button
        style={tab(isHistorical)}
        onClick={() => onAppModeChange("historical")}
        title="跨年度長時序資料"
      >
        歷史
      </button>
    </div>
  );
}
