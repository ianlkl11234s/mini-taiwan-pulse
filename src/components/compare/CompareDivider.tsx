/**
 * 比較把手（design-system §5.45）：拖曳或用 ←→ 移動分割位置（一次 5%），Esc 結束比較。
 * 位置寫在 `compareStore.split`（右圖 `clip-path` 與這條線同一個值）。
 */
import { useRef } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { COMPARE_SPLIT_STEP, compareStore, useCompareState } from "../../state/compareStore";
import { useLocale } from "../../state/localeStore";
import "./compareDivider.css";

export function CompareDivider({ isDarkTheme, captureMode }: { isDarkTheme: boolean; captureMode: boolean }) {
  const { split } = useCompareState();
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);

  const moveTo = (clientX: number) => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width > 0) compareStore.setSplit((clientX - rect.left) / rect.width);
  };
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      compareStore.setSplit(compareStore.getSnapshot().split + (event.key === "ArrowLeft" ? -COMPARE_SPLIT_STEP : COMPARE_SPLIT_STEP));
    } else if (event.key === "Escape") {
      event.preventDefault();
      compareStore.setEnabled(false);
    }
  };
  const percent = Math.round(split * 100);
  return (
    <div
      ref={rootRef}
      className={`compare-divider ${isDarkTheme ? "" : "compare-divider--light"} ${captureMode ? "compare-divider--capture" : ""}`}
      style={{ left: `${split * 100}%` }}
    >
      <div className="compare-divider__line" />
      <div className="compare-divider__hit" onPointerDown={onPointerDown} onPointerMove={onPointerMove} />
      <button
        type="button"
        className="compare-divider__knob"
        role="slider"
        aria-label={t("compare.handle")}
        title={t("compare.handleHint")}
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <ChevronsLeftRight size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
