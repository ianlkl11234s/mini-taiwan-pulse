/**
 * 雙北國道逐車模擬說明框：車種、上／下國道交流道、全程平均車速＋「跟隨」按鈕（再按或 Esc 取消）。
 * 上下交流道依原始門架序列；門架之間位置與車道為推算。
 */
import { useSyncExternalStore } from "react";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { FREEWAY_TDCS_SIM_COLOR, FREEWAY_TDCS_VT_COLORS } from "../../data/freewayTdcsSimTypes";
import { useLocale } from "../../state/localeStore";
import { FREEWAY_TDCS_VT_KEYS } from "../legend/freewayTdcsSimLegends";
import { freewayTdcsFollowTrip, setFreewayTdcsFollow, subscribeFreewayTdcsFollow } from "../../data/freewayTdcsSimStore";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

export function FreewayTdcsSimPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const following = useSyncExternalStore(subscribeFreewayTdcsFollow, freewayTdcsFollowTrip);
  const trip = typeof props.trip === "number" ? props.trip : null;
  const vtIdx = typeof props.vt_index === "number" && props.vt_index >= 0 && props.vt_index <= 4 ? props.vt_index as 0 | 1 | 2 | 3 | 4 : null;
  const vtName = vtIdx !== null ? tr(FREEWAY_TDCS_VT_KEYS[vtIdx]) : "—";
  const color = vtIdx !== null ? FREEWAY_TDCS_VT_COLORS[vtIdx]! : FREEWAY_TDCS_SIM_COLOR;
  const ic = (name: unknown, outside: unknown, side: "on" | "off") =>
    typeof name === "string" ? `${name}${outside ? tr(side === "on" ? "popup.freewayTdcsSim.onOutside" : "popup.freewayTdcsSim.offOutside") : ""}` : "";
  const isFollowing = trip !== null && following === trip;
  return <div>
    <Title color={color}>{vtName}</Title>
    <Row label={tr("popup.freewayTdcsSim.onIc")} value={ic(props.on_ic, props.on_outside, "on")} />
    <Row label={tr("popup.freewayTdcsSim.offIc")} value={ic(props.off_ic, props.off_outside, "off")} />
    <Row label={tr("popup.freewayTdcsSim.avgSpeed")} value={typeof props.avg_speed_kmh === "number" ? `${props.avg_speed_kmh} km/h` : ""} mono />
    {props.service_break === true && <div style={{ marginTop: 4, fontSize: FONT_SIZE.sm, color: t.textDim }}>{tr("popup.freewayTdcsSim.serviceBreak")}</div>}
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
          {tr(isFollowing ? "popup.freewayTdcsSim.unfollow" : "popup.freewayTdcsSim.follow")}
        </button>
      </div>
    )}
    <div style={{ marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textDim }}>{tr("popup.freewayTdcsSim.inferNote")}</div>
    <SourceFooter props={{ source: tr("legend.freewayTdcsSim.source") }} />
  </div>;
}
