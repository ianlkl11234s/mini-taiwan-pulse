import type { LayerVisibility } from "../types";

interface LayerToggleProps {
  visibility: LayerVisibility;
  isDarkTheme: boolean;
  counts: { flights: number; ships: number; trains: number };
  onChange: (layer: keyof LayerVisibility) => void;
}

const LAYERS: { key: keyof LayerVisibility; label: string; color: string }[] = [
  { key: "flights", label: "Flight", color: "#64aaff" },
  { key: "ships", label: "Ship", color: "#1ad9e5" },
  { key: "rail", label: "Rail", color: "#ee6c00" },
];

export function LayerToggle({ visibility, isDarkTheme, counts, onChange }: LayerToggleProps) {
  const countMap: Record<string, number> = {
    flights: counts.flights,
    ships: counts.ships,
    rail: counts.trains,
  };

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {LAYERS.map(({ key, label, color }) => {
        const active = visibility[key];
        const count = countMap[key] ?? 0;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              background: active
                ? (isDarkTheme ? `${color}30` : `${color}20`)
                : (isDarkTheme ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)"),
              color: isDarkTheme ? "#fff" : "#333",
              border: `1px solid ${active ? `${color}88` : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)")}`,
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 10,
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
            {count > 0 && (
              <span style={{ marginLeft: 3, opacity: 0.6 }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
