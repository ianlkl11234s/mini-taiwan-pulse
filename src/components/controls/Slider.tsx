/**
 * 共用 S1 細滑桿元件（UI 統一第二輪 Phase P）。
 *
 * 給 LayerParamControls 以外、單一 range input 的場景（地震回放、情報回放、
 * bbox 工具、研究頁的透明度／門檻滑桿）。樣式見 `./slider.css`（`.ctl-range`）。
 *
 * 預設吃全域暗色 token；呼叫端若已有自己的主題系統（例如 intel 面板的
 * `useIntelTheme()`），可傳 trackColor/fillColor/thumbColor/accentColor
 * 覆寫對應的 CSS 變數，讓滑桿跟著呼叫端目前的主題色走。
 */
import type { CSSProperties } from "react";
import "./slider.css";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** 給 `<label for>` 或 aria-describedby 指到這顆 slider 用 */
  id?: string;
  /** 螢幕閱讀器讀出的目前值文字（例如已格式化的小數／百分比） */
  ariaValueText?: string;
  className?: string;
  style?: CSSProperties;
  /** 覆寫顏色（供已有主題系統的呼叫端傳入，如 IntelReplay 的 palette） */
  trackColor?: string;
  fillColor?: string;
  thumbColor?: string;
  accentColor?: string;
}

export function Slider({
  value, min, max, step = 1, disabled, onChange, ariaLabel, id, ariaValueText, className, style,
  trackColor, fillColor, thumbColor, accentColor,
}: SliderProps) {
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return (
    <input
      type="range"
      id={id}
      className={className ? `ctl-range ${className}` : "ctl-range"}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        "--p": `${pct}%`,
        ...(trackColor ? { "--ctl-track": trackColor } : {}),
        ...(fillColor ? { "--ctl-fill": fillColor } : {}),
        ...(thumbColor ? { "--ctl-thumb": thumbColor } : {}),
        ...(accentColor ? { "--ctl-accent": accentColor } : {}),
        ...style,
      } as CSSProperties}
    />
  );
}
