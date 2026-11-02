/**
 * 雙北國道逐車模擬說明框：車種、上／下國道交流道、全程平均車速＋「跟隨」按鈕（再按或 Esc 取消）。
 * 上下交流道依原始門架序列；門架之間位置與車道為推算。
 */
import { useSyncExternalStore } from "react";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { FREEWAY_TDCS_SIM_COLOR, FREEWAY_TDCS_SOURCE, FREEWAY_TDCS_VT_COLORS, FREEWAY_TDCS_VT_NAMES } from "../../data/freewayTdcsSimTypes";
import { freewayTdcsFollowTrip, setFreewayTdcsFollow, subscribeFreewayTdcsFollow } from "../../data/freewayTdcsSimStore";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

export function FreewayTdcsSimPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const following = useSyncExternalStore(subscribeFreewayTdcsFollow, freewayTdcsFollowTrip);
  const trip = typeof props.trip === "number" ? props.trip : null;
  const vtName = typeof props.vehicle_type === "string" ? props.vehicle_type : "—";
  const vtIdx = FREEWAY_TDCS_VT_NAMES.indexOf(vtName as (typeof FREEWAY_TDCS_VT_NAMES)[number]);
  const color = vtIdx >= 0 ? FREEWAY_TDCS_VT_COLORS[vtIdx]! : FREEWAY_TDCS_SIM_COLOR;
  const ic = (name: unknown, outside: unknown, side: "on" | "off") =>
    typeof name === "string" ? `${name}${outside ? (side === "on" ? "（範圍外，從邊界駛入）" : "（範圍外，從邊界駛出）") : ""}` : "";
  const isFollowing = trip !== null && following === trip;
  return <div>
    <Title color={color}>{vtName}</Title>
    <Row label="上國道" value={ic(props.on_ic, props.on_outside, "on")} />
    <Row label="下國道" value={ic(props.off_ic, props.off_outside, "off")} />
    <Row label="全程平均車速" value={typeof props.avg_speed_kmh === "number" ? `${props.avg_speed_kmh} km/h` : ""} mono />
    {props.service_break === true && <div style={{ marginTop: 4, fontSize: FONT_SIZE.sm, color: t.textDim }}>途中有長停留（推測服務區），該段不顯示</div>}
    {trip !== null && (
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setFreewayTdcsFollow(isFollowing ? null : trip)}
          style={{
            height: 24, padding: "0 8px", borderRadius: RADIUS.md, cursor: "pointer",
            border: `1px solid ${isFollowing ? color : t.border}`, background: t.bgSubtle,
            color: isFollowing ? color : t.textDefault, fontSize: FONT_SIZE.sm, fontWeight: isFollowing ? 600 : 500,
          }}
        >
          {isFollowing ? "取消跟隨（Esc）" : "跟隨"}
        </button>
      </div>
    )}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textDim }}>上下交流道依原始門架序列；門架之間位置與車道為推算。</div>
    <SourceFooter props={{ source: FREEWAY_TDCS_SOURCE }} />
  </div>;
}
