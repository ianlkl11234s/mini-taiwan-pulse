// 日本氣象廳／環境省 時間軸點位與區域（P4）popup。時間一律 JST；未觀測寫「尚未觀測」，不當 0。
import type { PanelProps } from "./registry";
import { useLocale } from "../../state/localeStore";
import { PopupDetails, Row, SourceFooter, Title } from "./shared";
import { JMA_LICENSE, JMA_MISSING_COLOR, JMA_SOURCE_URL, formatJst } from "../../data/jmaTypes";
import {
  ENV_WBGT_LEVELS, ENV_WBGT_LICENSE, ENV_WBGT_SOURCE_URL, JMA_DIFF_CLASSES, JMA_POINT_HOLLOW_COLOR, JMA_POINT_LAYER_COLORS,
  JMA_RAINY_PHASES, JMA_SNOWCAP_OBSERVED_STROKE, jmaSignedDays, type JmaPhenologyLayerKey,
} from "../../data/jmaPointTypes";
import { getLatestJmaRainy, type JmaRainyRegion } from "../../data/jmaLiveLoaders";
import { jmaRainyRegionForCode } from "../../hooks/useJmaRainySeasonLayer";
import { enumLabel } from "../../i18n/dataText";

const ORG = "気象庁";

function text(value: unknown, fallback = ""): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return fallback;
  return String(value);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function JmaFooter({ fetchedAt }: { fetchedAt?: unknown }) {
  const { t: tr } = useLocale();
  return <SourceFooter props={{ source_org: tr("popup.jma.footerOrg", { org: ORG }), source_url: JMA_SOURCE_URL, license: JMA_LICENSE, fetched_at: typeof fetchedAt === "string" && fetchedAt.length === 10 ? fetchedAt : formatJst(fetchedAt) }} />;
}

function diffColor(days: number | null): string | undefined {
  if (days == null) return undefined;
  return JMA_DIFF_CLASSES.find((c) => days <= c.max)?.color;
}

export function JmaWbgtPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const wbgt = num(props.wbgt);
  const level = ENV_WBGT_LEVELS.find((l) => l.value === text(props.level));
  return <>
    <Title color={level?.color ?? JMA_POINT_LAYER_COLORS.jmaWbgt}>{text(props.station_name, tr("popup.jma.amedasStation"))}</Title>
    <Row label={tr("popup.jmaTime.wbgt")} value={wbgt == null ? tr("popup.jma.noObservation") : `${formatNumber(wbgt, { maximumFractionDigits: 1 })} °C`} color={wbgt == null ? JMA_MISSING_COLOR : level?.color} />
    <Row label={tr("popup.jmaTime.level")} value={level ? enumLabel("envWbgtLevel", level.value, level.label, i18n) : tr("popup.common.none")} color={level?.color} />
    <Row field="observedAt" value={formatJst(props.observed_at) || tr("popup.common.none")} mono />
    <PopupDetails summary={tr("popup.common.notesAndLimits")}>
      <Row field="description" value={tr("popup.jmaTime.wbgtNote")} />
      <Row field="stationNo" value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: tr("popup.jmaTime.footerEnv"), source_url: ENV_WBGT_SOURCE_URL, license: ENV_WBGT_LICENSE, fetched_at: formatJst(props.observed_at) }} />
  </>;
}

/** 季節類共用：狀態、觀測日、平年日、與平年差（未觀測且已過平年 → 已晚 N 日） */
function SeasonalRows({ props, dateField }: { props: Record<string, unknown>; dateField: string }) {
  const { t: tr } = useLocale();
  const observed = text(props.state) === "observed";
  const diff = num(props.diff_normal_days ?? props.days_vs_normal);
  const past = num(props.days_past_normal);
  return <>
    <Row label={tr("popup.jmaTime.state")} value={observed ? tr("popup.jmaTime.stateObserved") : tr("popup.jmaTime.stateNotYet")} />
    {observed && <Row label={tr("popup.jmaTime.obsDate")} value={text(props[dateField], tr("popup.common.none"))} mono />}
    <Row label={tr("popup.jmaTime.normalDate")} value={text(props.normal_date, tr("popup.common.none"))} mono />
    {observed && <Row label={tr("popup.jmaTime.diffNormal")} value={diff == null ? tr("popup.common.none") : tr("popup.jmaTime.days", { n: jmaSignedDays(diff) })} color={diffColor(diff)} />}
    {!observed && past != null && <Row label={tr("popup.jmaTime.diffNormal")} value={tr("popup.jmaTime.pastNormal", { n: past })} />}
    <Row label={tr("popup.jmaTime.asOf")} value={text(props.as_of)} mono />
  </>;
}

export function JmaSnowcapPanel({ props }: PanelProps) {
  const { t: tr, formatNumber } = useLocale();
  const observed = text(props.state) === "observed";
  const method = text(props.judgement_method);
  const elev = num(props.elevation_m);
  return <>
    <Title color={observed ? JMA_SNOWCAP_OBSERVED_STROKE : JMA_POINT_HOLLOW_COLOR}>{text(props.mountain_name, tr("popup.jmaTime.mountain"))}</Title>
    <SeasonalRows props={props} dateField="first_snowcap_date" />
    <Row label={tr("popup.jmaTime.coldSeasonYear")} value={text(props.season_year)} mono />
    <Row label={tr("popup.jmaTime.judgement")} value={method === "analysis" ? tr("popup.jmaTime.judgementAnalysis") : method === "visual" ? tr("popup.jmaTime.judgementVisual") : tr("popup.common.none")} />
    {text(props.status_text) && <Row label={tr("popup.jmaTime.statusNow")} value={text(props.status_text)} />}
    {text(props.status_time) && <Row label={tr("popup.jmaTime.statusTime")} value={formatJst(props.status_time)} mono />}
    <PopupDetails summary={tr("popup.common.notesAndLimits")}>
      <Row label={tr("popup.jmaTime.observatory")} value={text(props.observatory)} />
      <Row field="elevation" value={elev == null ? tr("popup.common.none") : `${formatNumber(elev)} m`} />
      <Row field="description" value={tr("popup.jmaTime.methodCaveat")} />
    </PopupDetails>
    <JmaFooter fetchedAt={props.as_of} />
  </>;
}

function JmaPhenologyPanel({ props, layerKey }: { props: Record<string, unknown>; layerKey: JmaPhenologyLayerKey }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const code = text(props.phenomenon_code);
  const diffLast = num(props.diff_last_year_days);
  const observed = text(props.state) === "observed";
  return <>
    <Title color={JMA_POINT_LAYER_COLORS[layerKey]}>{text(props.station_name, tr("popup.jma.amedasStation"))}</Title>
    <Row label={tr("popup.jmaTime.phenomenon")} value={enumLabel("jmaPhenomenon", code, text(props.phenomenon_name, code), i18n)} />
    <SeasonalRows props={props} dateField="obs_date" />
    {observed && diffLast != null && <Row label={tr("popup.jmaTime.diffLastYear")} value={tr("popup.jmaTime.days", { n: jmaSignedDays(diffLast) })} />}
    <Row label={tr("popup.jmaTime.season")} value={text(props.season_year)} mono />
    {text(props.alt_species) && <Row label={tr("popup.jmaTime.altSpecies")} value={text(props.alt_species)} />}
    <PopupDetails summary={tr("popup.common.notesAndLimits")}>
      <Row field="description" value={tr("popup.jmaTime.phenologyNote")} />
      <Row field="stationNo" value={text(props.station_no)} mono />
    </PopupDetails>
    <JmaFooter fetchedAt={props.as_of} />
  </>;
}

export function JmaAutumnLeavesPanel({ props }: PanelProps) {
  return <JmaPhenologyPanel props={props} layerKey="jmaAutumnLeaves" />;
}

export function JmaSakuraPanel({ props }: PanelProps) {
  return <JmaPhenologyPanel props={props} layerKey="jmaSakura" />;
}

function rainyDate(state: string | null, date: string | null, txt: string | null, cls: string | null, diff: number | null, tr: ReturnType<typeof useLocale>["t"]): string {
  if (state === "unspecified") return tr("popup.jmaTime.unspecified");
  if (state !== "observed") return tr("popup.jmaTime.notYet");
  const parts = [txt ?? date ?? ""];
  if (cls) parts.push(cls);
  if (diff != null) parts.push(tr("popup.jmaTime.days", { n: jmaSignedDays(diff) }));
  return parts.filter(Boolean).join(" · ");
}

export function JmaRainySeasonPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const code = text(props.admin_code);
  const regionName = jmaRainyRegionForCode(code);
  const snapshot = getLatestJmaRainy();
  const region: JmaRainyRegion | null = regionName ? snapshot?.regions.get(regionName) ?? null : null;
  const place = [text(props.pref_name), text(props.city_name), text(props.ward_name)].filter(Boolean).join(" ");
  const phase = region ? JMA_RAINY_PHASES.find((p) => p.value === region.phase) : undefined;
  return <>
    <Title color={phase?.color ?? JMA_POINT_LAYER_COLORS.jmaRainySeason}>{place || tr("popup.jma.cityFallback")}</Title>
    {!regionName ? <Row field="status" value={tr("popup.jmaTime.noRainy")} /> : <>
      <Row label={tr("popup.jmaTime.region")} value={regionName} />
      {!region ? <Row field="status" value={tr("popup.jmaTime.notCovered")} /> : <>
        <Row label={tr("popup.jmaTime.phase")} value={phase ? enumLabel("jmaRainyPhase", phase.value, phase.label, i18n) : ""} color={phase?.color} />
        <Row label={tr("popup.jmaTime.onset")} value={rainyDate(region.onsetState, region.onsetDate, region.onsetText, region.onsetClass, region.onsetDiff, tr)} />
        <Row label={tr("popup.jmaTime.end")} value={rainyDate(region.endState, region.endDate, region.endText, region.endClass, region.endDiff, tr)} />
        <Row label={tr("popup.jmaTime.normalDate")} value={[region.onsetNormal, region.endNormal].map((d) => d ?? "—").join(" → ")} mono />
        {region.status && <Row label={tr("popup.jmaTime.reportStatus")} value={region.status} />}
        <Row label={tr("popup.jmaTime.asOf")} value={snapshot?.asOf ?? ""} mono />
      </>}
    </>}
    <JmaFooter fetchedAt={snapshot?.asOf} />
  </>;
}
