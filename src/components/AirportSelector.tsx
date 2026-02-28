import { getAirportInfo } from "../map/cameraPresets";

interface Props {
  airports: string[];
  isDarkTheme?: boolean;
  onJump: (icao: string) => void;
}

const getStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)",
  color: dark ? "#fff" : "#333",
  border: `1px solid ${dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 14,
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
});

export function LocationJump({ airports, isDarkTheme = true, onJump }: Props) {
  return (
    <select
      value=""
      onChange={(e) => onJump(e.target.value)}
      style={getStyle(isDarkTheme)}
    >
      <option value="" disabled>
        地點跳轉
      </option>
      {airports.map((icao) => {
        const info = getAirportInfo(icao);
        return (
          <option key={icao} value={icao}>
            {info ? `${info.name} (${icao})` : icao}
          </option>
        );
      })}
    </select>
  );
}

export { LocationJump as AirportSelector };
