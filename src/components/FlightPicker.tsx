import type { Flight, ViewMode } from "../types";

interface Props {
  flights: Flight[];
  viewMode: ViewMode;
  selectedFlightId: string | null;
  isDarkTheme?: boolean;
  isMobile?: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onFlightSelect: (id: string | null) => void;
}

const btnStyle = (active: boolean, dark: boolean): React.CSSProperties => ({
  background: active
    ? dark ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)"
    : dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
  color: dark ? "#fff" : "#333",
  border: `1px solid ${active ? (dark ? "rgba(100,170,255,0.6)" : "rgba(100,170,255,0.5)") : (dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)")}`,
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
  whiteSpace: "nowrap",
});

const getSelectStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
  color: dark ? "#fff" : "#333",
  border: `1px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "monospace",
  maxWidth: 220,
  backdropFilter: "blur(8px)",
});

const MODE_LABELS: Record<ViewMode, string> = {
  airport: "This Airport",
  "all-taiwan": "All Taiwan",
  "time-window": "±12h Window",
  single: "Track Single",
};

export function FlightPicker({
  flights,
  viewMode,
  selectedFlightId,
  isDarkTheme = true,
  isMobile = false,
  onViewModeChange,
  onFlightSelect,
}: Props) {
  return (
    <div style={isMobile
      ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }
      : { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }
    }>
      {(Object.keys(MODE_LABELS) as ViewMode[]).map((mode) => (
        <button
          key={mode}
          style={{
            ...btnStyle(viewMode === mode, isDarkTheme),
            ...(isMobile ? { padding: "10px 12px", fontSize: 12 } : {}),
          }}
          onClick={() => {
            onViewModeChange(mode);
            if (mode !== "single") onFlightSelect(null);
          }}
        >
          {MODE_LABELS[mode]}
        </button>
      ))}

      {viewMode === "single" && (
        <select
          value={selectedFlightId ?? ""}
          onChange={(e) => onFlightSelect(e.target.value || null)}
          style={getSelectStyle(isDarkTheme)}
        >
          <option value="">Select flight...</option>
          {flights.map((f) => (
            <option key={f.fr24_id} value={f.fr24_id}>
              {f.callsign} ({f.origin_iata}→{f.dest_iata}) {f.aircraft_type}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
