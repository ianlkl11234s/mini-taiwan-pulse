import { getPresetByIcao } from "../map/cameraPresets";

interface Props {
  airports: string[];
  selected: string;
  onChange: (icao: string) => void;
}

const style: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 14,
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
};

export function AirportSelector({ airports, selected, onChange }: Props) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      {airports.map((icao) => {
        const p = getPresetByIcao(icao);
        return (
          <option key={icao} value={icao}>
            {p ? `${p.name} (${icao})` : icao}
          </option>
        );
      })}
    </select>
  );
}
