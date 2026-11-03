/**
 * 雙北國道逐車模擬圖例（本機研究層）。
 * - 依車速：viridis 漸層（20–100 km/h）；依車種：五色點。
 * - 資料只有 2026-09-28 16:00–18:00：時間軸不在時段內時說明並給「跳到資料時段」（經 timelineJumpBridge 呼叫 useTimeline.jumpToTime）。
 * - 自訂顏色：車速可換「自訂三色」、車種五色可改（使用者自選，存 localStorage；本機測試分支做法，
 *   正式上線前要補 param kind 或改走設計規格）。預設仍是規格色（viridis／GFW 五色）。
 * - 跟隨結束原因（原型 toast）顯示在這裡。
 * - 出處與推算說明。
 */
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchHatch, SwatchSquare, useLegendTheme } from "./legendKit";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { timeStore } from "../../state/timeStore";
import { requestTimelineJump } from "../../state/timelineJumpBridge";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import {
  FREEWAY_TDCS_COLOR_MODES, FREEWAY_TDCS_SIM_DEFAULT_WINDOW, FREEWAY_TDCS_SIM_KEY, FREEWAY_TDCS_SOURCE,
  FREEWAY_TDCS_SPEED_CUSTOM_STOPS, FREEWAY_TDCS_SPEED_MAX, FREEWAY_TDCS_SPEED_MIN, FREEWAY_TDCS_SPEED_RAMP, FREEWAY_TDCS_VT_NAMES,
} from "../../data/freewayTdcsSimTypes";
import {
  freewayTdcsColors, freewayTdcsData, freewayTdcsFollowEndMsg, freewayTdcsStatus, setFreewayTdcsColors,
  subscribeFreewayTdcsColors, subscribeFreewayTdcsFollowEndMsg, subscribeFreewayTdcsStatus, type FreewayTdcsColors,
} from "../../data/freewayTdcsSimStore";

function ColorInput({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  // 看得到的是規格色塊（SwatchSquare），上面疊一個透明的原生取色器
  return <label title={title} style={{ position: "relative", display: "inline-flex", cursor: "pointer", flexShrink: 0 }}>
    <SwatchSquare color={value} opacity={1} />
    <input
      type="color" value={value} aria-label={title}
      onChange={(e) => onChange(e.target.value)}
      style={{ position: "absolute", inset: 0, opacity: 0, padding: 0, border: "none", cursor: "pointer" }}
    />
  </label>;
}

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
  const colors = useSyncExternalStore(subscribeFreewayTdcsColors, freewayTdcsColors);
  const endMsg = useSyncExternalStore(subscribeFreewayTdcsFollowEndMsg, freewayTdcsFollowEndMsg);
  const setSpeedCustom = (i: number, v: string) => {
    const next = [...colors.speedCustom] as FreewayTdcsColors["speedCustom"]; next[i] = v;
    setFreewayTdcsColors({ speedCustom: next, speedPalette: "custom" });
  };
  const setTypeColor = (i: number, v: string) => {
    const next = [...colors.typeColors] as FreewayTdcsColors["typeColors"]; next[i] = v;
    setFreewayTdcsColors({ typeColors: next });
  };
  const smallBtn = {
    height: 20, padding: "0 6px", borderRadius: RADIUS.md, cursor: "pointer",
    border: `1px solid ${theme.border}`, background: theme.bgSubtle, color: theme.textDefault, fontSize: FONT_SIZE.xs,
  } as const;
  const jump = () => {
    const D = freewayTdcsData();
    requestTimelineJump((D?.dayStartUnix ?? DAY_START_UNIX) + (D?.winStart ?? FREEWAY_TDCS_SIM_DEFAULT_WINDOW[0]));
  };
  return <div>
    <LegendTitle zh="雙北國道逐車模擬" en="Freeway Vehicles (Estimated)" />
    {status.state === "error" && <LegendRow swatch={<SwatchHatch />}>資料載入失敗（本機 public/freeway_tdcs/ 缺檔？）</LegendRow>}
    {status.state === "loading" && <LegendNote>資料載入中…（約 20 MB）</LegendNote>}
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
    {endMsg && <LegendNote>{endMsg.text}</LegendNote>}
    <div style={{ marginTop: 4 }}>
      {mode === "speed"
        ? <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: FONT_SIZE.sm, color: theme.textDefault }}>推算車速（km/h）</span>
            <span style={{ display: "flex", gap: 4 }}>
              {(["viridis", "custom"] as const).map((p) => <button
                key={p} type="button" aria-pressed={colors.speedPalette === p}
                onClick={() => setFreewayTdcsColors({ speedPalette: p })}
                style={{ ...smallBtn, ...(colors.speedPalette === p ? { borderColor: theme.textDefault } : null) }}
              >{p === "viridis" ? "預設色階" : "自訂三色"}</button>)}
            </span>
          </div>
          {colors.speedPalette === "viridis"
            ? <SwatchGradient
              gradient={`linear-gradient(90deg, ${FREEWAY_TDCS_SPEED_RAMP.join(", ")})`}
              labels={[`≤${FREEWAY_TDCS_SPEED_MIN}`, "60", `≥${FREEWAY_TDCS_SPEED_MAX}`]}
            />
            : <>
              <SwatchGradient
                gradient={`linear-gradient(90deg, ${colors.speedCustom[0]} 0%, ${colors.speedCustom[1]} 43%, ${colors.speedCustom[2]} 100%)`}
                labels={[`≤${FREEWAY_TDCS_SPEED_CUSTOM_STOPS[0]}`, `${FREEWAY_TDCS_SPEED_CUSTOM_STOPS[1]}`, `≥${FREEWAY_TDCS_SPEED_CUSTOM_STOPS[2]}`]}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 2, fontSize: FONT_SIZE.xs, color: theme.textMuted }}>
                {(["慢", "中", "快"] as const).map((lab, i) => <span key={lab} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ColorInput value={colors.speedCustom[i]!} onChange={(v) => setSpeedCustom(i, v)} title={`自訂車速色：${lab}`} />{lab}
                </span>)}
              </div>
            </>}
        </>
        : FREEWAY_TDCS_VT_NAMES.map((name, i) => <LegendRow
          key={name}
          swatch={<SwatchDot color={colors.typeColors[i]!} stroke={theme.seam} />}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {name}
            <ColorInput value={colors.typeColors[i]!} onChange={(v) => setTypeColor(i, v)} title={`自訂車種色：${name}`} />
          </span>
        </LegendRow>)}
      <div style={{ marginTop: 4 }}>
        <button type="button" onClick={() => setFreewayTdcsColors(null)} style={smallBtn}>還原預設顏色</button>
      </div>
    </div>
    <LegendNote>拖尾＝過去 N 秒的行經路線（N 與線寬在圖層設定調整）；點車看上下交流道，可跟隨（Esc 取消）。</LegendNote>
    <LegendNote>放大到 z15 以上畫 3D 車（依車種大小、朝行進方向）。傾斜地圖開 3D 地形時，車貼地形、高架用資料路面高程，隧道裡的車被山體擋住；平面地圖時隧道內不畫。</LegendNote>
    <LegendNote>{`資料：${FREEWAY_TDCS_SOURCE}`}</LegendNote>
  </div>;
}
