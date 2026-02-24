import type { LayerVisibility, ViewMode, TransportType } from "../types";

interface TransportBarProps {
  visibility: LayerVisibility;
  expandedTransport: TransportType | null;
  viewMode: ViewMode;
  isDarkTheme: boolean;
  isMobile?: boolean;
  counts: { flights: number; ships: number; trains: number };
  onTransportClick: (transport: TransportType) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

const TRANSPORT_COLORS: Record<TransportType, string> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  rail: "#ee6c00",
};

const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: "Flight",
  ships: "Ship",
  rail: "Rail",
};

const INFRA_LAYERS: { key: "stations" | "ports"; label: string; color: string }[] = [
  { key: "stations", label: "Station", color: "#b8a080" },
  { key: "ports", label: "Port", color: "#4a90d9" },
];

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: "all-taiwan", label: "All Taiwan" },
  { mode: "time-window", label: "\u00b112h" },
];

const TRANSPORTS: TransportType[] = ["flights", "ships", "rail"];

export function TransportBar({
  visibility,
  expandedTransport,
  viewMode,
  isDarkTheme,
  isMobile,
  counts,
  onTransportClick,
  onToggleVisibility,
  onViewModeChange,
}: TransportBarProps) {
  const countMap: Record<TransportType, number> = {
    flights: counts.flights,
    ships: counts.ships,
    rail: counts.trains,
  };

  const baseFontSize = isMobile ? 11 : 10;
  const basePadding = isMobile ? "6px 10px" : "3px 8px";
  const viewModePadding = isMobile ? "6px 10px" : "4px 10px";
  const viewModeFontSize = isMobile ? 12 : 11;

  const textColor = isDarkTheme ? "#fff" : "#333";
  const separatorColor = isDarkTheme ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {/* Transport buttons: Flight / Ship / Rail */}
      {TRANSPORTS.map((transport) => {
        const active = visibility[transport];
        const expanded = expandedTransport === transport;
        const color = TRANSPORT_COLORS[transport];
        const count = countMap[transport];

        // Background
        let background: string;
        if (!active) {
          background = isDarkTheme ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)";
        } else if (expanded) {
          background = isDarkTheme ? `${color}30` : `${color}20`;
        } else {
          background = isDarkTheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";
        }

        // Border
        const borderColor = active
          ? `${color}88`
          : isDarkTheme
            ? "rgba(255,255,255,0.15)"
            : "rgba(0,0,0,0.1)";

        const borderBottom = active && expanded ? `2px solid ${color}` : `1px solid ${borderColor}`;

        return (
          <button
            key={transport}
            onClick={() => onTransportClick(transport)}
            style={{
              background,
              color: textColor,
              borderTop: `1px solid ${borderColor}`,
              borderLeft: `1px solid ${borderColor}`,
              borderRight: `1px solid ${borderColor}`,
              borderBottom,
              borderRadius: 4,
              padding: basePadding,
              fontSize: baseFontSize,
              cursor: "pointer",
              fontFamily: "monospace",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              opacity: active ? 1 : 0.5,
              transition: "all 0.15s",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: active ? color : "transparent",
                border: `1px solid ${color}`,
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            {TRANSPORT_LABELS[transport]}
            {count > 0 && (
              <span style={{ marginLeft: 3, opacity: 0.6 }}>{count}</span>
            )}
          </button>
        );
      })}

      {/* Separator */}
      <span
        style={{
          color: separatorColor,
          fontSize: baseFontSize,
          fontFamily: "monospace",
          userSelect: "none",
          opacity: 0.4,
        }}
      >
        |
      </span>

      {/* Infrastructure toggles: Station / Port */}
      {INFRA_LAYERS.map(({ key, label, color }) => {
        const active = visibility[key];

        return (
          <button
            key={key}
            onClick={() => onToggleVisibility(key)}
            style={{
              background: active
                ? (isDarkTheme ? `${color}30` : `${color}20`)
                : (isDarkTheme ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)"),
              color: textColor,
              border: `1px solid ${active ? `${color}88` : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)")}`,
              borderRadius: 4,
              padding: basePadding,
              fontSize: baseFontSize,
              cursor: "pointer",
              fontFamily: "monospace",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              opacity: active ? 1 : 0.5,
              transition: "all 0.15s",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: active ? color : "transparent",
                border: `1px solid ${color}`,
                marginRight: 4,
                verticalAlign: "middle",
              }}
            />
            {label}
          </button>
        );
      })}

      {/* Separator */}
      <span
        style={{
          color: separatorColor,
          fontSize: baseFontSize,
          fontFamily: "monospace",
          userSelect: "none",
          opacity: 0.4,
        }}
      >
        |
      </span>

      {/* ViewMode buttons: All Taiwan / ±12h */}
      {VIEW_MODES.map(({ mode, label }) => {
        const active = viewMode === mode;

        return (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            style={{
              background: active
                ? (isDarkTheme ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)")
                : (isDarkTheme ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)"),
              color: textColor,
              border: `1px solid ${active ? (isDarkTheme ? "rgba(100,170,255,0.6)" : "rgba(100,170,255,0.5)") : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)")}`,
              borderRadius: 4,
              padding: viewModePadding,
              fontSize: viewModeFontSize,
              cursor: "pointer",
              fontFamily: "monospace",
              backdropFilter: "blur(8px)",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
