import { Row, formatTaiwanTime } from "./shared";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { ROAD_CONGESTION_COLORS, ROAD_CONGESTION_LABELS } from "../../data/roadCongestionLoader";
import { CONGESTION_COLORS, CONGESTION_LABELS } from "../../data/freewayLoader";

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

/**
 * 國道壅塞 popup（W2）。
 *
 * 與省道 `RoadCongestionPanel` 的差別（刻意不共用 panel）：
 * - 欄位不同：國道有 `road_name` / `section_name` / `direction_label` / `speed`，
 *   省道那層只有 section_id + level。
 * - 等級不同：國道 0~5 六級（`CONGESTION_LABELS`），省道是 4 色 match。
 * - 資料路徑不同：國道由 `buildFreewayGeoJSON` 每個 snapshot 重烤整份 properties
 *   （非 feature-state），所以這裡讀 `props` 就是當下時間軸位置的值。
 *
 * `speed` 是該 snapshot 的路段平均時速（km/h），上游可能給 null → 不顯示該列。
 */
export function FreewayCongestionPanel({ props }: { props: Record<string, unknown> }) {
  const level = Number(props.level ?? 0);
  const color = CONGESTION_COLORS[level] ?? CONGESTION_COLORS[0]!;
  const label = CONGESTION_LABELS[level] ?? CONGESTION_LABELS[0]!;
  const roadName = String(props.road_name ?? "");
  const sectionName = String(props.section_name ?? "");
  const direction = String(props.direction_label ?? "");
  const speedRaw = props.speed;
  const speed = typeof speedRaw === "number" && Number.isFinite(speedRaw) ? speedRaw : null;
  const snapshotTs = Number(props.snapshot_ts ?? 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {roadName || "國道路段"}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {label}
        </div>
      </div>
      {sectionName && <Row label="路段" value={sectionName} />}
      {direction && <Row label="方向" value={direction} />}
      {/* 時速是開這層唯一想知道的數字：色帶只給等級區間 */}
      {speed != null && <Row label="平均時速" value={`${Math.round(speed)} km/h`} color={color} />}
      <Row label="壅塞等級" value={level > 0 ? `${level}（${label}）` : "無資料"} />
      {snapshotTs > 0 && (
        <Row label="快照時間" value={formatTaiwanTime(new Date(snapshotTs * 1000).toISOString())} />
      )}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        資料為 10 分鐘粒度快照，隨時間軸更新
      </div>
    </>
  );
}
