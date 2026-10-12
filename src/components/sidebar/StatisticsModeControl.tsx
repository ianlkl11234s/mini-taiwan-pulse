import { useSyncExternalStore } from "react";
import { useLocale } from "../../state/localeStore";
import { ControlSegmented, layerControlThemeClass } from "./LayerParamControls";
import { statisticsDisplayModeStore } from "../../state/statisticsDisplayModeStore";
import { layerVisibilityStore, useLayerVisibilityAll } from "../../state/layerVisibilityStore";

export function StatisticsModeControl({ isDarkTheme = true }: { isDarkTheme?: boolean }) {
  const { t } = useLocale();
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
      <span className="lpc-k">{t("paramsPanel.statsMode.label")}</span>
      <ControlSegmented
        label={t("paramsPanel.statsMode.ariaLabel")}
        value={mode}
        options={[{ label: t("paramsPanel.statsMode.single"), value: "single" }, { label: t("paramsPanel.statsMode.overlap"), value: "overlap" }]}
        onChange={(next) => setMode(next as "single" | "overlap")}
      />
    </div>
  );
}
