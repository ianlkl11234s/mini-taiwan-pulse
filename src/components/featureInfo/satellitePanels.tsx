import { Row } from "./shared";
import { COLORS, FONT_SIZE } from "../../styles/designTokens";
import { SATELLITE_COLORS, SATELLITE_LABELS, type SatelliteCategory } from "../../data/satelliteTypes";

export function SatellitePanel({ props }: { props: Record<string, unknown> }) {
  const cat = String(props.cat ?? "") as SatelliteCategory;
  const name = String(props.name ?? "");
  const norad = String(props.norad ?? "");
  const altKm = Number(props.altKm);
  const color = SATELLITE_COLORS[cat] ?? "#888";
  const catLabel = SATELLITE_LABELS[cat] ?? cat;
  return (
    <div>
      <div style={{ fontWeight: 700, color, fontSize: FONT_SIZE.lg }}>{name || "Satellite"}</div>
      <Row label="類別" value={catLabel} color={color} />
      <Row label="NORAD" value={norad} />
      <Row label="高度" value={Number.isFinite(altKm) ? `${altKm.toLocaleString()} km` : ""} />
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
        足跡：內圈 50 km swath / 外圈 1,500 km elevation ≥10° cone
      </div>
    </div>
  );
}
