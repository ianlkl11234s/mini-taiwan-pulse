import { useSyncExternalStore } from "react";
import { ControlSegmented, layerControlThemeClass } from "./LayerParamControls";
import { statisticsDisplayModeStore } from "../../state/statisticsDisplayModeStore";
import { layerVisibilityStore, useLayerVisibilityAll } from "../../state/layerVisibilityStore";

export function StatisticsModeControl({ isDarkTheme = true }: { isDarkTheme?: boolean }) {
  const visibility = useLayerVisibilityAll();
  const { mode } = useSyncExternalStore(
    statisticsDisplayModeStore.subscribe,
    statisticsDisplayModeStore.getSnapshot,
    statisticsDisplayModeStore.getSnapshot,
  );

  const setMode = (nextMode: "single" | "overlap") => {
    layerVisibilityStore.setAll(statisticsDisplayModeStore.setMode(nextMode, visibility));
  };

  return (
    <div
      className={layerControlThemeClass(isDarkTheme)}
      style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 12px 10px", minHeight: 20 }}
    >
      <span className="lpc-k">統計圖層顯示</span>
      <ControlSegmented
        label="統計圖層顯示模式"
        value={mode}
        options={[{ label: "單一", value: "single" }, { label: "可重疊", value: "overlap" }]}
        onChange={(next) => setMode(next as "single" | "overlap")}
      />
    </div>
  );
}
