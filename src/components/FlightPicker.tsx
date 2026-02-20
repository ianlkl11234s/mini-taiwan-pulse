import type { Flight } from "../types";
import type { ViewMode } from "../types";

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
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
});

const selectStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  fontFamily: "monospace",
  maxWidth: 200,
  backdropFilter: "blur(8px)",
};

export function FlightPicker({
  flights,
  viewMode,
  selectedFlightId,
  onViewModeChange,
  onFlightSelect,
}: Props) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        style={btnStyle(viewMode === "overlay")}
        onClick={() => {
          onViewModeChange("overlay");
          onFlightSelect(null);
        }}
      >
        All Flights
      </button>
      <button
        style={btnStyle(viewMode === "single")}
        onClick={() => onViewModeChange("single")}
      >
        Track Single
      </button>

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
