import { Row } from "./shared";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { ROAD_CONGESTION_COLORS, ROAD_CONGESTION_LABELS } from "../../data/roadCongestionLoader";

/**
 * 省道路況 popup。level 由 feature-state 合成（見 useMapInteraction 把 f.state
 * 併入 properties）。速度不在 timeline，v1 不顯示。
 */
export function RoadCongestionPanel({ props }: { props: Record<string, unknown> }) {
  const level = Number(props.level ?? 0);
  const sectionId = String(props.section_id ?? props.section_uid ?? "");
  const color = ROAD_CONGESTION_COLORS[level] ?? ROAD_CONGESTION_COLORS[0]!;
  const label = ROAD_CONGESTION_LABELS[level] ?? ROAD_CONGESTION_LABELS[0]!;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          省道路段
        </div>
        <div style={{
          marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {label}
        </div>
      </div>
      {sectionId && <Row label="路段代碼" value={sectionId} />}
      <Row label="壅塞等級" value={level > 0 ? `${level}（${label}）` : "無資料"} />
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        v1 僅省道 highway；無路名／速度資料
      </div>
    </>
  );
}
