import type { DisplayMode, TransportType } from "../types";

interface SliderConfig {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

interface TransportParamPanelProps {
  transport: TransportType;
  isDarkTheme: boolean;
  isMobile?: boolean;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  sliders: SliderConfig[];
  onHide: () => void;
}

const TRANSPORT_COLORS: Record<TransportType, string> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  rail: "#ee6c00",
};

export function TransportParamPanel({
  transport,
  isDarkTheme,
  isMobile,
  displayMode,
  onDisplayModeChange,
  sliders,
  onHide,
}: TransportParamPanelProps) {
  const accentColor = TRANSPORT_COLORS[transport];

  const btnBase: React.CSSProperties = {
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 4,
    fontFamily: "monospace",
    cursor: "pointer",
    border: "1px solid transparent",
  };

  const activeBtn: React.CSSProperties = {
    ...btnBase,
    background: isDarkTheme ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)",
    border: "1px solid rgba(100,170,255,0.5)",
    color: isDarkTheme ? "#fff" : "#000",
  };

  const inactiveBtn: React.CSSProperties = {
    ...btnBase,
    background: isDarkTheme ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)",
    color: isDarkTheme ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
  };

  const sliderLabelStyle: React.CSSProperties = {
    color: isDarkTheme ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
    fontSize: 11,
    fontFamily: "monospace",
    display: "flex",
    alignItems: "center",
    gap: 4,
  };

  const sliderInputStyle: React.CSSProperties = {
    width: isMobile ? "100%" : 60,
    height: 4,
    accentColor: isDarkTheme ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        background: isDarkTheme ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)",
        backdropFilter: "blur(12px)",
        borderRadius: 6,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderTop: `2px solid ${accentColor}`,
      }}
    >
      {/* Row 1: Display mode toggle + Hide button */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          style={displayMode === "status" ? activeBtn : inactiveBtn}
          onClick={() => onDisplayModeChange("status")}
        >
          Live Status
        </button>
        <button
          style={displayMode === "trails" ? activeBtn : inactiveBtn}
          onClick={() => onDisplayModeChange("trails")}
        >
          Trails
        </button>
        <button
          style={{ ...inactiveBtn, marginLeft: "auto" }}
          onClick={onHide}
        >
          Hide
        </button>
      </div>

      {/* Row 2: Sliders */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        {sliders.map((s) => (
          <label key={s.label} style={sliderLabelStyle}>
            {s.label}
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => s.onChange(Number(e.target.value))}
              style={sliderInputStyle}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
