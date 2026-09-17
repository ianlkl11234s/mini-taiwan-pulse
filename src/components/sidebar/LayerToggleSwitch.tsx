import { RADIUS } from "../../styles/designTokens";

export function LayerToggleSwitch({ on, onChange, label, ACCENT_TOGGLE = "#fff", TOGGLE_OFF = "#4b5563", TOGGLE_KNOB_ON = "#111827", TOGGLE_KNOB_OFF = "#fff" }: { on: boolean; onChange: () => void; label?: string; ACCENT_TOGGLE?: string; TOGGLE_OFF?: string; TOGGLE_KNOB_ON?: string; TOGGLE_KNOB_OFF?: string }) {
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
        background: on ? ACCENT_TOGGLE : TOGGLE_OFF,
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
          background: on ? TOGGLE_KNOB_ON : TOGGLE_KNOB_OFF,
          position: "absolute",
          top: 2,
          left: on ? 14 : 2,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

