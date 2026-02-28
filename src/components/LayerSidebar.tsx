import type { LayerVisibility, TransportType, ExpandableLayerKey, ViewMode, DisplayMode } from "../types";
import type { SliderConfig } from "../hooks/useTransportParams";

// ── Color Config ──

const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  rail: "#ee6c00",
  stations: "#b8a080",
  ports: "#4a90d9",
  lighthouses: "#ffd700",
  airports: "#daa520",
  highways: "#ff6b6b",
  provincialRoads: "#ffa94d",
  windPlan: "#7efcb0",
};

const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: "航班 Flight",
  ships: "船舶 Ship",
  rail: "鐵道 Rail",
};

// ── Section Config ──

interface SectionDef {
  title: string;
  layers: {
    key: keyof LayerVisibility;
    label: string;
    expandable?: boolean;
  }[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "MOVING",
    layers: [
      { key: "flights", label: "航班 Flight", expandable: true },
      { key: "ships", label: "船舶 Ship", expandable: true },
      { key: "rail", label: "鐵道 Rail", expandable: true },
    ],
  },
  {
    title: "FACILITY",
    layers: [
      { key: "stations", label: "軌道車站 Station" },
      { key: "ports", label: "碼頭 Port" },
      { key: "lighthouses", label: "燈塔 Lighthouse" },
      { key: "airports", label: "機場 Airport" },
      { key: "highways", label: "國道 Highway" },
      { key: "provincialRoads", label: "省道 Prov.Road" },
    ],
  },
  {
    title: "ZONE",
    layers: [
      { key: "windPlan", label: "風場範圍 Wind Farm", expandable: true },
    ],
  },
];

// ── Props ──

interface LayerSidebarProps {
  visibility: LayerVisibility;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  isDarkTheme: boolean;
  isMobile?: boolean;
  counts: { flights: number; ships: number; trains: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  getSliders: (transport: TransportType) => SliderConfig[];
}

// ── Component ──

export function LayerSidebar({
  visibility,
  expandedLayer,
  viewMode,
  displayMode,
  isDarkTheme,
  isMobile,
  counts,
  onLayerClick,
  onToggleVisibility,
  onViewModeChange,
  onDisplayModeChange,
  onHideTransport,
  getSliders,
}: LayerSidebarProps) {
  const textColor = isDarkTheme ? "#fff" : "#333";
  const dimColor = isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
  const baseFontSize = isMobile ? 12 : 11;

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "flights": return counts.flights;
      case "ships": return counts.ships;
      case "rail": return counts.trains;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: isMobile ? "100%" : 240,
        background: isDarkTheme ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 8,
        padding: "8px 0",
        fontFamily: "monospace",
      }}
    >
      {SECTIONS.map((section, sIdx) => (
        <div key={section.title}>
          {/* Section divider (skip first) */}
          {sIdx > 0 && (
            <div
              style={{
                height: 1,
                background: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                margin: "6px 12px",
              }}
            />
          )}

          {/* Section title */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              color: dimColor,
              padding: "4px 14px 2px",
              textTransform: "uppercase",
            }}
          >
            {section.title}
          </div>

          {/* Layer rows */}
          {section.layers.map(({ key, label, expandable }) => {
            const active = visibility[key];
            const color = LAYER_COLORS[key];
            const count = getCount(key);
            const isExpanded = expandedLayer === key;

            return (
              <div key={key}>
                {/* Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: `4px 12px`,
                    cursor: "pointer",
                    background: isExpanded
                      ? (isDarkTheme ? `${color}15` : `${color}10`)
                      : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Toggle dot */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(key); }}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: active ? color : "transparent",
                      border: `1.5px solid ${active ? color : (isDarkTheme ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)")}`,
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 0,
                      transition: "all 0.15s",
                    }}
                  />

                  {/* Label + count */}
                  <div
                    onClick={() => expandable ? onLayerClick(key) : onToggleVisibility(key)}
                    style={{
                      flex: 1,
                      fontSize: baseFontSize,
                      color: active ? textColor : dimColor,
                      opacity: active ? 1 : 0.6,
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                    {count != null && count > 0 && (
                      <span style={{ marginLeft: 4, opacity: 0.5, fontSize: baseFontSize - 1 }}>
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Chevron for expandable */}
                  {expandable && (
                    <span
                      onClick={() => onLayerClick(key)}
                      style={{
                        fontSize: 10,
                        color: dimColor,
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      ▶
                    </span>
                  )}
                </div>

                {/* Expanded Panel */}
                {isExpanded && expandable && key in TRANSPORT_LABELS && (
                  <ExpandedPanel
                    transport={key as TransportType}
                    isDarkTheme={isDarkTheme}
                    isMobile={isMobile}
                    viewMode={viewMode}
                    displayMode={displayMode}
                    onViewModeChange={onViewModeChange}
                    onDisplayModeChange={onDisplayModeChange}
                    onHide={onHideTransport}
                    sliders={getSliders(key as TransportType)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Expanded Panel ──

interface ExpandedPanelProps {
  transport: TransportType;
  isDarkTheme: boolean;
  isMobile?: boolean;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHide: () => void;
  sliders: SliderConfig[];
}

function ExpandedPanel({
  transport,
  isDarkTheme,
  isMobile,
  displayMode,
  onDisplayModeChange,
  onHide,
  sliders,
}: ExpandedPanelProps) {
  const btnBase: React.CSSProperties = {
    fontSize: 9,
    padding: "2px 6px",
    borderRadius: 3,
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
    background: isDarkTheme ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)",
    color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
  };

  return (
    <div
      style={{
        padding: "6px 14px 8px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Display mode (flights only) + Hide */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {transport === "flights" && (
          <>
            <button style={displayMode === "status" ? activeBtn : inactiveBtn} onClick={() => onDisplayModeChange("status")}>
              Live Status
            </button>
            <button style={displayMode === "trails" ? activeBtn : inactiveBtn} onClick={() => onDisplayModeChange("trails")}>
              Trails
            </button>
          </>
        )}
        <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>
          Hide
        </button>
      </div>

      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sliders.map((s) => (
          <label
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          >
            <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => s.onChange(Number(e.target.value))}
              style={{
                flex: 1,
                height: 3,
                accentColor: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                cursor: "pointer",
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
