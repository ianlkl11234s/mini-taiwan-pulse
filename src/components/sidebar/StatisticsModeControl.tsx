import { useSyncExternalStore } from "react";
import { BORDER, COLORS, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { statisticsDisplayModeStore } from "../../state/statisticsDisplayModeStore";
import { layerVisibilityStore, useLayerVisibilityAll } from "../../state/layerVisibilityStore";

export function StatisticsModeControl() {
  const visibility = useLayerVisibilityAll();
  const { mode } = useSyncExternalStore(
    statisticsDisplayModeStore.subscribe,
    statisticsDisplayModeStore.getSnapshot,
    statisticsDisplayModeStore.getSnapshot,
  );

  return (
    <fieldset
      aria-label="統計圖層顯示模式"
      style={{
        margin: "0 12px 8px",
        padding: "8px",
        border: `1px solid ${BORDER.panel}`,
        borderRadius: RADIUS.lg,
        color: COLORS.textDefault,
      }}
    >
      <legend style={{ padding: "0 4px", fontSize: FONT_SIZE.sm }}>統計圖層顯示</legend>
      <div style={{ display: "flex", gap: 12, fontSize: FONT_SIZE.sm }}>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" name="statistics-display-mode" value="single" checked={mode === "single"} onChange={() => layerVisibilityStore.setAll(statisticsDisplayModeStore.setMode("single", visibility))} /> 單一
        </label>
        <label style={{ cursor: "pointer" }}>
          <input type="radio" name="statistics-display-mode" value="overlap" checked={mode === "overlap"} onChange={() => layerVisibilityStore.setAll(statisticsDisplayModeStore.setMode("overlap", visibility))} /> 重疊
        </label>
      </div>
      {mode === "overlap" && (
        <p role="note" style={{ margin: "6px 0 0", fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 1.45 }}>
          可同時顯示多個統計面；重疊色階可能較難閱讀。
        </p>
      )}
    </fieldset>
  );
}
