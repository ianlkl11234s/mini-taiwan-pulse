import type { MapStyle } from "../types";

export const MAP_STYLES: MapStyle[] = [
  { id: "dark", name: "Dark", url: "mapbox://styles/mapbox/dark-v11" },
  { id: "light", name: "Light", url: "mapbox://styles/mapbox/light-v11" },
  { id: "satellite", name: "Satellite", url: "mapbox://styles/mapbox/satellite-v9" },
  { id: "satellite-streets", name: "Satellite Streets", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  { id: "nav-night", name: "Navigation Night", url: "mapbox://styles/mapbox/navigation-night-v1" },
  { id: "streets", name: "Streets", url: "mapbox://styles/mapbox/streets-v12" },
];

interface Props {
  selected: string;
  onChange: (styleId: string) => void;
}

const style: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  fontFamily: "monospace",
  backdropFilter: "blur(8px)",
};

export function StyleSelector({ selected, onChange }: Props) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      {MAP_STYLES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function getStyleUrl(id: string): string {
  return MAP_STYLES.find((s) => s.id === id)?.url ?? MAP_STYLES[0]!.url;
}
