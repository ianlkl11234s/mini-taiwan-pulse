import type { AppMode } from "../types";
import { FONT_DATA } from "../styles/designTokens";

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
  const dark = isDarkTheme;
  const isHistorical = appMode === "historical";

  const containerStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
    padding: 4,
    background: dark ? "rgba(30,30,30,0.85)" : "rgba(255,255,255,0.92)",
    border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 6,
    backdropFilter: "blur(8px)",
    fontFamily: FONT_DATA,
  };

  const tab = (active: boolean): React.CSSProperties => ({
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    cursor: "pointer",
    border: "none",
    borderRadius: 4,
    color: active ? "#4caf50" : dark ? "rgba(220,220,220,0.85)" : "#555",
    background: active
      ? "rgba(76,175,80,0.18)"
      : "transparent",
    fontFamily: "inherit",
  });

  return (
    <div style={containerStyle}>
      <button
        style={tab(!isHistorical)}
        onClick={() => onAppModeChange("realtime")}
        title="即時 24 小時內動態"
      >
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
