import { FONT_SIZE } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import {
  BUS_CROWDING_REPRESENTATIVE_COLOR, BUS_CROWDING_SCENARIO_LABELS, BUS_CROWDING_SCENARIOS, BUS_CROWDING_SIM_KEY,
  busCrowdingLevel, segmentKey, type BusCrowdingScenarioData,
} from "../../data/busCrowdingSimTypes";
import { busCrowdingColors } from "../../data/busCrowdingSimStyle";
import { useBusCrowdingSimIndex, useBusCrowdingSimScenario } from "../../data/busCrowdingSimStore";
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
  const index = useBusCrowdingSimIndex();
  const data = useBusCrowdingSimScenario();
  const li = num(props.li);
  const sj = num(props.sj);
  const route = String(props.n ?? "");
  const subRoute = String(props.sn ?? "");
  const values = segmentValues(data?.scenario === scenario ? data : null, li !== null && sj !== null ? index?.get(segmentKey(li, sj)) : undefined);
  const level = values ? busCrowdingLevel(values.ov137, values.n137) : null;
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
