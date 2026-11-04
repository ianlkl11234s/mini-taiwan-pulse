/**
 * 雙北國道逐車模擬圖例（模擬面板）。
 * - 依車速：viridis 漸層（20–100 km/h）；依車種：五色點。
 * - 資料只有 2026-09-28 16:00–18:00：時間軸不在時段內時說明並給「跳到資料時段」（經 timelineJumpBridge 呼叫 useTimeline.jumpToTime）。
 * - 自訂顏色：車速可換「自訂三色」、車種五色可改（使用者自選，存 localStorage）。
 *   只在開發模式顯示（FREEWAY_TDCS_CUSTOM_COLORS_ENABLED）；正式站只有規格色（viridis／GFW 五色）。
 * - 跟隨結束原因（原型 toast）顯示在這裡。
 * - 出處與推算說明。
 */
import { useSyncExternalStore } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchHatch, SwatchSquare, useLegendTheme } from "./legendKit";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { timeStore } from "../../state/timeStore";
import { useLocale } from "../../state/localeStore";
import { requestTimelineJump } from "../../state/timelineJumpBridge";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import {
  FREEWAY_TDCS_COLOR_MODES, FREEWAY_TDCS_SIM_DEFAULT_WINDOW, FREEWAY_TDCS_SIM_KEY,
  FREEWAY_TDCS_SPEED_CUSTOM_STOPS, FREEWAY_TDCS_SPEED_MAX, FREEWAY_TDCS_SPEED_MIN, FREEWAY_TDCS_SPEED_RAMP, FREEWAY_TDCS_VT_NAMES,
} from "../../data/freewayTdcsSimTypes";
import {
  freewayTdcsColors, freewayTdcsData, freewayTdcsFollowEndMsg, freewayTdcsStatus, setFreewayTdcsColors,
  FREEWAY_TDCS_CUSTOM_COLORS_ENABLED, subscribeFreewayTdcsColors, subscribeFreewayTdcsFollowEndMsg, subscribeFreewayTdcsStatus,
  type FreewayTdcsColors, type FreewayTdcsFollowEndCode,
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

/** i18n key 寫成字面值（localeParity 靠字面值判斷 key 有沒有人用） */
export const FREEWAY_TDCS_VT_KEYS = [
  "legend.freewayTdcsSim.vt.0", "legend.freewayTdcsSim.vt.1", "legend.freewayTdcsSim.vt.2",
  "legend.freewayTdcsSim.vt.3", "legend.freewayTdcsSim.vt.4",
] as const;
const SPEED_STOP_KEYS = ["legend.freewayTdcsSim.slow", "legend.freewayTdcsSim.mid", "legend.freewayTdcsSim.fast"] as const;
const FOLLOW_END_KEYS: Record<FreewayTdcsFollowEndCode, (typeof FOLLOW_END_KEY_LIST)[number]> = {
  window: "legend.freewayTdcsSim.followEnd.window",
  before: "legend.freewayTdcsSim.followEnd.before",
  service: "legend.freewayTdcsSim.followEnd.service",
  exited: "legend.freewayTdcsSim.followEnd.exited",
};
const FOLLOW_END_KEY_LIST = [
  "legend.freewayTdcsSim.followEnd.window", "legend.freewayTdcsSim.followEnd.before",
  "legend.freewayTdcsSim.followEnd.service", "legend.freewayTdcsSim.followEnd.exited",
] as const;

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
  const { t, locale } = useLocale();
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
    {status.state === "error" && <LegendRow swatch={<SwatchHatch />}>{t("legend.freewayTdcsSim.loadError")}</LegendRow>}
    {status.state === "loading" && <LegendNote>{t("legend.freewayTdcsSim.loading")}</LegendNote>}
    <LegendNote>{t("legend.freewayTdcsSim.dataWindow")}</LegendNote>
    {!inWindow && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4 }}>
      <span style={{ fontSize: FONT_SIZE.sm, color: theme.textMuted }}>{t("legend.freewayTdcsSim.outsideWindow")}</span>
      <button
        type="button"
        onClick={jump}
        style={{
          height: 22, padding: "0 8px", borderRadius: RADIUS.md, cursor: "pointer", flexShrink: 0,
          border: `1px solid ${theme.border}`, background: theme.bgSubtle, color: theme.textDefault, fontSize: FONT_SIZE.xs,
        }}
      >{t("legend.freewayTdcsSim.jump")}</button>
    </div>}
    {inWindow && status.state === "ready" && <LegendNote>{t("legend.freewayTdcsSim.active", { n: status.active.toLocaleString(locale) })}</LegendNote>}
    {endMsg && <LegendNote>{t(FOLLOW_END_KEYS[endMsg.code])}</LegendNote>}
    <div style={{ marginTop: 4 }}>
      {mode === "speed"
        ? <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span style={{ fontSize: FONT_SIZE.sm, color: theme.textDefault }}>{t("legend.freewayTdcsSim.speedTitle")}</span>
            {FREEWAY_TDCS_CUSTOM_COLORS_ENABLED && <span style={{ display: "flex", gap: 4 }}>
              {(["viridis", "custom"] as const).map((p) => <button
                key={p} type="button" aria-pressed={colors.speedPalette === p}
                onClick={() => setFreewayTdcsColors({ speedPalette: p })}
                style={{ ...smallBtn, ...(colors.speedPalette === p ? { borderColor: theme.textDefault } : null) }}
              >{t(p === "viridis" ? "legend.freewayTdcsSim.paletteDefault" : "legend.freewayTdcsSim.paletteCustom")}</button>)}
            </span>}
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
                {SPEED_STOP_KEYS.map((k, i) => {
                  const lab = t(k);
                  return <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <ColorInput value={colors.speedCustom[i]!} onChange={(v) => setSpeedCustom(i, v)} title={t("legend.freewayTdcsSim.customSpeedColor", { label: lab })} />{lab}
                  </span>;
                })}
              </div>
            </>}
        </>
        : FREEWAY_TDCS_VT_NAMES.map((zh, i) => ({ zh, name: t(FREEWAY_TDCS_VT_KEYS[i]!) })).map(({ zh, name }, i) => <LegendRow
          key={zh}
          swatch={<SwatchDot color={colors.typeColors[i]!} stroke={theme.seam} />}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {name}
            {FREEWAY_TDCS_CUSTOM_COLORS_ENABLED
              && <ColorInput value={colors.typeColors[i]!} onChange={(v) => setTypeColor(i, v)} title={t("legend.freewayTdcsSim.customTypeColor", { name })} />}
          </span>
        </LegendRow>)}
      {FREEWAY_TDCS_CUSTOM_COLORS_ENABLED && <div style={{ marginTop: 4 }}>
        <button type="button" onClick={() => setFreewayTdcsColors(null)} style={smallBtn}>{t("legend.freewayTdcsSim.resetColors")}</button>
      </div>}
    </div>
    <LegendNote>{t("legend.freewayTdcsSim.trailNote")}</LegendNote>
    <LegendNote>{t("legend.freewayTdcsSim.nearNote")}</LegendNote>
    <LegendNote>{t("legend.freewayTdcsSim.source")}</LegendNote>
  </div>;
}
