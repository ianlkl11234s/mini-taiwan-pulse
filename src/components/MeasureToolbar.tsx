/**
 * 量測工具列（design-system spec §5.44，C1）：距離／面積切換、總數、刪上一點、清除、完成。
 * 位置由 App 給 style（桌機上方置中、手機時間軸列下方）；沒有量測時不渲染。
 */
import { useSyncExternalStore, type CSSProperties } from "react";
import { Check, Pentagon, Ruler, Trash2, Undo2 } from "lucide-react";
import { useLocale } from "../state/localeStore";
import type { MeasureController, MeasureMode } from "../map/measureController";
import { formatMeasureArea, formatMeasureDistance } from "../map/measureMath";
import "./mapMeasure.css";

/** 線段 icon（lucide 沒有兩端點直線的圖示）：同 lucide 24 格、2px 線、圓端 */
export function LineSegmentIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
      <path d="M6.5 17.5 17.5 6.5" />
    </svg>
  );
}

interface Props {
  controller: MeasureController;
  isDarkTheme: boolean;
  variant: "desktop" | "mobile";
  style?: CSSProperties;
}

export function MeasureToolbar({ controller, isDarkTheme, variant, style }: Props) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { t, formatNumber } = useLocale();
  if (!state.active) return null;

  const total = state.mode === "distance"
    ? formatMeasureDistance(state.length, formatNumber)
    : formatMeasureArea(state.area, formatNumber, t("measure.hectare"));
  const canFinish = state.drawing && state.points.length >= (state.mode === "distance" ? 2 : 3);
  const modes: { mode: MeasureMode; label: string; icon: React.ReactNode }[] = [
    { mode: "distance", label: t("measure.distance"), icon: <LineSegmentIcon size={12} /> },
    { mode: "area", label: t("measure.area"), icon: <Pentagon size={12} /> },
  ];

  return (
    <div
      className={`measure-bar measure-bar--${variant}${isDarkTheme ? "" : " measure-bar--light"}`}
      role="toolbar"
      aria-label={t("measure.toolbar")}
      style={style}
    >
      <span className="measure-bar__icon" aria-hidden="true"><Ruler size={13} /></span>
      <div className="measure-bar__seg" role="group" aria-label={t("measure.mode")}>
        {modes.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={state.mode === mode}
            title={label}
            aria-label={label}
            onClick={() => controller.setMode(mode)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
      <span className="measure-bar__vsep" />
      <span className="measure-bar__value" aria-label={t("measure.total")} aria-live="polite">{total}</span>
      <span className="measure-bar__vsep" />
      <button
        type="button"
        className="measure-bar__btn"
        title={t("measure.undo")}
        aria-label={t("measure.undo")}
        disabled={!state.drawing || state.points.length === 0}
        onClick={() => controller.undo()}
      >
        <Undo2 size={13} />
      </button>
      <button
        type="button"
        className="measure-bar__btn"
        title={t("measure.clear")}
        aria-label={t("measure.clear")}
        onClick={() => controller.clear()}
      >
        <Trash2 size={13} />
      </button>
      <button
        type="button"
        className="measure-bar__btn measure-bar__btn--primary"
        title={t("measure.done")}
        disabled={!canFinish}
        onClick={() => controller.finish()}
      >
        <Check size={13} />
        {t("measure.done")}
      </button>
    </div>
  );
}
