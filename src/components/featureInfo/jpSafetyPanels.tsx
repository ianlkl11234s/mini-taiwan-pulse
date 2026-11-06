import { FONT_SIZE } from "../../styles/designTokens";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { g36ColorOf } from "../../data/safetyG36Types";
import {
  JP_TRAFFIC_ACCIDENT_LIGHT_LABELS, JP_TRAFFIC_ACCIDENT_PARTY_LABELS, JP_TRAFFIC_ACCIDENT_PERIOD, JP_TRAFFIC_ACCIDENT_ROAD_LABELS,
  JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS, JP_TRAFFIC_ACCIDENT_SOURCE, JP_TRAFFIC_ACCIDENT_SURFACE_LABELS, JP_TRAFFIC_ACCIDENT_TYPE_OPTIONS,
  JP_TRAFFIC_ACCIDENT_WEATHER_LABELS,
} from "../../data/jpTrafficAccidentsTypes";

/**
 * 日本第二輪 C083（2026-11-06）popup：警察庁 2025 本票人身事故。
 * PMTiles tile 不帶來源欄 → 本檔自掛 SourceFooter（FOOTER_SELF_MANAGED_LAYER_TYPES 已登記）。
 * 屬性是短代碼（analytics 02_build.py），中文對照在 jpTrafficAccidentsTypes、英日文在 enums.jpSafety.json。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const labelOf = (options: readonly { value: string; label: string }[], value: string) => options.find((o) => o.value === value)?.label ?? value;

export function JpTrafficAccidents2025Panel({ props }: Props) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const t = useFeatureTheme();
  const sev = str(props.sev);
  const type = str(props.type);
  const color = g36ColorOf(JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS, sev);
  const dead = num(props.dead);
  const inj = num(props.inj);
  const code = (domain: string, labels: Record<string, string>, v: unknown) => {
    const s = str(v);
    return s ? enumLabel(domain, s, labels[s] ?? s, i18n) : "";
  };
  const pa = code("jpTrafficAccidentParty", JP_TRAFFIC_ACCIDENT_PARTY_LABELS, props.pa);
  const pb = code("jpTrafficAccidentParty", JP_TRAFFIC_ACCIDENT_PARTY_LABELS, props.pb);
  const conditions = [
    code("jpTrafficAccidentLight", JP_TRAFFIC_ACCIDENT_LIGHT_LABELS, props.light),
    code("jpTrafficAccidentWeather", JP_TRAFFIC_ACCIDENT_WEATHER_LABELS, props.wx),
    code("jpTrafficAccidentSurface", JP_TRAFFIC_ACCIDENT_SURFACE_LABELS, props.surf),
  ].filter(Boolean).join(" · ");
  return <>
    <Title color={color}>{tr("popup.policeJustice.accidentTitle")}</Title>
    <Row field="category" value={sev ? enumLabel("jpTrafficAccidentSeverity", sev, labelOf(JP_TRAFFIC_ACCIDENT_SEVERITY_OPTIONS, sev), i18n) : ""} color={color} />
    <Row field="occurredAt" value={`${str(props.date)} ${str(props.time)}`.trim()} mono />
    <Row label={tr("popup.policeJustice.casualties")} value={dead == null || inj == null ? "" : tr("popup.policeJustice.deathsInjuries", { dead, inj })} />
    <Row field="type" value={type ? enumLabel("jpTrafficAccidentType", type, labelOf(JP_TRAFFIC_ACCIDENT_TYPE_OPTIONS, type), i18n) : ""} />
    <Row label={tr("popup.jpSafety.parties")} value={[pa, pb].filter(Boolean).join(" ↔ ")} />
    <Row label={tr("popup.jpSafety.road")} value={code("jpTrafficAccidentRoad", JP_TRAFFIC_ACCIDENT_ROAD_LABELS, props.road)} />
    <Row label={tr("popup.jpSafety.conditions")} value={conditions} />
    <Row label={tr("popup.jpSafety.prefecture")} value={str(props.pref)} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6, lineHeight: 1.4 }}>
      {tr("popup.jpSafety.accidentNote", { period: JP_TRAFFIC_ACCIDENT_PERIOD })}
    </div>
    <SourceFooter props={JP_TRAFFIC_ACCIDENT_SOURCE} />
  </>;
}
