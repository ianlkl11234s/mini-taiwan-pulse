import { useSyncExternalStore } from "react";
import { COLORS, FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";
import { statisticsDisplayModeStore } from "../../state/statisticsDisplayModeStore";
import { layerVisibilityStore, useLayerVisibilityAll } from "../../state/layerVisibilityStore";

export function StatisticsModeControl() {
  const visibility = useLayerVisibilityAll();
  const { mode } = useSyncExternalStore(
    statisticsDisplayModeStore.subscribe,
    statisticsDisplayModeStore.getSnapshot,
    statisticsDisplayModeStore.getSnapshot,
  );

  const setMode = (nextMode: "single" | "overlap") => {
    layerVisibilityStore.setAll(statisticsDisplayModeStore.setMode(nextMode, visibility));
  };

  const modeButtonStyle = (active: boolean) => ({
    padding: 0,
    border: 0,
    background: "transparent",
    color: active ? COLORS.textStrong : COLORS.textDim,
    font: "inherit",
    fontWeight: active ? FONT_WEIGHT.bold : FONT_WEIGHT.regular,
    cursor: "pointer",
    transition: "color 0.15s ease",
  });

  return (
    <div
      role="group"
      aria-label="統計圖層顯示模式"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "0 12px 10px",
        minHeight: 20,
        color: COLORS.textMuted,
        fontSize: FONT_SIZE.sm,
      }}
    >
      <span style={{ marginRight: 2, fontWeight: FONT_WEIGHT.semibold }}>統計圖層顯示</span>
      <button
        type="button"
        aria-pressed={mode === "single"}
        style={modeButtonStyle(mode === "single")}
        onClick={() => setMode("single")}
      >
        單一
      </button>
      <button
        type="button"
        aria-pressed={mode === "overlap"}
        style={modeButtonStyle(mode === "overlap")}
        onClick={() => setMode("overlap")}
      >
        可重疊
      </button>
    </div>
  );
}
