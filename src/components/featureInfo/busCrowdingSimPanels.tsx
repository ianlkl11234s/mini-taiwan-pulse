import { FONT_SIZE } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import {
  BUS_CROWDING_REPRESENTATIVE_COLOR, BUS_CROWDING_SCENARIO_LABELS, BUS_CROWDING_SCENARIOS, BUS_CROWDING_SIM_KEY, BUS_CROWDING_DEFAULT_VERSION, BUS_CROWDING_VERSIONS,
  busCrowdingLevel, segmentKey, type BusCrowdingScenarioData,
} from "../../data/busCrowdingSimTypes";
import { busCrowdingColors } from "../../data/busCrowdingSimStyle";
import { useBusCrowdingSimIndex, useBusCrowdingSimReplay, useBusCrowdingSimScenario } from "../../data/busCrowdingSimStore";
import { classAt, replayTripState } from "../../data/busCrowdingReplay";
import { busCrowdingSimClock } from "../../state/busCrowdingSimClock";
import { formatSimClock } from "../../state/simPlaybackClock";
import { useSyncExternalStore } from "react";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { paramText } from "../../i18n/paramText";
import { useLocale } from "../../state/localeStore";
import { Row, SourceFooter, Title } from "./shared";
import { LIGHT_FEATURE, useFeatureTheme } from "./featureTheme";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v: number | null | undefined) => (typeof v === "number" && v >= 0 ? `${Math.round(v * 100)}%` : "—");

/** 某路段在目前方案兩版的值；資料還沒好或找不到回 null。 */
export function segmentValues(data: BusCrowdingScenarioData | null, index: number | undefined) {
  if (!data || index === undefined) return null;
  const { v137, v180 } = data.values;
  return { ov137: v137.ov[index] ?? null, ov180: v180.ov[index] ?? null, n137: v137.n[index] ?? 0, n180: v180.n[index] ?? 0 };
}

/**
 * 公車擁擠模擬 popup（spec §5.40）：只顯示結果與可信度（S-2「只看範圍」），控制項只在面板。
 * 超載比例兩版都寫成範圍，不受目前選的版本影響；方案跟著目前選的。不顯示單班人數。
 */
export function BusCrowdingSimPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const params = useLayerParams(BUS_CROWDING_SIM_KEY);
  const scenario = oneOfParam(paramStr(params, BUS_CROWDING_SIM_KEY, "busCrowdingSimScenario"), BUS_CROWDING_SCENARIOS, "base");
  const version = oneOfParam(paramStr(params, BUS_CROWDING_SIM_KEY, "busCrowdingSimVersion"), BUS_CROWDING_VERSIONS, BUS_CROWDING_DEFAULT_VERSION);
  const index = useBusCrowdingSimIndex();
  const data = useBusCrowdingSimScenario();
  const li = num(props.li);
  const sj = num(props.sj);
  const route = String(props.n ?? "");
  const subRoute = String(props.sn ?? "");
  const values = segmentValues(data?.scenario === scenario ? data : null, li !== null && sj !== null ? index?.get(segmentKey(li, sj)) : undefined);
  // 標題色跟地圖同一版（目前選的參數版本）
  const level = values ? (version === "v137" ? busCrowdingLevel(values.ov137, values.n137) : busCrowdingLevel(values.ov180, values.n180)) : null;
  const trips = values ? (values.n137 === values.n180 ? tr("popup.busCrowdingSim.trips", { n: values.n137 }) : tr("popup.busCrowdingSim.tripsRange", { a: Math.min(values.n137, values.n180), b: Math.max(values.n137, values.n180) })) : "";

  return <>
    <Title color={busCrowdingColors(t !== LIGHT_FEATURE)[level ?? 2] ?? BUS_CROWDING_REPRESENTATIVE_COLOR}>{route}</Title>
    <div style={{ margin: "2px 0 4px" }}>
      <span className="fi-badge" style={{ ...chipOutline(t.textMuted), display: "inline-block", padding: "2px 5px", borderRadius: 3, fontSize: FONT_SIZE.sm, lineHeight: 1.2 }}>
        {tr("popup.busCrowdingSim.confidence")}
      </span>
    </div>
    {subRoute && subRoute !== route && <Row label={tr("popup.busCrowdingSim.subRoute")} value={subRoute} />}
    {props.syn === 1 && <Row label={tr("popup.busCrowdingSim.kind")} value={tr("popup.busCrowdingSim.synthetic")} />}
    <Row label={tr("popup.busCrowdingSim.segment")} value={tr("popup.busCrowdingSim.segmentValue", { a: String(props.a ?? "—"), b: String(props.b ?? "—") })} />
    <Row label={tr("popup.busCrowdingSim.scenario")} value={paramText(BUS_CROWDING_SCENARIO_LABELS[scenario], i18n)} />
    {!values && <div style={{ padding: "4px 0", color: t.textDim, fontSize: FONT_SIZE.sm }}>{tr("popup.busCrowdingSim.loading")}</div>}
    {values && <>
      <Row label={tr("popup.busCrowdingSim.overload")} value={tr("popup.busCrowdingSim.overloadRange", { low: pct(values.ov137), high: pct(values.ov180) })} />
      <Row label={tr("popup.busCrowdingSim.tripsLabel")} value={trips} />
    </>}
    <div style={{ marginTop: 4, color: t.textDim, fontSize: FONT_SIZE.sm, lineHeight: 1.4 }}>{tr("popup.busCrowdingSim.note")}</div>
    <SourceFooter props={{ source: tr("popup.busCrowdingSim.source") }} />
  </>;
}

/** 車上負載分級的 i18n key（門檻照原型 index.html:150：容量比 0.5／0.8／1.0）。 */
export const BUS_LOAD_LEVEL_KEYS = [
  "popup.busCrowdingSim.load0", "popup.busCrowdingSim.load1", "popup.busCrowdingSim.load2", "popup.busCrowdingSim.load3",
] as const;

/**
 * 時間回放的車 popup：路線、班次（發車時刻）、下一站；負載寫「較寬鬆 X～較擁擠 Y」（trip id 對兩版），
 * 附「只看範圍」中性 chip。不出現人數、不出現容量假設值。下一站與負載跟著模擬時鐘走。
 */
export function BusCrowdingSimVehiclePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const isDark = t !== LIGHT_FEATURE;
  const { t: tr } = useLocale();
  const params = useLayerParams(BUS_CROWDING_SIM_KEY);
  const version = oneOfParam(paramStr(params, BUS_CROWDING_SIM_KEY, "busCrowdingSimVersion"), BUS_CROWDING_VERSIONS, BUS_CROWDING_DEFAULT_VERSION);
  const replay = useBusCrowdingSimReplay();
  const T = useSyncExternalStore(busCrowdingSimClock.subscribe, busCrowdingSimClock.get);
  const trip = replay?.byId.get(String(props.tid ?? ""));
  const line = trip ? replay?.lines[trip.l] ?? null : null;
  const state = trip && line ? replayTripState(trip, line, T) : null;
  const colors = busCrowdingColors(isDark);
  if (!trip || !line) {
    return <>
      <Title color={BUS_CROWDING_REPRESENTATIVE_COLOR}>{tr("popup.busCrowdingSim.vehicleGone")}</Title>
      <SourceFooter props={{ source: tr("popup.busCrowdingSim.source") }} />
    </>;
  }
  const k = state?.k ?? null;
  const next = k !== null ? line.s[trip.q[k + 1] ?? -1] : undefined;
  const mine = k !== null ? classAt(trip.c, k) : null;
  const other = k !== null ? classAt(trip.x, k) : null;
  const [low, high] = version === "v137" ? [mine, other] : [other, mine];
  const label = (c: number | null) => (c === null ? "—" : tr(BUS_LOAD_LEVEL_KEYS[c] ?? BUS_LOAD_LEVEL_KEYS[0]));
  return <>
    <Title color={colors[mine ?? 0] ?? BUS_CROWDING_REPRESENTATIVE_COLOR}>{line.n}</Title>
    <div style={{ margin: "2px 0 4px" }}>
      <span className="fi-badge" style={{ ...chipOutline(t.textMuted), display: "inline-block", padding: "2px 5px", borderRadius: 3, fontSize: FONT_SIZE.sm, lineHeight: 1.2 }}>
        {tr("popup.busCrowdingSim.confidence")}
      </span>
    </div>
    {line.sn && line.sn !== line.n && <Row label={tr("popup.busCrowdingSim.subRoute")} value={line.sn} />}
    {trip.syn === 1 && <Row label={tr("popup.busCrowdingSim.kind")} value={tr("popup.busCrowdingSim.synthetic")} />}
    <Row label={tr("popup.busCrowdingSim.trip")} value={tr("popup.busCrowdingSim.tripDeparts", { time: formatSimClock(trip.t[0] ?? 0) })} />
    <Row label={tr("popup.busCrowdingSim.nextStop")} value={next ?? "—"} />
    <Row label={tr("popup.busCrowdingSim.load")} value={other === null
      ? label(mine)
      : tr("popup.busCrowdingSim.loadRange", { low: label(low), high: label(high) })} />
    <div style={{ marginTop: 4, color: t.textDim, fontSize: FONT_SIZE.sm, lineHeight: 1.4 }}>{tr("popup.busCrowdingSim.vehicleNote")}</div>
    <SourceFooter props={{ source: tr("popup.busCrowdingSim.source") }} />
  </>;
}
