import { RADIUS } from "../../styles/designTokens";

/**
 * 列開關（design-system spec §5.10「列開關」）：Layers 主題／圖層列、分析結果清單。
 * 開＝黑白（依主題，不用強調色）；細項開關（`.lpc-sw`，強調藍）是另一階，不要混用。
 * 預設顏色跟著 `isDarkTheme`，個別顏色 prop 只給需要特例的地方覆寫。
 */
export const LAYER_TOGGLE_PALETTE = {
  dark: { on: "#ffffff", off: "#4b5563", knobOn: "#111827", knobOff: "#ffffff" },
  light: { on: "#1f2937", off: "#d1d5db", knobOn: "#ffffff", knobOff: "#ffffff" },
} as const;

export function LayerToggleSwitch({ on, onChange, label, isDarkTheme = true, ACCENT_TOGGLE, TOGGLE_OFF, TOGGLE_KNOB_ON, TOGGLE_KNOB_OFF }: { on: boolean; onChange: () => void; label?: string; isDarkTheme?: boolean; ACCENT_TOGGLE?: string; TOGGLE_OFF?: string; TOGGLE_KNOB_ON?: string; TOGGLE_KNOB_OFF?: string }) {
  const palette = LAYER_TOGGLE_PALETTE[isDarkTheme ? "dark" : "light"];
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 28,
        height: 16,
        borderRadius: RADIUS.xl,
        border: "none",
        background: on ? ACCENT_TOGGLE ?? palette.on : TOGGLE_OFF ?? palette.off,
        position: "relative",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: RADIUS.full,
          background: on ? TOGGLE_KNOB_ON ?? palette.knobOn : TOGGLE_KNOB_OFF ?? palette.knobOff,
          position: "absolute",
          top: 2,
          left: on ? 14 : 2,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}
