/**
 * 雙北國道逐車模擬圖例（本機研究層）。
 * - 依車速：viridis 漸層（20–100 km/h）；依車種：五色點。
 * - 資料只有 2026-09-28 16:00–18:00：時間軸不在時段內時說明並給「跳到資料時段」（經 timelineJumpBridge 呼叫 useTimeline.jumpToTime）。
 * - 出處與推算說明。
 */
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchHatch, useLegendTheme } from "./legendKit";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { timeStore } from "../../state/timeStore";
import { requestTimelineJump } from "../../state/timelineJumpBridge";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import {
  FREEWAY_TDCS_COLOR_MODES, FREEWAY_TDCS_SIM_DEFAULT_WINDOW, FREEWAY_TDCS_SIM_KEY, FREEWAY_TDCS_SOURCE,
  FREEWAY_TDCS_SPEED_MAX, FREEWAY_TDCS_SPEED_MIN, FREEWAY_TDCS_SPEED_RAMP, FREEWAY_TDCS_VT_COLORS, FREEWAY_TDCS_VT_NAMES,
} from "../../data/freewayTdcsSimTypes";
import { freewayTdcsData, freewayTdcsStatus, subscribeFreewayTdcsStatus } from "../../data/freewayTdcsSimStore";

const DAY_START_UNIX = Date.parse("2026-09-28T00:00:00+08:00") / 1000;
const subscribeTime = (cb: () => void) => timeStore.subscribeThrottled(500, cb);

function useInWindow(): boolean {
  return useSyncExternalStore(subscribeTime, () => {
    const D = freewayTdcsData();
    const day = D?.dayStartUnix ?? DAY_START_UNIX;
    const [w0, w1] = D ? [D.winStart, D.winEnd] : FREEWAY_TDCS_SIM_DEFAULT_WINDOW;
    const t = timeStore.getTime() - day;
    return t >= w0 && t <= w1;
  });
}

export function FreewayTdcsSimLegend() {
  const theme = useLegendTheme();
  const K = FREEWAY_TDCS_SIM_KEY;
  const values = useLayerParams(K);
  const mode = oneOfParam(paramStr(values, K, "freewayTdcsSimColorMode"), FREEWAY_TDCS_COLOR_MODES, "speed");
  const inWindow = useInWindow();
  const status = useSyncExternalStore(subscribeFreewayTdcsStatus, freewayTdcsStatus);
  const jump = () => {
    const D = freewayTdcsData();
    requestTimelineJump((D?.dayStartUnix ?? DAY_START_UNIX) + (D?.winStart ?? FREEWAY_TDCS_SIM_DEFAULT_WINDOW[0]));
  };
  return <div>
    <LegendTitle zh="雙北國道逐車模擬" en="Freeway Vehicles (Estimated)" />
    {status.state === "error" && <LegendRow swatch={<SwatchHatch />}>資料載入失敗（本機 public/freeway_tdcs/ 缺檔？）</LegendRow>}
    {status.state === "loading" && <LegendNote>資料載入中…（約 15 MB）</LegendNote>}
    <LegendNote>本圖層只有 2026-09-28（教師節連假最後一天）16:00–18:00 的資料</LegendNote>
    {!inWindow && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4 }}>
      <span style={{ fontSize: FONT_SIZE.sm, color: theme.textMuted }}>目前時間不在資料時段，地圖不畫車</span>
      <button
        type="button"
        onClick={jump}
        style={{
          height: 22, padding: "0 8px", borderRadius: RADIUS.md, cursor: "pointer", flexShrink: 0,
          border: `1px solid ${theme.border}`, background: theme.bgSubtle, color: theme.textDefault, fontSize: FONT_SIZE.xs,
        }}
      >跳到 9/28 16:00</button>
    </div>}
    {inWindow && status.state === "ready" && <LegendNote>{`畫面時刻在路上 ${status.active.toLocaleString("zh-TW")} 台`}</LegendNote>}
    <div style={{ marginTop: 4 }}>
      {mode === "speed"
        ? <>
          <LegendRow swatch={null}>推算車速（km/h）</LegendRow>
          <SwatchGradient
            gradient={`linear-gradient(90deg, ${FREEWAY_TDCS_SPEED_RAMP.join(", ")})`}
            labels={[`≤${FREEWAY_TDCS_SPEED_MIN}`, "60", `≥${FREEWAY_TDCS_SPEED_MAX}`]}
          />
        </>
        : FREEWAY_TDCS_VT_NAMES.map((name, i) => <LegendRow key={name} swatch={<SwatchDot color={FREEWAY_TDCS_VT_COLORS[i]!} stroke={theme.seam} />}>{name}</LegendRow>)}
    </div>
    <LegendNote>拖尾＝過去 N 秒的行經路線（N 在圖層設定調整）；點車看上下交流道，可跟隨（Esc 取消）。</LegendNote>
    <LegendNote>{`資料：${FREEWAY_TDCS_SOURCE}`}</LegendNote>
  </div>;
}
