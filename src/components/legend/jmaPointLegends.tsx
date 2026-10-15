// 日本氣象廳／環境省 時間軸點位與區域（P4）圖例。色票與地圖 paint、popup 同源（jmaPointTypes）。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchSquare, useLegendTheme } from "./legendKit";
import { JmaUncoveredLine, LiveStatus } from "./jmaLegends";
import { JMA_MISSING_COLOR, formatJst } from "../../data/jmaTypes";
import {
  ENV_WBGT_LEVELS, JMA_DIFF_CLASSES, JMA_PHENOLOGY_LAYER_PHENOMENA, JMA_POINT_HOLLOW_COLOR, JMA_POINT_LAYER_COLORS,
  JMA_RAINY_PHASES, JMA_SNOWCAP_OBSERVED_COLOR, JMA_SNOWCAP_OBSERVED_STROKE, jmaPhenologyCode, type JmaPhenologyLayerKey,
} from "../../data/jmaPointTypes";
import { getJmaLiveStatus, subscribeJmaLiveStatus } from "../../data/jmaLiveLoaders";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

function Hollow({ label, color = JMA_MISSING_COLOR, width = 2 }: { label: string; color?: string; width?: number }) {
  return <LegendRow swatch={<SwatchDot color="transparent" stroke={color} strokeWidth={width} />}>{label}</LegendRow>;
}

export function JmaLightningLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const status = useSyncExternalStore(subscribeJmaLiveStatus, () => getJmaLiveStatus("jmaLightning"));
  return <div>
    <LegendTitle zh={i18n.t("legend.jmaTime.lightningTitle")} en="LIDEN" />
    <LegendRow swatch={<SwatchDot color="#a78bfa" />}>{i18n.t("legend.jmaTime.lightningCg")}</LegendRow>
    <LegendRow swatch={<SwatchDot color="#4ade80" />}>{i18n.t("legend.jmaTime.lightningIc")}</LegendRow>
    {status.state === "uncovered"
      ? <JmaUncoveredLine layerKey="jmaLightning" />
      : status.state === "ok" && <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
        {i18n.t("legend.jmaTime.lightningCovered")}
        {status.latestAt && <><br />{i18n.t("legend.jmaTime.lightningLastRecord")} <LegendNum>{formatJst(status.latestAt)}</LegendNum></>}
      </div>}
    <LegendNote>{i18n.t("legend.jmaTime.lightningNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

export function JmaWbgtLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.jmaTime.wbgtTitle")} en="暑さ指数" />
    {[...ENV_WBGT_LEVELS].reverse().map((l) => <LegendRow key={l.value} swatch={<SwatchDot color={l.color} />}>{enumLabel("envWbgtLevel", l.value, l.label, i18n)}</LegendRow>)}
    <Hollow label={i18n.t("legend.jmaTime.wbgtNoValue")} />
    <LiveStatus layerKey="jmaWbgt" drawnUnit="legend.jmaTime.unitStation" />
    <LegendNote>{i18n.t("legend.jmaTime.wbgtNote")}{i18n.t("legend.jmaTime.wbgtAttribution")}</LegendNote>
  </div>;
}

function DiffRows() {
  const i18n = useLocale();
  return <>{JMA_DIFF_CLASSES.map((c) => <LegendRow key={c.value} swatch={<SwatchDot color={c.color} />}>{enumLabel("jmaDiffClass", c.value, c.label, i18n)}</LegendRow>)}</>;
}

export function JmaSnowcapLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.jmaTime.snowcapTitle")} en="初冠雪" />
    <LegendRow swatch={<SwatchDot color={JMA_SNOWCAP_OBSERVED_COLOR} stroke={JMA_SNOWCAP_OBSERVED_STROKE} strokeWidth={2} opacity={1} />}>{i18n.t("legend.jmaTime.snowcapObserved")}</LegendRow>
    <Hollow label={i18n.t("legend.jmaTime.snowcapNotYet")} color={JMA_POINT_HOLLOW_COLOR} />
    <Hollow label={i18n.t("legend.jmaTime.notYetLate")} color={JMA_POINT_HOLLOW_COLOR} width={3} />
    <LiveStatus layerKey="jmaSnowcap" timeLabel={i18n.t("legend.jmaTime.asOfDate")} drawnUnit="legend.jmaTime.unitMountain" />
    <LegendNote>{i18n.t("legend.jmaTime.seasonalLabelNote")}{i18n.t("legend.jmaTime.snowcapNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

function PhenologyLegend({ layerKey }: { layerKey: JmaPhenologyLayerKey }) {
  const i18n = useLocale();
  const p = useKeyOverlayParams(layerKey);
  const code = jmaPhenologyCode(layerKey, p[`${layerKey}PhenomenonIdx`]);
  const phen = JMA_PHENOLOGY_LAYER_PHENOMENA[layerKey].find((x) => x.value === code)!;
  const phenLabel = enumLabel("jmaPhenomenon", phen.value, phen.label, i18n);
  return <div>
    <LegendTitle zh={i18n.t(layerKey === "jmaSakura" ? "legend.jmaTime.sakuraTitle" : "legend.jmaTime.autumnTitle", { phenomenon: phenLabel })}
      en={layerKey === "jmaSakura" ? "桜前線" : "紅葉前線"} />
    <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs }}>{i18n.t("legend.jmaTime.phenologyObserved")}</div>
    <DiffRows />
    <Hollow label={i18n.t("legend.jmaTime.phenologyNotYet")} color={JMA_POINT_LAYER_COLORS[layerKey]} />
    <Hollow label={i18n.t("legend.jmaTime.notYetLate")} color={JMA_POINT_LAYER_COLORS[layerKey]} width={3} />
    <LiveStatus layerKey={layerKey} timeLabel={i18n.t("legend.jmaTime.asOfDate")} drawnUnit="legend.jmaTime.unitPhenologyPoint" />
    <LegendNote>{i18n.t("legend.jmaTime.seasonalLabelNote")}{i18n.t("legend.jmaTime.phenologyNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}

export function JmaAutumnLeavesLegend() {
  return <PhenologyLegend layerKey="jmaAutumnLeaves" />;
}

export function JmaSakuraLegend() {
  return <PhenologyLegend layerKey="jmaSakura" />;
}

export function JmaRainySeasonLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={i18n.t("legend.jmaTime.rainyTitle")} en="梅雨" />
    {JMA_RAINY_PHASES.map((ph) => <LegendRow key={ph.value} swatch={<SwatchSquare color={ph.color} />}>{enumLabel("jmaRainyPhase", ph.value, ph.label, i18n)}</LegendRow>)}
    <LiveStatus layerKey="jmaRainySeason" timeLabel={i18n.t("legend.jmaTime.asOfDate")} drawnUnit="legend.jmaTime.unitRegion" />
    <LegendNote>{i18n.t("legend.jmaTime.rainyNote")}{i18n.t("legend.jma.attribution")}</LegendNote>
  </div>;
}
