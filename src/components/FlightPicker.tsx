import type { Flight, ViewMode } from "../types";

interface Props {
  flights: Flight[];
  viewMode: ViewMode;
  selectedFlightId: string | null;
  onViewModeChange: (mode: ViewMode) => void;
  onFlightSelect: (id: string | null) => void;
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "rgba(100,170,255,0.3)" : "rgba(0,0,0,0.6)",
  color: "#fff",
  border: `1px solid ${active ? "rgba(100,170,255,0.6)" : "rgba(255,255,255,0.2)"}`,
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
  whiteSpace: "nowrap",
});

const selectStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "monospace",
  maxWidth: 220,
  backdropFilter: "blur(8px)",
};

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
  onViewModeChange,
  onFlightSelect,
}: Props) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {(Object.keys(MODE_LABELS) as ViewMode[]).map((mode) => (
        <button
          key={mode}
          style={btnStyle(viewMode === mode)}
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
          style={selectStyle}
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
